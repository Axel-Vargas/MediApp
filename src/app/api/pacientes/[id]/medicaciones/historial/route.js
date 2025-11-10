import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET /api/pacientes/[id]/medicaciones/historial
export async function GET(request, { params }) {
  let connection;
  try {
    const { id: pacienteId } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days')) || 7;

    if (!pacienteId || isNaN(parseInt(pacienteId))) {
      return NextResponse.json({ message: 'ID de paciente inválido' }, { status: 400 });
    }

    connection = await db.getConnection();

    // Obtener todas las medicaciones del paciente (activas e inactivas)
    const [medicaciones] = await connection.query(
      `SELECT id, nombreMedicamento, dosis, dias, horario, activo, fechaInicio, fechaFin
       FROM medicaciones 
       WHERE pacienteId = ?`,
      [pacienteId]
    );

    if (medicaciones.length === 0) {
      return NextResponse.json([]);
    }

    // Importar las funciones de cifrado/descifrado
    const { decryptFromPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    // Si hay clave de cifrado configurada, descifrar los campos
    if (isDataKeyConfigured()) {
      const decryptedMedicaciones = medicaciones.map(med => ({
        ...med,
        nombreMedicamento: decryptFromPacked(med.nombreMedicamento) || med.nombreMedicamento,
        dosis: decryptFromPacked(med.dosis) || med.dosis,
        notas: med.notas ? decryptFromPacked(med.notas) : ''
      }));
      
      // Reemplazar el array original con los datos descifrados
      medicaciones.length = 0;
      medicaciones.push(...decryptedMedicaciones);
    } else {
      console.warn('ADVERTENCIA: No hay clave de cifrado configurada (DATA_KEY_HEX)');
    }

    // Función para marcar dosis perdidas automáticamente
    const marcarDosisPerdidas = async (medicacion, fecha) => {
      try {
        // Parsear horarios
        let horarios = [];
        try {
          if (medicacion.horario) {
            horarios = JSON.parse(medicacion.horario);
          }
        } catch (e) {
          console.error(`Error al parsear horarios para medicación ${medicacion.id}:`, e);
          horarios = [];
        }

        if (horarios.length === 0) {
          return 0;
        }

        // Verificar si la fecha está dentro del rango de la medicación
        if (medicacion.fechaInicio && medicacion.fechaFin) {
          const fechaInicio = new Date(medicacion.fechaInicio);
          const fechaFin = new Date(medicacion.fechaFin);
          const fechaVerificar = new Date(fecha);
          
          // Si la fecha está antes del inicio o después del fin, no marcar como perdida
          if (fechaVerificar < fechaInicio || fechaVerificar > fechaFin) {
            return 0;
          }
        }

        // Parsear días configurados
        let diasConfigurados = [];
        if (medicacion.dias) {
          diasConfigurados = medicacion.dias.split(',').map(d => d.trim().toLowerCase());
        }

        // Verificar si debe tomar en esta fecha específica
        const fechaEspecifica = new Date(fecha + 'T12:00:00');
        const diaSemana = fechaEspecifica.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        const debeTomarEnEstaFecha = diasConfigurados.length === 0 || diasConfigurados.includes(diaSemana);

        if (!debeTomarEnEstaFecha) {
          console.log(`[Historial] Medicación ${medicacion.id} no debe tomarse en ${fecha} (${diaSemana})`);
          return 0;
        }

        // Obtener horarios ya registrados para esta fecha
        const [registrosExistentes] = await connection.query(
          `SELECT TIME(fechaProgramada) as horario, tomado
           FROM historial_tomas 
           WHERE medicacionId = ? AND DATE(fechaProgramada) = ?`,
          [medicacion.id, fecha]
        );

        const horariosRegistrados = registrosExistentes.map(r => r.horario.substring(0, 5));
        const horariosTomados = registrosExistentes
          .filter(r => r.tomado === 1)
          .map(r => r.horario.substring(0, 5));

        const toleranceMinutes = 5;
        let dosisMarcadasEnFecha = 0;

        // Marcar horarios perdidos
        for (const horario of horarios) {
          const [hours, minutes] = horario.split(':').map(Number);
          const horarioEnMinutos = hours * 60 + minutes;
          const horarioConTolerancia = horarioEnMinutos + toleranceMinutes;
          
          // Si es un día anterior, marcar todas las dosis como perdidas automáticamente
          // Si es el día actual, solo marcar si ya pasó el horario con tolerancia
          const esDiaAnterior = fecha < fechaActual;
          const yaPasoElHorario = horarioConTolerancia <= currentTime;
          const noEstaRegistrado = !horariosRegistrados.includes(horario);
          
          if ((esDiaAnterior || yaPasoElHorario) && noEstaRegistrado) {
            const fechaProgramada = `${fecha}T${horario}`;
            
            console.log(`[Historial] Marcando horario ${horario} como perdido para medicación ${medicacion.id} en fecha ${fecha} (${esDiaAnterior ? 'día anterior' : 'día actual'})`);
            
            await connection.query(
              `INSERT INTO historial_tomas 
               (medicacionId, fechaProgramada, tomado, fechaMarcado)
               VALUES (?, ?, 0, NULL)`,
              [medicacion.id, fechaProgramada]
            );
            
            dosisMarcadasEnFecha++;
          }
        }

        return dosisMarcadasEnFecha;
      } catch (error) {
        console.error(`[Historial] Error al marcar dosis perdidas para medicación ${medicacion.id}:`, error);
        return 0;
      }
    };

    // Marcar dosis perdidas para todas las medicaciones en los últimos días
    for (const medicacion of medicaciones) {
      console.log(`[Historial] Procesando medicación ${medicacion.id} (${medicacion.nombreMedicamento})`);
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const fecha = date.toISOString().split('T')[0];
        
        await marcarDosisPerdidas(medicacion, fecha);
      }
    }

    // Obtener solo el historial de dosis que ya han sido tomadas u omitidas
    const [historialTomas] = await connection.query(
      `SELECT 
        ht.medicacionId,
        ht.fechaProgramada,
        ht.tomado,
        ht.fechaMarcado,
        m.nombreMedicamento,
        m.dosis
       FROM historial_tomas ht
       INNER JOIN medicaciones m ON ht.medicacionId = m.id
       WHERE m.pacienteId = ? 
       AND ht.fechaProgramada >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY ht.fechaProgramada DESC, TIME(ht.fechaProgramada) DESC`,
      [pacienteId, days]
    );

    // Descifrar los campos de medicación en el historial de tomas si hay clave configurada
    if (isDataKeyConfigured()) {
      for (const registro of historialTomas) {
        try {
          registro.nombreMedicamento = decryptFromPacked(registro.nombreMedicamento) || registro.nombreMedicamento;
          registro.dosis = decryptFromPacked(registro.dosis) || registro.dosis;
        } catch (error) {
          console.error(`Error al descifrar registro del historial:`, error);
        }
      }
    }

    // Procesar y formatear los datos del historial
    const historial = historialTomas.map(registro => {
      // Procesar la fecha de manera más robusta para evitar problemas de zona horaria
      let fecha, hora;
      
      const fechaHora = registro.fechaProgramada;
      
      if (typeof fechaHora === 'string' && fechaHora.includes('T')) {
        // Parsear manualmente para evitar problemas de zona horaria
        const [fechaPart, horaPart] = fechaHora.split('T');
        fecha = fechaPart;
        hora = horaPart?.split('.')[0] || '00:00:00';
      } else if (fechaHora instanceof Date) {
        // Si es un objeto Date, usar métodos que respeten la zona horaria local
        const year = fechaHora.getFullYear();
        const month = String(fechaHora.getMonth() + 1).padStart(2, '0');
        const day = String(fechaHora.getDate()).padStart(2, '0');
        fecha = `${year}-${month}-${day}`;
        
        const hours = String(fechaHora.getHours()).padStart(2, '0');
        const minutes = String(fechaHora.getMinutes()).padStart(2, '0');
        const seconds = String(fechaHora.getSeconds()).padStart(2, '0');
        hora = `${hours}:${minutes}:${seconds}`;
      } else {
        fecha = fechaHora;
        hora = '00:00:00';
      }
      
      // Normalizar la hora para mostrar (solo HH:MM)
      const horaNormalizada = hora.substring(0, 5);
      
      return {
        medicacionId: registro.medicacionId,
        medicacionNombre: registro.nombreMedicamento,
        fecha: fecha,
        horario: horaNormalizada,
        tomada: registro.tomado === 1 || registro.tomado === true,
        perdida: registro.tomado === 0 || registro.tomado === false,
        dosis: registro.dosis,
        fechaMarcado: registro.fechaMarcado
      };
    });

    console.log(`[Historial] Total de registros encontrados: ${historial.length}`);
    console.log(`[Historial] Registros por estado:`);
    console.log(`[Historial] - Tomadas: ${historial.filter(r => r.tomada).length}`);
    console.log(`[Historial] - Omitidas: ${historial.filter(r => r.perdida).length}`);

    return NextResponse.json(historial);
  } catch (error) {
    console.error('[API] Error al obtener historial de medicaciones:', error);
    return NextResponse.json(
      { message: 'Error al obtener el historial de medicaciones', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[API] Error al liberar conexión:', releaseError);
      }
    }
  }
} 