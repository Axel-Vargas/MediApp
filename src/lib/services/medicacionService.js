const API_URL = '/api/medicaciones';

export const medicacionService = {
  async crearMedicacion(data) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al crear la medicación');
    return await res.json();
  },

  async obtenerMedicacionesPorPaciente(pacienteId) {
    const res = await fetch(`${API_URL}?pacienteId=${pacienteId}`);
    if (!res.ok) throw new Error('Error al obtener medicaciones');
    return await res.json();
  },
};

// Verificar si una medicación ya fue tomada hoy
export const verificarEstadoMedicacion = async (medicacionId, pacienteId, fecha = null) => {
  try {
    const params = new URLSearchParams({ pacienteId });
    
    // Si no se proporciona fecha, usar la fecha actual del cliente (fecha local)
    const fechaActual = fecha || new Date().toLocaleDateString('en-CA'); 
    params.append('fecha', fechaActual);
    
    const response = await fetch(`/api/medicaciones/${medicacionId}/estado?${params}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error al verificar estado de medicación (${response.status})`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en verificarEstadoMedicacion:', error);
    throw new Error(`Error al verificar estado de medicación: ${error.message}`);
  }
};

// Marcar medicación como tomada
export const marcarMedicacionComoTomada = async (medicacionId, pacienteId) => {
  try {
    const response = await fetch(`/api/medicaciones/${medicacionId}/tomar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pacienteId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al marcar medicación como tomada');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en marcarMedicacionComoTomada:', error);
    throw error;
  }
};

// Marcar dosis como perdida
export const marcarDosisPerdida = async (medicacionId, pacienteId, fecha = null) => {
  try {
    const response = await fetch(`/api/medicaciones/${medicacionId}/perdida`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pacienteId, fecha }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al marcar dosis como perdida');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en marcarDosisPerdida:', error);
    throw error;
  }
}; 