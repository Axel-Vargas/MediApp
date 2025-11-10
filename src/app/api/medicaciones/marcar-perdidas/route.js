import { NextResponse } from 'next/server';
import db from '@/lib/db';

// POST - Marcar automáticamente todas las dosis perdidas
export async function POST() {
  let connection;
  try {
    connection = await db.getConnection();
    
    await connection.beginTransaction();

    // Obtener todas las medicaciones activas
    const [medicaciones] = await connection.query(
      `SELECT id, pacienteId, nombreMedicamento, dosis, dias, horario, activo
       FROM medicaciones 
       WHERE activo = 1`
    );

    if (medicaciones.length === 0) {
      await connection.commit();
      return NextResponse.json({ 
        message: 'No hay medicaciones activas',
        dosisMarcadas: 0 
      });
    }

    let totalDosisMarcadas = 0;
    const now = new Date();
    const toleranceMinutes = 5;
    const fechaActual = now.toISOString().split('T')[0];
    const medicacionesProcesadas = [];

    // Procesar cada medicación
    for (const medicacion of medicaciones) {
      try {
        // Parsear horarios
        let horarios = [];
        try {
          if (medicacion.horario) {
            horarios = JSON.parse(medicacion.horario);
          }
        } catch (e) {
          console.error(`Error al parsear horarios para medicación ${medicacion.id}:`, e);
          continue;
        }

        if (horarios.length === 0) {
          console.log(`[Auto-Perder] Medicación ${medicacion.id} no tiene horarios configurados`);
          continue;
        }

        // Parsear días
        let diasConfigurados = [];
        if (medicacion.dias) {
          diasConfigurados = medicacion.dias.split(',').map(d => d.trim().toLowerCase());
        }

        // Verificar si debe tomar hoy
        const diaSemanaActual = now.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        const debeTomarHoy = diasConfigurados.length === 0 || diasConfigurados.includes(diaSemanaActual);

        if (!debeTomarHoy) {
          console.log(`[Auto-Perder] Medicación ${medicacion.id} no debe tomarse hoy (${diaSemanaActual})`);
          continue;
        }

        // Verificar si la fecha actual está dentro del rango de la medicación
        if (medicacion.fechaInicio && medicacion.fechaFin) {
          const fechaInicio = new Date(medicacion.fechaInicio);
          const fechaFin = new Date(medicacion.fechaFin);
          const fechaActual = new Date(now.toISOString().split('T')[0]);
          
          // Si la fecha actual está antes del inicio o después del fin, no procesar
          if (fechaActual < fechaInicio || fechaActual > fechaFin) {
            console.log(`[Auto-Perder] Medicación ${medicacion.id} no debe procesarse hoy - fuera del rango de tratamiento (${medicacion.fechaInicio} a ${medicacion.fechaFin})`);
            continue;
          }
        }

        // Obtener horarios ya registrados para hoy
        const [registrosExistentes] = await connection.query(
          `SELECT TIME(fechaProgramada) as horario, tomado
           FROM historial_tomas 
           WHERE medicacionId = ? AND DATE(fechaProgramada) = ?`,
          [medicacion.id, fechaActual]
        );

        const horariosRegistrados = registrosExistentes.map(r => r.horario.substring(0, 5));
        const horariosTomados = registrosExistentes
          .filter(r => r.tomado === 1)
          .map(r => r.horario.substring(0, 5));

        // Marcar horarios perdidos
        const currentTime = now.getHours() * 60 + now.getMinutes();
        let dosisMarcadasMedicacion = 0;

        for (const horario of horarios) {
          const [hours, minutes] = horario.split(':').map(Number);
          const horarioEnMinutos = hours * 60 + minutes;
          const horarioConTolerancia = horarioEnMinutos + toleranceMinutes;
          
          // Solo marcar como perdido si ya pasó el horario con tolerancia Y no está ya registrado
          if (horarioConTolerancia <= currentTime && !horariosRegistrados.includes(horario)) {
            const fechaProgramada = `${fechaActual}T${horario}`;
            
            console.log(`[Auto-Perder] Marcando horario ${horario} como perdido para medicación ${medicacion.id} en fecha ${fechaActual}`);
            
            await connection.query(
              `INSERT INTO historial_tomas 
               (medicacionId, fechaProgramada, tomado, fechaMarcado)
               VALUES (?, ?, 0, NULL)`,
              [medicacion.id, fechaProgramada]
            );
            
            dosisMarcadasMedicacion++;
            totalDosisMarcadas++;
          } else if (horarioConTolerancia <= currentTime && horariosRegistrados.includes(horario)) {
            console.log(`[Auto-Perder] Horario ${horario} ya está registrado para medicación ${medicacion.id}, no se duplica`);
          } else if (horarioConTolerancia > currentTime) {
            console.log(`[Auto-Perder] Horario ${horario} aún no ha pasado para medicación ${medicacion.id}, no se marca como perdido`);
          }
        }

        if (dosisMarcadasMedicacion > 0) {
          medicacionesProcesadas.push({
            id: medicacion.id,
            nombre: medicacion.nombreMedicamento,
            dosisMarcadas: dosisMarcadasMedicacion
          });
        }

      } catch (error) {
        console.error(`[Auto-Perder] Error procesando medicación ${medicacion.id}:`, error);
      }
    }

    await connection.commit();

    return NextResponse.json({
      message: totalDosisMarcadas > 0 ? 'Dosis perdidas marcadas automáticamente' : 'No hay dosis nuevas para marcar como perdidas',
      dosisMarcadas: totalDosisMarcadas,
      medicacionesProcesadas: medicaciones.length,
      medicacionesConPerdidas: medicacionesProcesadas,
      fecha: fechaActual,
      timestamp: now.toISOString()
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('[Auto-Perder] Error al marcar dosis perdidas automáticamente:', error);
    return NextResponse.json(
      { message: 'Error al marcar dosis perdidas automáticamente', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// GET - Verificar estado de dosis perdidas
export async function GET() {
  let connection;
  try {
    connection = await db.getConnection();

    const now = new Date();
    const fechaActual = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Obtener medicaciones activas que deberían tener dosis perdidas
    const [medicacionesConPerdidas] = await connection.query(
      `SELECT 
        m.id,
        m.nombreMedicamento,
        m.dias,
        m.horario,
        COUNT(ht.id) as dosisPerdidas,
        COUNT(CASE WHEN ht.tomado = 1 THEN 1 END) as dosisTomadas,
        COUNT(CASE WHEN ht.tomado = 0 THEN 1 END) as dosisPerdidasConfirmadas
       FROM medicaciones m
       LEFT JOIN historial_tomas ht ON m.id = ht.medicacionId 
         AND DATE(ht.fechaProgramada) = ? 
       WHERE m.activo = 1
       GROUP BY m.id`,
      [fechaActual]
    );

    // Procesar los resultados para mostrar información más detallada
    const medicacionesDetalladas = medicacionesConPerdidas.map(med => {
      let horarios = [];
      try {
        horarios = JSON.parse(med.horario);
      } catch (e) {
        horarios = [med.horario];
      }

      let diasConfigurados = [];
      if (med.dias) {
        diasConfigurados = med.dias.split(',').map(d => d.trim().toLowerCase());
      }

      const diaSemanaActual = now.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      const debeTomarHoy = diasConfigurados.length === 0 || diasConfigurados.includes(diaSemanaActual);

      return {
        ...med,
        horarios: horarios,
        diasConfigurados: diasConfigurados,
        debeTomarHoy: debeTomarHoy,
        horariosEsperados: debeTomarHoy ? horarios.length : 0
      };
    });

    return NextResponse.json({
      fecha: fechaActual,
      horaActual: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
      medicacionesConPerdidas: medicacionesDetalladas,
      totalMedicaciones: medicacionesDetalladas.length,
      medicacionesActivasHoy: medicacionesDetalladas.filter(m => m.debeTomarHoy).length
    });

  } catch (error) {
    console.error('[Auto-Perder] Error al verificar estado:', error);
    return NextResponse.json(
      { message: 'Error al verificar estado de dosis perdidas', error: error.message },
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

// PUT - Marcar dosis perdidas de días anteriores específicamente
export async function PUT(request) {
  let connection;
  try {
    const { dias = 7 } = await request.json();
    connection = await db.getConnection();
    
    await connection.beginTransaction();

    // Obtener todas las medicaciones activas
    const [medicaciones] = await connection.query(
      `SELECT id, pacienteId, nombreMedicamento, dosis, dias, horario, activo, fechaInicio, fechaFin
       FROM medicaciones 
       WHERE activo = 1`
    );

    if (medicaciones.length === 0) {
      await connection.commit();
      return NextResponse.json({ 
        message: 'No hay medicaciones activas',
        dosisMarcadas: 0 
      });
    }

    let totalDosisMarcadas = 0;
    const now = new Date();
    const fechaActual = now.toISOString().split('T')[0];
    const medicacionesProcesadas = [];

    // Procesar cada medicación para los días anteriores
    for (const medicacion of medicaciones) {
      try {
        // Parsear horarios
        let horarios = [];
        try {
          if (medicacion.horario) {
            horarios = JSON.parse(medicacion.horario);
          }
        } catch (e) {
          console.error(`Error al parsear horarios para medicación ${medicacion.id}:`, e);
          continue;
        }

        if (horarios.length === 0) {
          continue;
        }

        // Parsear días
        let diasConfigurados = [];
        if (medicacion.dias) {
          diasConfigurados = medicacion.dias.split(',').map(d => d.trim().toLowerCase());
        }

        let dosisMarcadasMedicacion = 0;

        // Procesar días anteriores (excluyendo hoy)
        for (let i = 1; i <= dias; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const fecha = date.toISOString().split('T')[0];
          
          // Verificar si la fecha está dentro del rango de la medicación
          if (medicacion.fechaInicio && medicacion.fechaFin) {
            const fechaInicio = new Date(medicacion.fechaInicio);
            const fechaFin = new Date(medicacion.fechaFin);
            const fechaVerificar = new Date(fecha);
            
            // Si la fecha está antes del inicio o después del fin, no procesar
            if (fechaVerificar < fechaInicio || fechaVerificar > fechaFin) {
              continue;
            }
          }
          
          // Verificar si debe tomar en esta fecha específica
          const fechaEspecifica = new Date(fecha + 'T12:00:00');
          const diaSemana = fechaEspecifica.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
          const debeTomarEnEstaFecha = diasConfigurados.length === 0 || diasConfigurados.includes(diaSemana);

          if (!debeTomarEnEstaFecha) {
            continue;
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

          // Marcar todos los horarios como perdidos para días anteriores que no fueron tomados
          for (const horario of horarios) {
            if (!horariosTomados.includes(horario) && !horariosRegistrados.includes(horario)) {
              const fechaProgramada = `${fecha}T${horario}`;
              
              console.log(`[Auto-Perder] Marcando horario ${horario} como perdido para medicación ${medicacion.id} en fecha anterior ${fecha}`);
              
              await connection.query(
                `INSERT INTO historial_tomas 
                 (medicacionId, fechaProgramada, tomado, fechaMarcado)
                 VALUES (?, ?, 0, NULL)`,
                [medicacion.id, fechaProgramada]
              );
              
              dosisMarcadasMedicacion++;
              totalDosisMarcadas++;
            }
          }
        }

        if (dosisMarcadasMedicacion > 0) {
          medicacionesProcesadas.push({
            id: medicacion.id,
            nombre: medicacion.nombreMedicamento,
            dosisMarcadas: dosisMarcadasMedicacion
          });
        }

      } catch (error) {
        console.error(`[Auto-Perder] Error procesando medicación ${medicacion.id}:`, error);
      }
    }

    await connection.commit();

    return NextResponse.json({
      message: totalDosisMarcadas > 0 ? 'Dosis perdidas de días anteriores marcadas automáticamente' : 'No hay dosis nuevas de días anteriores para marcar como perdidas',
      dosisMarcadas: totalDosisMarcadas,
      medicacionesProcesadas: medicaciones.length,
      medicacionesConPerdidas: medicacionesProcesadas,
      diasProcesados: dias,
      fechaActual: fechaActual,
      timestamp: now.toISOString()
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('[Auto-Perder] Error al marcar dosis perdidas de días anteriores:', error);
    return NextResponse.json(
      { message: 'Error al marcar dosis perdidas de días anteriores', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}