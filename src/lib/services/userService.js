const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Utilidades de manejo de cookies
const cookieManager = {
  set: (name, value, days = 7) => {
    if (typeof document === 'undefined') return;
    const encodedValue = encodeURIComponent(value);
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodedValue};expires=${expires};path=/;SameSite=Lax;Secure`;
  },

  get: (name) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },

  remove: (name) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;Secure`;
  }
};

// Gestión de autenticación
const authManager = {
  INACTIVITY_TIMEOUT_MS: 2 * 60 * 1000,
  WARNING_BEFORE_LOGOUT_MS: 30 * 1000,
  inactivityTimer: null,
  warningTimer: null,
  lastActivity: null,
  isWarningActive: false,
  
  getToken: () => {
    if (typeof window === 'undefined') return null;
    try {
      const tokenData = localStorage.getItem('authToken');
      if (!tokenData) return null;
      const { token } = JSON.parse(tokenData);
      return token;
    } catch (e) {
      console.error('Error al leer el token de localStorage:', e);
      return null;
    }
  },
  
  resetInactivityTimer: function(onTimeout, onWarning) {
    if (this.isWarningActive) {
      return;
    }
    
    this.clearTimers();
    
    this.lastActivity = Date.now();
    
    this.warningTimer = setTimeout(() => {
      this.isWarningActive = true;
      if (onWarning) onWarning();
    }, this.INACTIVITY_TIMEOUT_MS - this.WARNING_BEFORE_LOGOUT_MS);
    
    // Configurar timer de cierre de sesión
    this.inactivityTimer = setTimeout(() => {
      this.isWarningActive = false;
      if (onTimeout) onTimeout();
    }, this.INACTIVITY_TIMEOUT_MS);
  },
  
  clearTimers: function() {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    this.isWarningActive = false;
  },
  
  getTimeRemaining: function() {
    if (!this.lastActivity) return 0;
    const elapsed = Date.now() - this.lastActivity;
    return Math.max(0, this.INACTIVITY_TIMEOUT_MS - elapsed);
  },
  
  setToken: function(token) {
    if (typeof window === 'undefined') return;
    try {
      const tokenData = JSON.stringify({ token });
      localStorage.setItem('authToken', tokenData);
      this.lastActivity = Date.now();
    } catch (e) {
      console.error('Error al guardar el token en localStorage:', e);
    }
  },
  
  clear: function() {
    this.clearTimers();
    this.lastActivity = null;
    this.isWarningActive = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }
};

// Cliente HTTP mejorado
const httpClient = {
  request: async (endpoint, options = {}) => {
    const token = authManager.getToken();
    // Si API_URL está vacío, usar ruta relativa (para Next.js API routes en el mismo servidor)
    const url = API_URL ? `${API_URL}${endpoint}` : endpoint;
    
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      },
      credentials: 'include'
      // Removido mode: 'cors' ya que las rutas API están en el mismo servidor
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: 'Error al procesar la respuesta del servidor' };
        }
        const error = new Error(errorData.message || `Error HTTP: ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }
      if (response.status === 204) {
        return null;
      }
      try {
        return await response.json();
      } catch (e) {
        console.warn('La respuesta no es un JSON válido', e);
        return null;
      }
    } catch (error) {
      // Mejorar el manejo de errores para detectar diferentes tipos
      const errorMessage = error.message || '';
      const isNetworkError = 
        error.name === 'NetworkError' ||
        (error.name === 'TypeError' && (
          errorMessage.includes('fetch') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('Network request failed') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('ERR_NETWORK') ||
          errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
          errorMessage.includes('ERR_CONNECTION_REFUSED')
        ));
      
      if (isNetworkError) {
        // Error de red (servidor no disponible, sin conexión, etc.)
        const networkError = new Error('Error de conexión. Por favor, verifica que el servidor esté corriendo y tu conexión a internet.');
        networkError.status = 0;
        networkError.isNetworkError = true;
        networkError.originalError = error;
        if (!((error.message || '').toLowerCase().includes('credenciales'))) {
          console.error(`Error de red en petición a ${endpoint} (URL: ${url}):`, error);
        }
        throw networkError;
      }
      
      // Si el error ya tiene status, mantenerlo
      if (error.status) {
        if (!((error.message || '').toLowerCase().includes('credenciales'))) {
          console.error(`Error en petición a ${endpoint}:`, error);
        }
        throw error;
      }
      
      // Error desconocido sin status
      if (!((error.message || '').toLowerCase().includes('credenciales'))) {
        console.error(`Error desconocido en petición a ${endpoint} (URL: ${url}):`, error);
      }
      const unknownError = new Error(error.message || 'Error de conexión. Por favor, verifica tu conexión a internet.');
      unknownError.status = 0;
      unknownError.originalError = error;
      throw unknownError;
    }
  }
};

// Servicio de usuario
export const userService = {
  checkAuth: (onInactivityTimeout, onInactivityWarning) => {
    if (typeof window === 'undefined') return false;
    
    const token = authManager.getToken();
    if (!token) {
      return false;
    }
    
    // Reiniciar el temporizador de inactividad
    authManager.resetInactivityTimer(onInactivityTimeout, onInactivityWarning);
    
    return true;
  },

  login: async (username, password) => {
    try {
      authManager.clear();
      
      const data = await httpClient.request('/api/login', {
        method: 'POST',
        body: { username, password }
      });

      if (data?.token) {
        authManager.clearTimers();
        authManager.setToken(data.token);
        
        const userInfo = await userService.getMe();
        
        // Devolver el usuario y la ruta de redirección para que el componente maneje la navegación
        let redirectPath = '/dashboard';
        if (userInfo?.rol === 'doctor' || userInfo?.rol === 'caregiver') {
          redirectPath = '/caregiver/assign';
        } else if (userInfo?.rol === 'paciente') {
          redirectPath = '/patient/medications';
        }
        
        // Agregar la información del usuario y la ruta de redirección a la respuesta
        return {
          ...data,
          user: userInfo,
          redirectPath
        };
      }

      return data;
    } catch (error) {
      authManager.clear();
      
      if (!((error.message || '').toLowerCase().includes('credenciales'))) {
        console.error('Error en login:', error);
      }
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  },

  logout: () => {
    authManager.clearTimers();
    authManager.clear();
    
    return Promise.resolve();
  },

  getMe: async () => {
    try {
      const response = await httpClient.request('/api/usuarios/me');
      return response;
    } catch (error) {
      console.error('Error en getMe:', error);
      if (error.status === 401 || error.status === 403) {
        authManager.clear();
      }
      return null;
    }
  },
  
  getAllUsers: () => httpClient.request('/api/usuarios'),
  
  getUserById: (id) => httpClient.request(`/api/usuarios/${id}`),

  createUser: (userData) => 
    httpClient.request('/api/usuarios', {
      method: 'POST',
      body: userData
    }),

  updateUser: async (userId, userData) => {
    try {
      const response = await httpClient.request(`/api/usuarios/${userId}`, {
        method: 'PUT',
        body: userData
      });
      return response;
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  },

  deleteUser: (id) => 
    httpClient.request(`/api/usuarios/${id}`, { 
      method: 'DELETE' 
    }),

  // Obtener pacientes asignados a un doctor
  getPatientsByDoctorId: (doctorId) =>
    httpClient.request(`/api/doctores/${doctorId}/pacientes`),
    
  // Obtener medicaciones de un paciente
  getPacienteMedicaciones: (pacienteId) => 
    httpClient.request(`/api/pacientes/${pacienteId}/medicaciones`),
    
  // Crear doctor en la tabla doctores
  createDoctor: (usuarioId, doctorData) =>
    httpClient.request('/api/doctores', {
      method: 'POST',
      body: { ...doctorData, usuarioId }
    }),
    
  // Asignar paciente a un doctor
  assignPatientToDoctor: (pacienteId, doctorId) =>
    httpClient.request('/api/pacientes-doctores', {
      method: 'POST',
      body: { pacienteId, doctorId }
    }),
    
  // Actualizar doctor de un paciente
  updatePatientDoctor: (pacienteId, doctorId) =>
    httpClient.request(`/api/pacientes-doctores/${pacienteId}`, {
      method: 'PUT',
      body: { doctorId }
    }),
    
  // Eliminar todas las relaciones de un paciente con doctores
  removeAllPatientDoctors: (pacienteId) =>
    httpClient.request(`/api/pacientes-doctores/${pacienteId}`, {
      method: 'DELETE'
    }),
    
  // Gestión de familiares
  addFamilyMember: async (pacienteId, familyMemberData) => {
    try {
      const response = await httpClient.request(`/api/pacientes/${pacienteId}/familiares`, {
        method: 'POST',
        body: familyMemberData
      });
      return response;
    } catch (error) {
      console.error('Error al agregar familiar:', error);
      throw error;
    }
  },

  // Obtener paciente por usuarioId
  getPacienteByUsuarioId: async function(usuarioId) {
    if (!usuarioId) return null;
    try {
      const paciente = await httpClient.request(`/api/pacientes/usuario/${usuarioId}`);
      return paciente;
    } catch (error) {
      console.error('[userService] Error al obtener paciente por usuarioId:', error);
      return null;
    }
  }
};

// Exportar authManager para uso en otros archivos
export { authManager };

// Interceptor global
export const authInterceptor = {
  request: (config) => {
    const token = authManager.getToken();
    return {
      ...config,
      headers: {
        ...config.headers,
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };
  }
};

export default userService;