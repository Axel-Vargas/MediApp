export async function marcarDosisPerdidasAutomaticamente() {
  try {    
    const response = await fetch('/api/medicaciones/marcar-perdidas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    return result;
  } catch (error) {
    console.error('[Auto-Perder] Error al marcar dosis perdidas automáticamente:', error);
    throw error;
  }
}

// Función para verificar el estado de dosis perdidas
export async function verificarEstadoDosisPerdidas() {
  try {
    const response = await fetch('/api/medicaciones/marcar-perdidas', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[Auto-Perder] Error al verificar estado de dosis perdidas:', error);
    throw error;
  }
}

// Función para configurar un temporizador que marque dosis perdidas cada cierto tiempo
export function configurarMarcadoAutomatico(intervaloMinutos = 5) {
  console.log(`[Auto-Perder] Configurando marcado automático cada ${intervaloMinutos} minutos`);
  
  // Marcar dosis perdidas inmediatamente
  marcarDosisPerdidasAutomaticamente();
  
  // Configurar el temporizador
  const intervaloMs = intervaloMinutos * 60 * 1000;
  
  const timer = setInterval(async () => {
    try {
      await marcarDosisPerdidasAutomaticamente();
    } catch (error) {
      console.error('[Auto-Perder] Error en marcado automático programado:', error);
    }
  }, intervaloMs);
  
  return () => {
    clearInterval(timer);
    console.log('[Auto-Perder] Temporizador de marcado automático detenido');
  };
}

// Función para marcar dosis perdidas de una medicación específica
export async function marcarDosisPerdidasMedicacion(medicacionId, pacienteId, fecha = null, incluirDiasAnteriores = false, diasAnteriores = 7) {
  try {
    const fechaActual = fecha || new Date().toISOString().split('T')[0];
    
    const response = await fetch(`/api/medicaciones/${medicacionId}/perdida`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pacienteId: pacienteId,
        fecha: fechaActual,
        incluirDiasAnteriores: incluirDiasAnteriores,
        diasAnteriores: diasAnteriores
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[Auto-Perder] Dosis perdidas marcadas para medicación ${medicacionId}:`, result);
    
    return result;
  } catch (error) {
    console.error(`[Auto-Perder] Error al marcar dosis perdidas para medicación ${medicacionId}:`, error);
    throw error;
  }
}

// Función para marcar dosis perdidas de días anteriores
export async function marcarDosisPerdidasDiasAnteriores(dias = 7) {
  try {
    
    const response = await fetch('/api/medicaciones/marcar-perdidas', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dias: dias
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();    
    return result;
  } catch (error) {
    console.error('[Auto-Perder] Error al marcar dosis perdidas de días anteriores:', error);
    throw error;
  }
}

// Función para marcar dosis perdidas de todas las medicaciones de un paciente
export async function marcarDosisPerdidasPaciente(pacienteId, fecha = null, incluirDiasAnteriores = false, diasAnteriores = 7) {
  try {
    console.log(`[Auto-Perder] Marcando dosis perdidas para paciente ${pacienteId}...`);
    
    // Primero obtener todas las medicaciones del paciente
    const responseMedicaciones = await fetch(`/api/pacientes/${pacienteId}/medicaciones`, {
      method: 'GET',
    });

    if (!responseMedicaciones.ok) {
      throw new Error(`HTTP error! status: ${responseMedicaciones.status}`);
    }

    const medicaciones = await responseMedicaciones.json();
    const medicacionesActivas = medicaciones.filter(m => m.active);
    
    if (medicacionesActivas.length === 0) {
      console.log(`[Auto-Perder] No hay medicaciones activas para el paciente ${pacienteId}`);
      return { totalDosisMarcadas: 0, medicacionesProcesadas: 0 };
    }

    let totalDosisMarcadas = 0;
    const resultados = [];

    // Procesar cada medicación activa
    for (const medicacion of medicacionesActivas) {
      try {
        const resultado = await marcarDosisPerdidasMedicacion(
          medicacion.id, 
          pacienteId, 
          fecha, 
          incluirDiasAnteriores, 
          diasAnteriores
        );
        
        totalDosisMarcadas += resultado.totalDosisMarcadas || 0;
        resultados.push({
          medicacionId: medicacion.id,
          nombre: medicacion.name,
          resultado: resultado
        });
      } catch (error) {
        console.error(`[Auto-Perder] Error procesando medicación ${medicacion.id}:`, error);
        resultados.push({
          medicacionId: medicacion.id,
          nombre: medicacion.name,
          error: error.message
        });
      }
    }

    return {
      totalDosisMarcadas: totalDosisMarcadas,
      medicacionesProcesadas: medicacionesActivas.length,
      resultados: resultados,
      pacienteId: pacienteId
    };

  } catch (error) {
    console.error(`[Auto-Perder] Error al marcar dosis perdidas para paciente ${pacienteId}:`, error);
    throw error;
  }
} 