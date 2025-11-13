import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { obtenerFechaLocal, fechaLocalToString } from '@/lib/utils/dateHelpers';

// POST - Marcar dosis como perdida
export async function POST(request, { params }) {
  let connection;
  try {
    const { id: medicacionId } = await params;
    const { pacienteId, fecha, incluirDiasAnteriores = false, diasAnteriores = 7 } = await request.json();

    if (!medicacionId || isNaN(parseInt(medicacionId))) {
      return NextResponse.json({ message: 'ID de medicación inválido' }, { status: 400 });
    }

    if (!pacienteId || isNaN(parseInt(pacienteId))) {
      return NextResponse.json({ message: 'ID de paciente inválido' }, { status: 400 });
    }

    connection = await db.getConnection();
    
    await connection.beginTransaction();

    // Verificar que la medicación existe y pertenece al paciente
    const [medicacion] = await connection.query(
      `SELECT id, nombreMedicamento, dosis, dias, horario, activo, fechaInicio, fechaFin
       FROM medicaciones 
       WHERE id = ? AND pacienteId = ? AND activo = 1`,
      [medicacionId, pacienteId]
    );

    if (medicacion.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { message: 'Medicación no encontrada o no activa' },
        { status: 404 }
      );
    }

    // Obtener los horarios de la medicación
    let horarios = [];
    try {
      horarios = JSON.parse(medicacion[0].horario);
    } catch (error) {
      console.error('Error al parsear horarios:', error);
      horarios = [];
    }

    if (horarios.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { message: 'No hay horarios configurados para esta medicación' },
        { status: 400 }
      );
    }

    // Obtener los días configurados
    let diasConfigurados = [];
    if (medicacion[0].dias) {
      diasConfigurados = medicacion[0].dias.split(',').map(d => d.trim().toLowerCase());
    }

    const now = new Date();
    const toleranceMinutes = 5;
    let totalDosisMarcadas = 0;
    const fechasProcesadas = [];

    // Función para verificar si debe tomar en una fecha específica
    const debeTomarEnFecha = (fechaEspecifica) => {
      if (diasConfigurados.length === 0) {
        return true; 
      }
      
      const fecha = new Date(fechaEspecifica + 'T12:00:00');
      const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      return diasConfigurados.includes(diaSemana);
    };

    // Función para procesar una fecha específica
    const procesarFecha = async (fechaProcesar) => {
      if (!debeTomarEnFecha(fechaProcesar)) {
        console.log(`[API] Medicación ${medicacionId} no debe tomarse en ${fechaProcesar}`);
        return 0;
      }

      // Obtener registros existentes para esta fecha
      const [registrosExistentes] = await connection.query(
        `SELECT TIME(fechaProgramada) as horario, tomado
         FROM historial_tomas 
         WHERE medicacionId = ? AND DATE(fechaProgramada) = ?`,
        [medicacionId, fechaProcesar]
      );

      const horariosRegistrados = registrosExistentes.map(r => r.horario.substring(0, 5));
      const horariosTomados = registrosExistentes
        .filter(r => r.tomado === 1)
        .map(r => r.horario.substring(0, 5));

      console.log(`[API] Fecha ${fechaProcesar}:`);
      console.log(`[API] - Horarios registrados: [${horariosRegistrados.join(', ')}]`);
      console.log(`[API] - Horarios tomados: [${horariosTomados.join(', ')}]`);

      let dosisMarcadasEnFecha = 0;
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const esFechaActual = fechaProcesar === obtenerFechaLocal();

      for (const horario of horarios) {
        const [hours, minutes] = horario.split(':').map(Number);
        const horarioEnMinutos = hours * 60 + minutes;
        const horarioConTolerancia = horarioEnMinutos + toleranceMinutes;

        // Para la fecha actual: solo marcar si ya pasó el horario con tolerancia
        // Para fechas anteriores: marcar todos los horarios que no fueron tomados
        const debeMarcarComoPerdido = esFechaActual 
          ? (horarioConTolerancia <= currentTime && !horariosRegistrados.includes(horario))
          : (!horariosTomados.includes(horario) && !horariosRegistrados.includes(horario));

        if (debeMarcarComoPerdido) {
          const fechaProgramada = `${fechaProcesar}T${horario}`;
          
          console.log(`[API] Marcando horario ${horario} como perdido para medicación ${medicacionId} en fecha ${fechaProcesar}`);
          
          await connection.query(
            `INSERT INTO historial_tomas 
             (medicacionId, fechaProgramada, tomado, fechaMarcado)
             VALUES (?, ?, 0, NULL)`,
            [medicacionId, fechaProgramada]
          );
          
          dosisMarcadasEnFecha++;
        } else if (esFechaActual && horarioConTolerancia <= currentTime && horariosRegistrados.includes(horario)) {
          console.log(`[API] Horario ${horario} ya está registrado para ${fechaProcesar}, no se duplica`);
        } else if (esFechaActual && horarioConTolerancia > currentTime) {
          console.log(`[API] Horario ${horario} aún no ha pasado, no se marca como perdido`);
        }
      }

      return dosisMarcadasEnFecha;
    };

    // Procesar la fecha especificada o la fecha actual
    const fechaProcesar = fecha || obtenerFechaLocal();
    const dosisMarcadasHoy = await procesarFecha(fechaProcesar);
    totalDosisMarcadas += dosisMarcadasHoy;
    fechasProcesadas.push(fechaProcesar);

    if (incluirDiasAnteriores) {
      console.log(`[API] Procesando ${diasAnteriores} días anteriores...`);
      
      for (let i = 1; i <= diasAnteriores; i++) {
        const fechaAnterior = new Date();
        fechaAnterior.setDate(fechaAnterior.getDate() - i);
        const fechaAnteriorStr = fechaLocalToString(fechaAnterior);
        
        // Verificar si la fecha está dentro del rango de la medicación
        if (medicacion[0].fechaInicio && medicacion[0].fechaFin) {
          const fechaInicio = new Date(medicacion[0].fechaInicio);
          const fechaFin = new Date(medicacion[0].fechaFin);
          const fechaVerificar = new Date(fechaAnteriorStr);
          
          // Si la fecha está antes del inicio o después del fin, no procesar
          if (fechaVerificar < fechaInicio || fechaVerificar > fechaFin) {
            continue;
          }
        }
        
        const dosisMarcadasAnterior = await procesarFecha(fechaAnteriorStr);
        totalDosisMarcadas += dosisMarcadasAnterior;
        
        if (dosisMarcadasAnterior > 0) {
          fechasProcesadas.push(fechaAnteriorStr);
        }
      }
    }

    await connection.commit();

    return NextResponse.json({
      message: totalDosisMarcadas > 0 
        ? 'Dosis perdidas marcadas correctamente' 
        : 'No hay dosis nuevas para marcar como perdidas',
      medicacionId: medicacionId,
      fecha: fechaProcesar,
      horarios: horarios,
      diasConfigurados: diasConfigurados,
      totalDosisMarcadas: totalDosisMarcadas,
      fechasProcesadas: fechasProcesadas,
      incluirDiasAnteriores: incluirDiasAnteriores,
      diasAnteriores: incluirDiasAnteriores ? diasAnteriores : 0
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('[API] Error al marcar dosis como perdida:', error);
    return NextResponse.json(
      { message: 'Error al marcar la dosis como perdida', error: error.message },
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