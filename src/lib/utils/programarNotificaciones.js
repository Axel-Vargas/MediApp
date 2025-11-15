import db from '@/lib/db';

// Función para programar notificaciones para una medicación
export async function programarNotificaciones(medicacionId) {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Obtener información de la medicación
    const [medicaciones] = await connection.query(
      `SELECT m.*, u.nombre as nombrePaciente, p.id as pacienteId, m.fechaInicio, m.fechaFin
       FROM medicaciones m
       INNER JOIN pacientes p ON m.pacienteId = p.id
       INNER JOIN usuarios u ON p.usuarioId = u.id
       WHERE m.id = ?`,
      [medicacionId]
    );

    // Importar las funciones de cifrado/descifrado
    const { decryptFromPacked, encryptToPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    // Descifrar los campos de medicación si hay clave configurada
    if (isDataKeyConfigured() && medicaciones.length > 0) {
      try {
        medicaciones[0].nombreMedicamento = decryptFromPacked(medicaciones[0].nombreMedicamento) || medicaciones[0].nombreMedicamento;
        medicaciones[0].dosis = decryptFromPacked(medicaciones[0].dosis) || medicaciones[0].dosis;
      } catch (error) {
        console.error('Error al descifrar datos de medicación:', error);
      }
    }

    console.log('📊 Resultado de la consulta de medicación:', {
      medicacionId,
      encontrada: medicaciones.length > 0,
      activa: medicaciones[0]?.activo,
      query: `SELECT m.*, u.nombre as nombrePaciente, p.id as pacienteId FROM medicaciones m INNER JOIN pacientes p ON m.pacienteId = p.id INNER JOIN usuarios u ON p.usuarioId = u.id WHERE m.id = ${medicacionId}`
    });

    if (medicaciones.length === 0) {
      throw new Error(`Medicación con ID ${medicacionId} no encontrada`);
    }
    
    if (medicaciones[0].activo !== 1) {
      throw new Error(`Medicación con ID ${medicacionId} está inactiva`);
    }

    const medicacion = medicaciones[0];
    
    // Obtener familiares del paciente a través de la tabla de relación
    const [familiares] = await connection.query(
      `SELECT f.*, u.nombre as nombreFamiliar, u.notiWebPush
       FROM familiares f
       INNER JOIN pacientes_familiares pf ON f.id = pf.familiarId
       INNER JOIN pacientes p ON pf.pacienteId = p.id
       INNER JOIN usuarios u ON p.usuarioId = u.id
       WHERE pf.pacienteId = ? AND u.notiWebPush = 1`,
      [medicacion.pacienteId]
    );

    // Descifrar el nombre del paciente si hay clave configurada
    if (isDataKeyConfigured() && medicaciones.length > 0) {
      try {
        medicaciones[0].nombrePaciente = decryptFromPacked(medicaciones[0].nombrePaciente) || medicaciones[0].nombrePaciente;
      } catch (error) {
        console.error('Error al descifrar nombre del paciente:', error);
      }
    }
    
    console.log('👨‍👩‍👧‍👦 Familiares encontrados:', familiares.length);
    console.log('Detalles de la consulta:', {
      query: `SELECT f.*, u.nombre as nombreFamiliar, u.notiWebPush
              FROM familiares f
              INNER JOIN pacientes_familiares pf ON f.id = pf.familiarId
              INNER JOIN pacientes p ON pf.pacienteId = p.id
              INNER JOIN usuarios u ON p.usuarioId = u.id
              WHERE pf.pacienteId = ${medicacion.pacienteId} AND u.notiWebPush = 1`,
      pacienteId: medicacion.pacienteId,
      resultados: familiares
    });

    // Parsear horarios
    let horarios = [];
    try {
      horarios = JSON.parse(medicacion.horario);
    } catch (error) {
      // Si no es JSON, intentar como string simple
      horarios = medicacion.horario ? [medicacion.horario] : ['08:00:00'];
    }

    // Parsear días
    let dias = [];
    if (medicacion.dias) {
      dias = medicacion.dias.split(',').map(dia => dia.trim().toLowerCase());
    }

    // Calcular fechas para las notificaciones
    const fechasNotificaciones = calcularFechasNotificaciones(
      horarios,
      dias,
      medicacion.duracionDias || 7,
      medicacion.fechaInicio, 
      medicacion.fechaFin 
    );

    // Crear notificaciones para cada fecha y horario
    for (const fecha of fechasNotificaciones) {
      // Notificación para el paciente
      const mensajePaciente = `Es hora de tomar ${medicacion.nombreMedicamento} - ${medicacion.dosis}`;
      const mensajePacienteCifrado = isDataKeyConfigured() ? 
        await encryptToPacked(mensajePaciente) : mensajePaciente;
      
      await connection.query(
        `INSERT INTO notificaciones 
          (familiarId, pacienteId, medicacionId, mensaje, destinatario, estado, fechaProgramada)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          null,
          medicacion.pacienteId,
          medicacionId,
          mensajePacienteCifrado,
          'paciente',
          'pendiente',
          fecha
        ]
      );

      // Notificaciones para familiares
      for (const familiar of familiares) {
        const mensajeFamiliar = `${medicacion.nombrePaciente} debe tomar ${medicacion.nombreMedicamento} (${medicacion.dosis}) ahora`;
        const mensajeFamiliarCifrado = isDataKeyConfigured() ? 
          await encryptToPacked(mensajeFamiliar) : mensajeFamiliar;
        
        await connection.query(
          `INSERT INTO notificaciones 
            (familiarId, pacienteId, medicacionId, mensaje,  destinatario, estado, fechaProgramada)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            familiar.id,
            medicacion.pacienteId,
            medicacionId,
            mensajeFamiliarCifrado,
            'familiar',
            'pendiente',
            fecha
          ]
        );
      }
    }

    console.log(`Notificaciones programadas para medicación ${medicacionId}`);
    return fechasNotificaciones.length;

  } catch (error) {
    console.error('Error programando notificaciones:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en programarNotificaciones');
      } catch (releaseError) {
        console.error('Error al liberar conexión en programarNotificaciones:', releaseError);
      }
    }
  }
}

// Función para calcular las fechas de las notificaciones
function calcularFechasNotificaciones(horarios, dias, duracionDias, fechaInicio = null, fechaFin = null) {
  const fechas = [];
  
  // Si se proporcionan fechas de inicio y fin, usarlas; si no, usar la fecha actual
  let fechaInicioCalculada, fechaFinCalculada;
  
  if (fechaInicio && fechaFin) {
    // Usar las fechas proporcionadas por el doctor
    fechaInicioCalculada = new Date(fechaInicio);
    fechaFinCalculada = new Date(fechaFin);
    
    // Asegurar que las fechas estén en el formato correcto
    fechaInicioCalculada.setHours(0, 0, 0, 0);
    fechaFinCalculada.setHours(23, 59, 59, 999);
    
    console.log(`📅 Usando fechas del doctor: ${fechaInicioCalculada.toISOString().split('T')[0]} a ${fechaFinCalculada.toISOString().split('T')[0]}`);
  } else {
    fechaInicioCalculada = new Date();
    fechaFinCalculada = new Date();
    fechaFinCalculada.setDate(fechaFinCalculada.getDate() + duracionDias);
    
    console.log(`📅 Usando fechas por defecto: ${fechaInicioCalculada.toISOString().split('T')[0]} a ${fechaFinCalculada.toISOString().split('T')[0]}`);
  }

  const diasSemana = [
    'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
  ];

  const ahora = new Date();

  // Iterar desde la fecha de inicio hasta la fecha de fin
  for (let fecha = new Date(fechaInicioCalculada); fecha <= fechaFinCalculada; fecha.setDate(fecha.getDate() + 1)) {
    const diaSemana = diasSemana[fecha.getDay()];
    
    // Si hay días específicos configurados, verificar que este día esté incluido
    if (dias.length > 0 && !dias.includes(diaSemana)) {
      continue;
    }

    for (const horario of horarios) {
      const [horas, minutos] = horario.split(':').map(Number);
      const fechaNotificacion = new Date(fecha);
      fechaNotificacion.setHours(horas, minutos, 0, 0);
      
      // ✅ CORREGIDO: Incluir horarios de hoy que aún no han pasado
      // O cualquier fecha futura
      const esHoy = fechaNotificacion.toDateString() === ahora.toDateString();
      const esFuturo = fechaNotificacion > ahora;
      
      if (esFuturo || (esHoy && fechaNotificacion >= ahora)) {
        fechas.push(fechaNotificacion);
        console.log(`✅ Programando notificación para: ${fechaNotificacion.toISOString()} (${diaSemana})`);
      } else {
        console.log(`⏰ Saltando fecha pasada: ${fechaNotificacion.toISOString()} (${diaSemana})`);
      }
    }
  }

  console.log(`📊 Total de notificaciones programadas: ${fechas.length}`);
  return fechas;
}

// Función para limpiar notificaciones antiguas
export async function limpiarNotificacionesAntiguas() {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Eliminar notificaciones de hace más de 30 días
    const [result] = await connection.query(
      `DELETE FROM notificaciones 
       WHERE fechaProgramada < DATE_SUB(NOW(), INTERVAL 30 DAY)
       AND estado IN ('enviada', 'leida', 'cancelada')`
    );

    console.log(`Se eliminaron ${result.affectedRows} notificaciones antiguas`);
    return result.affectedRows;
  } catch (error) {
    console.error('Error limpiando notificaciones antiguas:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en limpiarNotificacionesAntiguas');
      } catch (releaseError) {
        console.error('Error al liberar conexión en limpiarNotificacionesAntiguas:', releaseError);
      }
    }
  }
}
