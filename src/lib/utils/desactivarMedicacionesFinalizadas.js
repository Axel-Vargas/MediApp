import db from '@/lib/db';

export async function desactivarMedicacionesFinalizadas() {
  let connection;
  try {
    connection = await db.getConnection();
    
    console.log('[Desactivar] Verificando medicaciones finalizadas...');
    
    // Buscar medicaciones activas que ya pasaron su fecha de fin
    const [medicacionesFinalizadas] = await connection.query(`
      SELECT 
        id, 
        nombreMedicamento, 
        fechaFin,
        pacienteId
      FROM medicaciones 
      WHERE activo = 1 
        AND fechaFin IS NOT NULL 
        AND fechaFin < CURDATE()
    `);
    
    if (medicacionesFinalizadas.length === 0) {
      console.log('[Desactivar] No hay medicaciones para desactivar');
      return { desactivadas: 0 };
    }
    
    console.log(`[Desactivar] Encontradas ${medicacionesFinalizadas.length} medicaciones finalizadas`);
    
    // Desactivar cada medicación
    const medicacionesIds = medicacionesFinalizadas.map(m => m.id);
    
    const [result] = await connection.query(
      `UPDATE medicaciones 
       SET activo = 0 
       WHERE id IN (?)`,
      [medicacionesIds]
    );
    
    console.log(`[Desactivar] ${result.affectedRows} medicaciones desactivadas exitosamente`);
    
    if (medicacionesIds.length > 0) {
      const [deleteResult] = await connection.query(
        `DELETE FROM notificaciones 
         WHERE medicacionId IN (?) 
           AND estado = 'pendiente' 
           AND fechaProgramada > NOW()`,
        [medicacionesIds]
      );
      
      console.log(`[Desactivar] ${deleteResult.affectedRows} notificaciones futuras eliminadas`);
    }
    
    return {
      desactivadas: result.affectedRows,
      medicaciones: medicacionesFinalizadas.map(m => ({
        id: m.id,
        nombre: m.nombreMedicamento,
        fechaFin: m.fechaFin
      }))
    };
    
  } catch (error) {
    console.error('[Desactivar] Error al desactivar medicaciones finalizadas:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[Desactivar] Error al liberar conexión:', releaseError);
      }
    }
  }
}

/**
 * @param {number} intervaloMinutos 
 */
export function configurarDesactivacionAutomatica(intervaloMinutos = 60) {
  console.log(`[Desactivar] Configurando desactivación automática cada ${intervaloMinutos} minutos`);
  
  desactivarMedicacionesFinalizadas().catch(error => {
    console.error('[Desactivar] Error en ejecución inicial:', error);
  });
  
  // Configurar el temporizador
  const intervaloMs = intervaloMinutos * 60 * 1000;
  
  const timer = setInterval(async () => {
    try {
      await desactivarMedicacionesFinalizadas();
    } catch (error) {
      console.error('[Desactivar] Error en desactivación automática programada:', error);
    }
  }, intervaloMs);
  
  // Retornar función para limpiar el temporizador
  return () => {
    clearInterval(timer);
    console.log('[Desactivar] Temporizador de desactivación automática detenido');
  };
}

