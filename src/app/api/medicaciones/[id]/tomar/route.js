import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Función para obtener el inicio de la semana (lunes)
function obtenerInicioSemana(fecha) {
  const dia = fecha.getDay();
  const diff = fecha.getDate() - dia + (dia === 0 ? -6 : 1); 
  const lunes = new Date(fecha.setDate(diff));
  return lunes.toISOString().split('T')[0];
}

// Función para obtener el fin de la semana (domingo)
function obtenerFinSemana(fecha) {
  const inicio = obtenerInicioSemana(new Date(fecha));
  const domingo = new Date(inicio);
  domingo.setDate(domingo.getDate() + 6);
  return domingo.toISOString().split('T')[0];
}

// POST /api/medicaciones/[id]/tomar
export async function POST(request, { params }) {
  let connection;
  try {
    const { id: medicacionId } = await params;
    const { pacienteId } = await request.json();

    if (!medicacionId || isNaN(parseInt(medicacionId))) {
      return NextResponse.json({ message: 'ID de medicación inválido' }, { status: 400 });
    }

    if (!pacienteId || isNaN(parseInt(pacienteId))) {
      return NextResponse.json({ message: 'ID de paciente inválido' }, { status: 400 });
    }

    connection = await db.getConnection();
    
    await connection.beginTransaction();

    try {
      // Verificar que la medicación existe y pertenece al paciente
      const [medicacion] = await connection.query(
        `SELECT id, nombreMedicamento, dosis, dias, horario, activo
         FROM medicaciones 
         WHERE id = ? AND pacienteId = ? AND activo = 1`,
        [medicacionId, pacienteId]
      );

      if (medicacion.length === 0) {
        return NextResponse.json(
          { message: 'Medicación no encontrada o no activa' },
          { status: 404 }
        );
      }

      // Usar la fecha actual del servidor para evitar problemas de zona horaria
      const fechaActual = new Date();
      const fechaHoy = fechaActual.toLocaleDateString('en-CA'); 
      
      console.log(`[API] Fecha actual del servidor: ${fechaHoy}`);
      console.log(`[API] Día de la semana: ${fechaActual.toLocaleDateString('es-ES', { weekday: 'long' })}`);
      console.log(`[API] Fecha ISO: ${fechaActual.toISOString()}`);
      console.log(`[API] Fecha local: ${fechaActual.toString()}`);
      
      // Obtener los días configurados para esta medicación
      const diasConfigurados = medicacion[0].dias ? medicacion[0].dias.split(',').map(d => d.trim().toLowerCase()) : [];
      
      // Verificar si la medicación se debe tomar hoy según los días configurados
      const diaSemana = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      
      // Si hay días configurados, verificar que hoy esté incluido
      if (diasConfigurados.length > 0 && !diasConfigurados.includes(diaSemana)) {
        return NextResponse.json(
          { message: `Esta medicación no se debe tomar los ${fechaActual.toLocaleDateString('es-ES', { weekday: 'long' })}` },
          { status: 400 }
        );
      }
      
      // Si no hay días configurados, usar la lógica original
      if (diasConfigurados.length === 0) {
        const [registroExistente] = await connection.query(
          `SELECT id, tomado 
           FROM historial_tomas 
           WHERE medicacionId = ? 
           AND fechaProgramada >= ? 
           AND fechaProgramada < DATE_ADD(?, INTERVAL 1 DAY)`,
          [medicacionId, fechaHoy, fechaHoy]
        );

        if (registroExistente.length > 0) {
          // Si ya existe un registro y ya está marcado como tomado, devolver error
          if (registroExistente[0].tomado === 1 || registroExistente[0].tomado === true) {
            return NextResponse.json(
              { message: 'Esta medicación ya fue marcada como tomada hoy' },
              { status: 409 }
            );
          }
          
          // Actualizar el registro existente
          await connection.query(
            `UPDATE historial_tomas 
             SET tomado = 1, fechaMarcado = NOW()
             WHERE id = ?`,
            [registroExistente[0].id]
          );
        } else {
          // Crear un nuevo registro usando la fecha actual del servidor
          await connection.query(
            `INSERT INTO historial_tomas 
             (medicacionId, fechaProgramada, tomado, fechaMarcado)
             VALUES (?, NOW(), 1, NOW())`,
            [medicacionId]
          );
        }
      } else {
        // Si hay días configurados, verificar si ya fue tomada en este día de la semana
        const diaSemanaActual = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        
        // Verificar si el día actual está en los días configurados
        if (!diasConfigurados.includes(diaSemanaActual)) {
          return NextResponse.json(
            { message: `Esta medicación no se debe tomar los ${fechaActual.toLocaleDateString('es-ES', { weekday: 'long' })}` },
            { status: 400 }
          );
        }

        // Buscar si ya fue tomada en este día de la semana en la semana actual
        const inicioSemana = obtenerInicioSemana(fechaActual);
        const finSemana = obtenerFinSemana(fechaActual);
        
        const [registroExistente] = await connection.query(
          `SELECT id, tomado 
           FROM historial_tomas 
           WHERE medicacionId = ? 
           AND fechaProgramada >= ? 
           AND fechaProgramada < DATE_ADD(?, INTERVAL 1 DAY)
           AND DAYOFWEEK(fechaProgramada) = DAYOFWEEK(?)
           AND tomado = 1`,
          [medicacionId, inicioSemana, finSemana, fechaActual]
        );

        if (registroExistente.length > 0) {
          return NextResponse.json(
            { message: `Esta medicación ya fue marcada como tomada este ${diaSemanaActual}` },
            { status: 409 }
          );
        }

        // Obtener los horarios configurados para esta medicación
        let horarios = [];
        try {
          horarios = JSON.parse(medicacion[0].horario);
        } catch (error) {
          console.error('Error al parsear horarios:', error);
          horarios = [];
        }
        
        // Encontrar el horario actual disponible
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const toleranceMinutes = 10;
        
        let horarioSeleccionado = null;
        for (const horario of horarios) {
          const [hours, minutes] = horario.split(':').map(Number);
          const horarioEnMinutos = hours * 60 + minutes;
          const horarioConTolerancia = horarioEnMinutos + toleranceMinutes;
          
          if (currentTime >= horarioEnMinutos && currentTime < horarioConTolerancia) {
            horarioSeleccionado = horario;
            break;
          }
        }
        
        if (!horarioSeleccionado) {
          return NextResponse.json(
            { message: 'No hay un horario disponible para marcar como tomado' },
            { status: 400 }
          );
        }
        
        // Crear un nuevo registro con la fecha programada correcta
        const fechaProgramada = `${fechaHoy}T${horarioSeleccionado}`;
        
        console.log(`[API] Marcando medicación ${medicacionId} como tomada:`);
        console.log(`[API] - Horario seleccionado: ${horarioSeleccionado}`);
        console.log(`[API] - Fecha programada: ${fechaProgramada}`);
        
        await connection.query(
          `INSERT INTO historial_tomas 
           (medicacionId, fechaProgramada, tomado, fechaMarcado)
           VALUES (?, ?, 1, NOW())`,
          [medicacionId, fechaProgramada]
        );
      }

      await connection.commit();

      return NextResponse.json({
        message: 'Medicación marcada como tomada exitosamente',
        medicacionId: medicacionId,
        fecha: fechaHoy
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('[API] Error al marcar medicación como tomada:', error);
    return NextResponse.json(
      { message: 'Error al marcar la medicación como tomada', error: error.message },
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