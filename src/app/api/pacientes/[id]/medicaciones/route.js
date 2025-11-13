import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Función para parsear el campo horario
const parseHorario = (horario) => {
  try {
    if (!horario) return [];
    if (Array.isArray(horario)) return horario;
    if (typeof horario === 'string') {
      if (horario.startsWith('[') && horario.endsWith(']')) {
        return JSON.parse(horario);
      }
      return [horario];
    }
    return [];
  } catch (error) {
    console.error('Error al parsear horario:', error);
    return [];
  }
};

// Obtener todas las medicaciones para un paciente específico
export async function GET(request, { params }) {
  let connection;
  try {
    const { id } = params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ message: 'ID de paciente inválido' }, { status: 400 });
    }

    connection = await db.getConnection();

    // Obtener todas las medicaciones del paciente
    const [medicaciones] = await connection.query(
      `SELECT m.id, m.nombreMedicamento as name, m.dosis as dosage, m.viaAdministracion,
              m.dias as days, m.horario as hours, 
              m.duracionDias as durationDays, m.notas as notes,
              m.fechaInicio, m.fechaFin, m.activo,
              v.nombre as viaAdministracionNombre
       FROM medicaciones m
       LEFT JOIN vias_administracion v ON m.viaAdministracion = v.id
       WHERE m.pacienteId = ?`,
      [id]
    );

    const { decryptFromPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    if (!isDataKeyConfigured()) {
      console.warn('ADVERTENCIA: No hay clave de cifrado configurada (DATA_KEY_HEX)');
    }

    // Descifrar datos sensibles
    const medicacionesDescifradas = medicaciones.map(med => {
      const medDescifrado = { ...med };
      
      if (isDataKeyConfigured()) {
        medDescifrado.name = decryptFromPacked(med.name) || med.name;
        medDescifrado.dosage = decryptFromPacked(med.dosage) || med.dosage;
        if (med.notes) {
          medDescifrado.notes = decryptFromPacked(med.notes) || med.notes;
        }
      }
      
      // Mapear campos comunes (con o sin cifrado)
      medDescifrado.administrationRoute = med.viaAdministracion; 
      medDescifrado.administrationRouteName = med.viaAdministracionNombre; 
      
      return medDescifrado;
    });

    // Parsear los horarios de JSON a array y mapear el campo activo
    const medicacionesConHorarios = medicacionesDescifradas.map(med => ({
      ...med,
      hours: parseHorario(med.hours),
      days: med.days ? med.days.split(',').map(d => d.trim()) : [],
      active: med.activo === 1
    }));

    return NextResponse.json(medicacionesConHorarios);
  } catch (error) {
    console.error('[API] Error al obtener medicaciones:', error);
    return NextResponse.json(
      { message: 'Error al obtener las medicaciones', error: error.message },
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

// Crear una nueva medicación para un paciente específico
export async function POST(request, { params }) {
  let connection;
  try {
    const { id } = params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ message: 'ID de paciente inválido' }, { status: 400 });
    }

    connection = await db.getConnection();
    
    await connection.beginTransaction();

    const data = await request.json();

    const horasArray = Array.isArray(data.hours) ? data.hours : 
                      (data.hours ? [data.hours] : ['08:00:00']);

    const { encryptToPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    if (!isDataKeyConfigured()) {
      console.warn('ADVERTENCIA: No hay clave de cifrado configurada (DATA_KEY_HEX)');
    }

    const nombreCifrado = isDataKeyConfigured() ? encryptToPacked(data.name) : data.name;
    const dosisCifrada = isDataKeyConfigured() ? encryptToPacked(data.dosage) : data.dosage;
    const viaAdministracionId = data.administrationRoute || null; 
    const notasCifradas = data.notes && isDataKeyConfigured() ? encryptToPacked(data.notes) : (data.notes || '');
    
    const [result] = await connection.query(
      `INSERT INTO medicaciones 
       (pacienteId, nombreMedicamento, viaAdministracion, dosis, dias, horario, duracionDias, fechaInicio, fechaFin, notas, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        nombreCifrado,
        viaAdministracionId,
        dosisCifrada,
        Array.isArray(data.days) ? data.days.join(',') : (data.days || ''),
        JSON.stringify(horasArray),
        data.durationDays || 7,
        data.fechaInicio || null,
        data.fechaFin || null,
        notasCifradas,
        1
      ]
    );

    // Obtener la medicación recién creada
    const [nuevaMedicacion] = await connection.query(
      `SELECT m.id, m.nombreMedicamento as name, m.dosis as dosage, m.viaAdministracion,
              m.dias as days, m.horario as hours, 
              m.duracionDias as durationDays, m.notas as notes,
              v.nombre as viaAdministracionNombre
       FROM medicaciones m
       LEFT JOIN vias_administracion v ON m.viaAdministracion = v.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    await connection.commit();

    return NextResponse.json(
      {
        ...nuevaMedicacion[0],
        days: nuevaMedicacion[0].days ? nuevaMedicacion[0].days.split(',').map(d => d.trim()) : [],
        hours: parseHorario(nuevaMedicacion[0].hours)
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('[API] Error al crear medicación:', error);
    return NextResponse.json(
      { message: 'Error al crear la medicación', error: error.message },
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