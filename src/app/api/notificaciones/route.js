import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Función para generar notificaciones futuras para un familiar
async function generarNotificacionesFuturas(connection, familiarId, pacienteId) {
  // Obtener todas las medicaciones activas del paciente
  const [medicaciones] = await connection.query(
    `SELECT m.*, u.nombre as nombrePaciente 
     FROM medicaciones m
     INNER JOIN pacientes p ON m.pacienteId = p.id
     INNER JOIN usuarios u ON p.usuarioId = u.id
     WHERE m.pacienteId = ? AND m.activo = 1`,
    [pacienteId]
  );

  // Generar notificaciones para los próximos 7 días
  const hoy = new Date();
  const fechaLimite = new Date();
  fechaLimite.setDate(hoy.getDate() + 7);

  for (const medicacion of medicaciones) {
    // Parsear horarios y días de la medicación
    let horarios = [];
    try {
      horarios = JSON.parse(medicacion.horario);
    } catch (error) {
      horarios = medicacion.horario ? [medicacion.horario] : ['08:00:00'];
    }

    let dias = [];
    if (medicacion.dias) {
      dias = medicacion.dias.split(',').map(dia => dia.trim().toLowerCase());
    } else {
      // Si no hay días específicos, asumir todos los días
      dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    }

    // Generar notificaciones para los próximos 7 días
    for (let d = 0; d <= 7; d++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + d);
      
      const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      
      if (dias.includes(diaSemana)) {
        for (const hora of horarios) {
          const [horas, minutos] = hora.split(':');
          const fechaNotificacion = new Date(fecha);
          fechaNotificacion.setHours(parseInt(horas), parseInt(minutos), 0, 0);
          
          // Solo crear notificaciones futuras
          if (fechaNotificacion > hoy) {
            const mensaje = `Recordatorio: ${medicacion.nombrePaciente} debe tomar ${medicacion.nombreMedicamento} - ${medicacion.dosis}`;
            
            // Cifrar el mensaje si hay clave configurada
            const { encryptToPacked, isDataKeyConfigured } = await import('@/lib/crypto');
            const mensajeCifrado = isDataKeyConfigured() ? 
              await encryptToPacked(mensaje) : mensaje;
            
            // Verificar si la notificación ya existe
            const [existe] = await connection.query(
              `SELECT id FROM notificaciones 
               WHERE familiarId = ? AND medicacionId = ? AND fechaProgramada = ?`,
              [familiarId, medicacion.id, fechaNotificacion]
            );
            
            if (existe.length === 0) {
              await connection.query(
                `INSERT INTO notificaciones 
                 (familiarId, pacienteId, medicacionId, mensaje, destinatario, estado, fechaProgramada)
                 VALUES (?, ?, ?, ?, 'familiar', 'pendiente', ?)`,
                [
                  familiarId,
                  pacienteId,
                  medicacion.id,
                  mensajeCifrado,
                  fechaNotificacion
                ]
              );
            }
          }
        }
      }
    }
  }
}

// GET /api/notificaciones?usuarioId=123&rol=paciente|familiar
export async function GET(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');
    const rol = searchParams.get('rol');

    if (!usuarioId || !rol) {
      return NextResponse.json({ error: 'Se requieren usuarioId y rol' }, { status: 400 });
    }

    connection = await db.getConnection();

    // Si es un familiar, generar notificaciones futuras
    if (rol === 'familiar') {
      // Obtener todos los pacientes asociados a este familiar
      const [pacientes] = await connection.query(
        `SELECT pacienteId FROM pacientes_familiares WHERE familiarId = ?`,
        [usuarioId]
      );

      // Generar notificaciones para cada paciente
      for (const { pacienteId } of pacientes) {
        await generarNotificacionesFuturas(connection, usuarioId, pacienteId);
      }
    }

    // Consulta para obtener notificaciones
    let query = `
      SELECT n.*, m.nombreMedicamento, m.dosis
      FROM notificaciones n
      LEFT JOIN medicaciones m ON n.medicacionId = m.id
      WHERE 1=1
    `;
    
    const params = [];

    if (rol === 'paciente') {
      query += ` AND n.pacienteId = ? AND n.destinatario = 'paciente'`;
      params.push(usuarioId);
    } else if (rol === 'familiar') {
      query += ` 
        AND n.familiarId = ? 
        AND n.destinatario = 'familiar'
        AND n.estado = 'pendiente'
        AND n.fechaProgramada >= NOW()
        AND EXISTS (
          SELECT 1 FROM pacientes_familiares pf 
          WHERE pf.familiarId = ? 
          AND pf.pacienteId = n.pacienteId
        )
      `;
      params.push(usuarioId, usuarioId);
    } else {
      return NextResponse.json({ error: 'Rol no válido' }, { status: 400 });
    }

    query += ` ORDER BY n.fechaProgramada ASC`;

    const [rows] = await connection.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}

// POST /api/notificaciones
export async function POST(request) {
  let connection;
  try {
    const data = await request.json();
    connection = await db.getConnection();

    const { encryptToPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    const mensajeCifrado = isDataKeyConfigured() ? 
      await encryptToPacked(data.mensaje) : data.mensaje;

    const [result] = await connection.query(
      `INSERT INTO notificaciones 
        (familiarId, pacienteId, medicacionId, mensaje, estado, fechaProgramada, fechaEnvio)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.familiarId || null,
        data.pacienteId,
        data.medicacionId,
        mensajeCifrado,
        data.estado || 'pendiente',
        data.fechaProgramada,
        data.fechaEnvio || null
      ]
    );

    return NextResponse.json({ id: result.insertId, ...data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
