import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { obtenerFechaLocal } from '@/lib/utils/dateHelpers';

// Función para obtener el inicio de la semana (lunes)
function obtenerInicioSemana(fecha) {
  const fechaCopia = new Date(fecha);
  const dia = fechaCopia.getDay();
  const diff = fechaCopia.getDate() - dia + (dia === 0 ? -6 : 1); 
  const lunes = new Date(fechaCopia.setDate(diff));
  return lunes.toISOString().split('T')[0];
}

// Función para obtener el fin de la semana (domingo)
function obtenerFinSemana(fecha) {
  const inicio = obtenerInicioSemana(new Date(fecha));
  const domingo = new Date(inicio);
  domingo.setDate(domingo.getDate() + 6);
  return domingo.toISOString().split('T')[0];
}

// Función auxiliar para verificar si un día está en los días configurados
function esDiaConfigurado(diasConfigurados, dia) {
  if (!diasConfigurados || diasConfigurados.length === 0) return true;
  return diasConfigurados.map(d => d.toLowerCase()).includes(dia.toLowerCase());
}

// GET /api/medicaciones/[id]/estado
export async function GET(request, { params }) {
  let connection;
  try {
    const { id: medicacionId } = await params;
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId');
    const fecha = searchParams.get('fecha') || obtenerFechaLocal();
    
    console.log(`[API] Iniciando verificación de estado para medicación ${medicacionId}, paciente ${pacienteId}, fecha ${fecha}`);
    console.log(`[API] Fecha recibida: "${fecha}"`);
    console.log(`[API] Fecha actual del servidor (local): "${obtenerFechaLocal()}"`);
    console.log(`[API] Día de la semana de la fecha recibida: "${new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })}"`);
    
    if (!medicacionId || isNaN(parseInt(medicacionId))) {
      return NextResponse.json({ message: 'ID de medicación inválido' }, { status: 400 });
    }

    if (!pacienteId || isNaN(parseInt(pacienteId))) {
      return NextResponse.json({ message: 'ID de paciente inválido' }, { status: 400 });
    }

    connection = await db.getConnection();

    const [medicacion] = await connection.query(
      `SELECT id, nombreMedicamento, dosis, dias, horario, activo, fechaInicio, fechaFin
       FROM medicaciones 
       WHERE id = ? AND pacienteId = ? AND activo = 1`,
      [medicacionId, pacienteId]
    );

    // Marcar automáticamente dosis perdidas para esta medicación
    if (medicacion.length > 0) {
      try {
        const medicacionData = medicacion[0];
        
        let horarios = [];
        try {
          if (medicacionData.horario) {
            horarios = JSON.parse(medicacionData.horario);
          }
        } catch (e) {
          horarios = [medicacionData.horario];
        }

        let dias = [];
        if (medicacionData.dias) {
          dias = medicacionData.dias.split(',').map(d => d.trim().toLowerCase());
        }

        // Verificar si debe tomar hoy
        const fechaActual = new Date(fecha + 'T12:00:00'); 
        const diaSemanaActual = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        const debeTomarHoy = dias.length === 0 || dias.includes(diaSemanaActual);

        if (debeTomarHoy && horarios.length > 0) {
          if (medicacion[0].fechaInicio && medicacion[0].fechaFin) {
            const fechaInicio = new Date(medicacion[0].fechaInicio);
            const fechaFin = new Date(medicacion[0].fechaFin);
            const fechaVerificar = new Date(fecha);
            
            if (fechaVerificar < fechaInicio || fechaVerificar > fechaFin) {
              return NextResponse.json({
                medicacionId: medicacionId,
                fecha: fecha,
                yaTomada: false,
                fechaMarcado: null,
                diasConfigurados: dias,
                fueraDeRango: true,
                mensaje: `La fecha ${fecha} está fuera del rango de tratamiento (${medicacion[0].fechaInicio} a ${medicacion[0].fechaFin})`
              });
            }
          }
          
          const [registrosExistentes] = await connection.query(
            `SELECT TIME(fechaProgramada) as horario
             FROM historial_tomas 
             WHERE medicacionId = ? AND DATE(fechaProgramada) = ?`,
            [medicacionId, fecha]
          );

          const horariosRegistrados = registrosExistentes.map(r => r.horario.substring(0, 5));

          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes();
          const toleranceMinutes = 5;

          for (const horario of horarios) {
            const [hours, minutes] = horario.split(':').map(Number);
            const horarioEnMinutos = hours * 60 + minutes;
            const horarioConTolerancia = horarioEnMinutos + toleranceMinutes;
            
            if (horarioConTolerancia <= currentTime && !horariosRegistrados.includes(horario)) {
              const fechaProgramada = `${fecha}T${horario}`;
              
              console.log(`[Estado] Marcando horario ${horario} como perdido para medicación ${medicacionId}`);
              
              await connection.query(
                `INSERT INTO historial_tomas 
                 (medicacionId, fechaProgramada, tomado, fechaMarcado)
                 VALUES (?, ?, 0, NULL)`,
                [medicacionId, fechaProgramada]
              );
            }
          }
        }
      } catch (error) {
        console.error(`[Estado] Error al marcar dosis perdidas para medicación ${medicacionId}:`, error);
      }
    }

    if (medicacion.length === 0) {
      return NextResponse.json(
        { message: 'Medicación no encontrada o no activa' },
        { status: 404 }
      );
    }

    const diasConfigurados = medicacion[0].dias ? medicacion[0].dias.split(',').map(d => d.trim().toLowerCase()) : [];
    
    if (diasConfigurados.length === 0) {
      const [registroExistente] = await connection.query(
        `SELECT id, tomado, fechaMarcado
         FROM historial_tomas 
         WHERE medicacionId = ? AND DATE(fechaProgramada) = ?`,
        [medicacionId, fecha]
      );

      const yaTomada = registroExistente.length > 0 && (registroExistente[0].tomado === 1 || registroExistente[0].tomado === true);

      return NextResponse.json({
        medicacionId: medicacionId,
        fecha: fecha,
        yaTomada: yaTomada,
        fechaMarcado: yaTomada ? registroExistente[0].fechaMarcado : null,
        diasConfigurados: diasConfigurados
      });
    }

    const fechaActual = new Date(fecha + 'T12:00:00'); 
    const diaSemanaActual = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
    
    console.log(`[API] Verificando medicación ${medicacionId}:`);
    console.log(`[API] - Día actual: "${diaSemanaActual}"`);
    console.log(`[API] - Días configurados: [${diasConfigurados.join(', ')}]`);
    
    const debeTomarHoy = diasConfigurados.includes(diaSemanaActual);
    
    console.log(`[API] - Debe tomar hoy: ${debeTomarHoy}`);
    
    // Si no debe tomar hoy, devolver el próximo día programado
    if (!debeTomarHoy) {
      console.log(`[API] - No debe tomar hoy, devolviendo debeTomarHoy: false`);
      return NextResponse.json({
        medicacionId: medicacionId,
        fecha: fecha,
        yaTomada: false,
        fechaMarcado: null,
        diasConfigurados: diasConfigurados,
        debeTomarHoy: false
      });
    }

    let horarios = [];
    try {
      horarios = JSON.parse(medicacion[0].horario);
    } catch (error) {
      console.error('Error al parsear horarios:', error);
      horarios = [];
    }
    
    console.log(`[API] Horarios configurados: [${horarios.join(', ')}]`);
    
    const estadoHorarios = [];
    let yaTomada = false;
    let fechaMarcado = null;
    
    for (const horario of horarios) {
       const fechaProgramada = `${fecha}T${horario}`;
       const fechaProgramadaConEspacio = `${fecha} ${horario}`;
       
       console.log(`[API] Buscando horario ${horario}:`);
       console.log(`[API] - Formato T: "${fechaProgramada}"`);
       console.log(`[API] - Formato espacio: "${fechaProgramadaConEspacio}"`);
       
       const [registroHorario] = await connection.query(
         `SELECT id, tomado, fechaMarcado, fechaProgramada
          FROM historial_tomas 
          WHERE medicacionId = ? 
          AND (fechaProgramada LIKE ? OR fechaProgramada LIKE ?)
          AND tomado = 1`,
         [medicacionId, `${fechaProgramada}%`, `${fechaProgramadaConEspacio}%`]
       );
      
             const horarioTomado = registroHorario.length > 0;
       
       console.log(`[API] - Horario ${horario}: ${horarioTomado ? 'TOMADO' : 'NO TOMADO'}`);
       if (registroHorario.length > 0) {
         console.log(`[API] - Registro encontrado:`, registroHorario[0]);
       }
       
       estadoHorarios.push({
         horario: horario,
         tomado: horarioTomado,
         fechaMarcado: horarioTomado ? registroHorario[0].fechaMarcado : null
       });
       
       if (horarioTomado) {
         yaTomada = true;
         fechaMarcado = registroHorario[0].fechaMarcado;
       }
    }
    
    console.log(`[API] Estado de horarios:`, estadoHorarios);
    
    const tieneHorariosDisponibles = estadoHorarios.some(h => !h.tomado);
    const finalDebeTomarHoy = debeTomarHoy && tieneHorariosDisponibles;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const toleranceMinutes = 5;
    
    let dosisPerdida = false;
    if (debeTomarHoy && horarios.length > 0) {
      const allTimesPassed = horarios.every(horario => {
        const [hours, minutes] = horario.split(':').map(Number);
        const timeInMinutes = hours * 60 + minutes;
        const timeWithTolerance = timeInMinutes + toleranceMinutes;
        const hasPassed = currentTime >= timeWithTolerance;
        
        const horarioTomado = estadoHorarios.find(h => h.horario === horario)?.tomado || false;
        
        return hasPassed && !horarioTomado;
      });
      
      dosisPerdida = allTimesPassed;
    }
    
    console.log(`[API] - Ya tomada: ${yaTomada}`);
    console.log(`[API] - Fecha marcado: ${fechaMarcado}`);
    console.log(`[API] - Tiene horarios disponibles: ${tieneHorariosDisponibles}`);
    console.log(`[API] - Debe tomar hoy (final): ${finalDebeTomarHoy}`);
    console.log(`[API] - Dosis perdida: ${dosisPerdida}`);
    console.log(`[API] - Devolviendo respuesta...`);
    
    const response = {
      medicacionId: medicacionId,
      fecha: fecha,
      yaTomada: yaTomada,
      fechaMarcado: fechaMarcado,
      diasConfigurados: diasConfigurados,
      debeTomarHoy: finalDebeTomarHoy,
      diaSemanaActual: diaSemanaActual,
      estadoHorarios: estadoHorarios,
      dosisPerdida: dosisPerdida
    };
    
    console.log(`[API] Respuesta final:`, response);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('[API] Error al verificar estado de medicación:', error);
    console.error('[API] Stack trace:', error.stack);
    
    return NextResponse.json(
      { 
        message: 'Error al verificar el estado de la medicación', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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

// PUT /api/medicaciones/[id]/estado
export async function PUT(request, { params }) {
  let connection;
  try {
    const { id: medicacionId } = await params;
    const body = await request.json();
    const { active } = body;

    console.log(`[API] Cambiando estado de medicación ${medicacionId} a: ${active}`);

    if (!medicacionId || isNaN(parseInt(medicacionId))) {
      return NextResponse.json({ message: 'ID de medicación inválido' }, { status: 400 });
    }

    if (typeof active !== 'boolean') {
      return NextResponse.json({ message: 'El campo "active" es requerido y debe ser un booleano' }, { status: 400 });
    }

    connection = await db.getConnection();

    const [medicacion] = await connection.query(
      `SELECT id, nombreMedicamento, pacienteId FROM medicaciones WHERE id = ?`,
      [medicacionId]
    );

    if (medicacion.length === 0) {
      return NextResponse.json(
        { message: 'Medicación no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar el estado de la medicación
    await connection.query(
      `UPDATE medicaciones SET activo = ? WHERE id = ?`,
      [active ? 1 : 0, medicacionId]
    );

    console.log(`[API] Estado de medicación ${medicacionId} actualizado exitosamente a: ${active}`);

    return NextResponse.json({
      message: 'Estado de medicación actualizado exitosamente',
      medicacionId: medicacionId,
      active: active
    });

  } catch (error) {
    console.error('[API] Error al cambiar estado de medicación:', error);
    console.error('[API] Stack trace:', error.stack);
    
    return NextResponse.json(
      { 
        message: 'Error al cambiar el estado de la medicación', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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