"use client";

import { createContext, useState, useEffect, useContext, useRef, useCallback } from "react";
import { userService, authManager } from "@/lib/services/userService";
import { notificationService } from "@/lib/services/notificationService";
import { marcarDosisPerdidasAutomaticamente, marcarDosisPerdidasDiasAnteriores } from "@/lib/utils/marcarDosisPerdidas";

// Variable global para controlar el marcado automático
let lastMarkingTime = 0;
const MARKING_INTERVAL = 10 * 60 * 1000; 

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const inactivityWarningRef = useRef(null);
  const activityHandlersRef = useRef(new Set());

  // Mostrar advertencia de inactividad
  const showWarning = useCallback(() => {
    if (!user) return; 
    
    if (inactivityWarningRef.current) {
      clearTimeout(inactivityWarningRef.current);
      inactivityWarningRef.current = null;
    }
    
    if (showInactivityWarning) {
      console.log('[showWarning] Modal ya está mostrando, ignorando llamada');
      return;
    }
    
    console.log('[showWarning] Mostrando modal de inactividad');
    setShowInactivityWarning(true);
    
    inactivityWarningRef.current = setTimeout(() => {
      setShowInactivityWarning(false);
      handleInactiveLogout();
    }, 30000);
  }, [user, showInactivityWarning]);
  
  // Manejar cierre de sesión por inactividad
  const handleInactiveLogout = () => {
    if (inactivityWarningRef.current) {
      clearTimeout(inactivityWarningRef.current);
      inactivityWarningRef.current = null;
    }
    setShowInactivityWarning(false);
    handleLogout();
  };
  
  // Extender la sesión cuando el usuario hace clic en "Continuar"
  const handleContinueSession = useCallback(() => {
    if (inactivityWarningRef.current) {
      clearTimeout(inactivityWarningRef.current);
      inactivityWarningRef.current = null;
    }
    
    setShowInactivityWarning(false);
    
    authManager.isWarningActive = false;
    authManager.resetInactivityTimer(handleInactiveLogout, showWarning);
  }, [showWarning]);
  
  // Cargar usuarios sin autenticación (para registro)
  useEffect(() => {
    let isMounted = true;
    
    const loadUsers = async () => {
      try {
        const users = await userService.getAllUsers();
        if (isMounted) {
          setAllUsers(users);
        }
      } catch (err) {
        console.warn("[UserContext] No se pudieron cargar los usuarios:", err);
      }
    };
    
    loadUsers();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Inicializar usuario desde el token (si existe)
  useEffect(() => {
    let isMounted = true;
    
    const checkAuthOnInit = async () => {
      try {
        authManager.clearTimers();
        
        const token = authManager.getToken();
        
        if (!token) {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }
        
        // Obtener datos del usuario
        const me = await userService.getMe();
        
        if (!isMounted) return;
        
        if (me) {
          // Si el usuario es un doctor, cargar sus pacientes asignados
          if (me.rol === 'doctor' && me.id) {
            try {
              const pacientes = await userService.getPatientsByDoctorId(me.id);
              me.patients = pacientes || [];
            } catch (err) {
              console.warn('[checkAuthOnInit] No se pudieron cargar los pacientes del doctor:', err);
              me.patients = [];
            }
          } else {
            me.patients = [];
          }
          
          setUser(me);
        } else {
          // Si no se pudo obtener el usuario, limpiar el token
          authManager.clear();
          setUser(null);
        }
      } catch (err) {
        console.error('[UserContext] Error al validar la sesión:', err);
        if (err.response?.status === 401 || err.message?.includes('No autorizado')) {
          authManager.clear();
        }
        setError('La sesión ha expirado o no es válida. Por favor, inicia sesión nuevamente.');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthOnInit();
  }, []); 

  // Temporizador y listeners de inactividad SOLO si hay usuario autenticado
  useEffect(() => {
    if (!user) {
      authManager.clearTimers();
      setShowInactivityWarning(false);
      if (inactivityWarningRef.current) {
        clearTimeout(inactivityWarningRef.current);
        inactivityWarningRef.current = null;
      }
      return;
    }

    // Configurar el temporizador de inactividad solo si no hay advertencia activa
    if (!authManager.isWarningActive) {
      authManager.resetInactivityTimer(handleInactiveLogout, showWarning);
    }

  const handleUserActivity = () => {
    if (!showInactivityWarning && !authManager.isWarningActive) {
      authManager.resetInactivityTimer(handleInactiveLogout, showWarning);
      
      // Marcar dosis perdidas automáticamente cuando el usuario está activo (solo cada 10 minutos)
      if (user && (user.rol === 'paciente' || user.rol === 'doctor')) {
        const now = Date.now();
        if (now - lastMarkingTime > MARKING_INTERVAL) {
          lastMarkingTime = now;
          
          marcarDosisPerdidasAutomaticamente().catch(error => {
            console.warn('[UserContext] Error al marcar dosis perdidas automáticamente:', error);
          });
        }
      }
    } else {
      console.log('[handleUserActivity] No reseteando timer - showInactivityWarning:', showInactivityWarning, 'isWarningActive:', authManager.isWarningActive);
    }
  };

    // Limpiar event listeners anteriores
    activityHandlersRef.current.forEach(handler => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('scroll', handler);
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
    });
    activityHandlersRef.current.clear();

    // Agregar event listeners para detectar actividad del usuario
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
      activityHandlersRef.current.add(handleUserActivity);
    });

    // Limpiar event listeners y timers al desmontar o cuando user cambie
    return () => {
      activityHandlersRef.current.forEach(handler => {
        window.removeEventListener('mousemove', handler);
        window.removeEventListener('keydown', handler);
        window.removeEventListener('scroll', handler);
        window.removeEventListener('click', handler);
        window.removeEventListener('touchstart', handler);
      });
      activityHandlersRef.current.clear();
      authManager.clearTimers();
      setShowInactivityWarning(false);
      if (inactivityWarningRef.current) {
        clearTimeout(inactivityWarningRef.current);
        inactivityWarningRef.current = null;
      }
    };
  }, [user]); 

  // Marcar dosis perdidas de días anteriores solo cuando el usuario se conecta por primera vez
  useEffect(() => {
    if (user && (user.rol === 'paciente' || user.rol === 'doctor')) {
      marcarDosisPerdidasDiasAnteriores(7).catch(error => {
        console.warn('[UserContext] Error al marcar dosis perdidas de días anteriores:', error);
      });
    }
  }, [user?.id]); 

  // Iniciar sesión
  const handleLogin = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const userData = await userService.login(username, password);
      
      if (userData.rol === 'doctor' && userData.id) {
        try {
          const pacientes = await userService.getPatientsByDoctorId(userData.id);
          userData.patients = pacientes || [];
        } catch (err) {
          console.warn('[handleLogin] No se pudieron cargar los pacientes del doctor:', err);
          userData.patients = [];
        }
      } else {
        userData.patients = [];
      }
      
      setUser(userData);
      setSelectedPatient(null);
      
      // Configurar el temporizador de inactividad después del login
      authManager.resetInactivityTimer(handleInactiveLogout, showWarning);
      
      // Registrar el service worker para notificaciones push después del login exitoso
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          await notificationService.registerServiceWorker();
          
          // Activar notificaciones push para el usuario
          await notificationService.activatePushNotifications(userData.id);
        } catch (error) {
          console.warn('⚠️ No se pudo registrar el service worker:', error);
        }
      }
      
      return userData;
    } catch (error) {
      console.error('Error en handleLogin:', error);
      setError(error.message || 'Error al iniciar sesión');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const handleLogout = () => {
    try {
      authManager.clearTimers();
      setShowInactivityWarning(false);
      if (inactivityWarningRef.current) {
        clearTimeout(inactivityWarningRef.current);
        inactivityWarningRef.current = null;
      }
      
      activityHandlersRef.current.forEach(handler => {
        window.removeEventListener('mousemove', handler);
        window.removeEventListener('keydown', handler);
        window.removeEventListener('scroll', handler);
        window.removeEventListener('click', handler);
        window.removeEventListener('touchstart', handler);
      });
      activityHandlersRef.current.clear();
      
      setUser(null);
      setSelectedPatient(null);
      setError(null);
      
      userService.logout();
    } catch (error) {
      console.error('Error en handleLogout:', error);
    }
  };

  // Agregar familiar
  const handleAddFamilyMember = async (pacienteId, familyMember) => {
    try {
      const response = await fetch(`/api/pacientes/${pacienteId}/familiares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(familyMember),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al agregar familiar');
      }

      const newFamilyMember = await response.json();
      
      return newFamilyMember;
    } catch (error) {
      console.error('Error al agregar familiar:', error);
      throw error;
    }
  };

  // Remover familiar
  const handleRemoveFamilyMember = (memberId) => {
    setUser(prevUser => {
      if (!prevUser.familiares || !Array.isArray(prevUser.familiares)) {
        return prevUser;
      }
      
      return {
        ...prevUser,
        familiares: prevUser.familiares.filter(f => f && f.id !== memberId)
      };
    });
  };

  // Obtener cuidadores (doctores)
  const getCaregivers = (role = "doctor") => {
    return allUsers.filter(user => user.rol === role);
  };

  // Obtener pacientes
  const getPatients = () => {
    return allUsers.filter(user => user.rol === "paciente");
  };

  // Actualizar perfil de usuario
  const updateUserProfile = async (updatedUserData) => {
    try {
      const updatedUser = await userService.updateUser(user.id, updatedUserData);
      setUser(prevUser => ({
        ...prevUser,
        ...updatedUser
      }));
      return updatedUser;
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      throw error;
    }
  };

  // Registrar usuario
  const handleRegister = async (userData) => {
    try {
      const apiData = {
        nombre: userData.name,
        email: userData.email,
        telefono: userData.phone,
        usuario: userData.username,
        contrasena: userData.password,
        rol: userData.rol,
        doctorIds: userData.doctorIds || [] 
      };
      
      // Si es un doctor, incluir la especialidad como número entero
      if (userData.rol === 'doctor' && userData.especialidad) {
        apiData.especialidad = parseInt(userData.especialidad, 10);
      }
      
      const newUser = await userService.createUser(apiData);
            
      return newUser;
    } catch (error) {
      console.error('Error en handleRegister:', error);
      throw error;
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        allUsers,
        selectedPatient,
        loading,
        error,
        setUser,
        setSelectedPatient,
        handleLogin,
        handleLogout,
        handleRegister,
        handleAddFamilyMember,
        handleRemoveFamilyMember,
        updateUser: updateUserProfile,
        getCaregivers,
        getPatients
      }}
    >
      {children}

      {/* Modal de advertencia de inactividad */}
      {showInactivityWarning && user && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">¡Atención!</h3>
            <p className="mb-4">
              Su sesión está a punto de cerrarse por inactividad.
              ¿Desea continuar en el sistema?
            </p>
            <p className="text-sm text-gray-600 mb-4">
              La sesión se cerrará automáticamente por inactividad...
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  handleLogout();
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition-colors"
              >
                Cerrar sesión
              </button>
              <button
                onClick={handleContinueSession}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                autoFocus
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser debe usarse dentro de un UserProvider");
  }
  return context;
};