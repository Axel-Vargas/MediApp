import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { programarNotificaciones } from '@/lib/utils/programarNotificaciones';

// GET /api/medicaciones?pacienteId=?
export async function GET(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId');

    connection = await db.getConnection();

    let query = `
      SELECT m.*, v.nombre as viaAdministracionNombre 
      FROM medicaciones m 
      LEFT JOIN vias_administracion v ON m.viaAdministracion = v.id
    `;
    const params = [];
    if (pacienteId) {
      query += ` WHERE m.pacienteId = ?`;
      params.push(pacienteId);
    }

    const [rows] = await connection.query(query, params);
    
    // Importar las funciones de cifrado/descifrado
    const { decryptFromPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    // Si hay clave de cifrado configurada, descifrar los campos
    if (isDataKeyConfigured()) {
      const decryptedRows = rows.map(row => ({
        ...row,
        nombreMedicamento: decryptFromPacked(row.nombreMedicamento) || row.nombreMedicamento,
        dosis: decryptFromPacked(row.dosis) || row.dosis,
        notas: row.notas ? decryptFromPacked(row.notas) : ''
      }));
      
      // Mapear los campos para que coincidan con lo que espera el frontend
      const mappedRows = decryptedRows.map(row => ({
        ...row,
        name: row.nombreMedicamento,
        dosage: row.dosis,
        administrationRoute: row.viaAdministracion,
        administrationRouteName: row.viaAdministracionNombre,
        days: row.dias,
        hours: row.horario,
        notes: row.notas,
        active: row.activo === 1
      }));
      
      return NextResponse.json(mappedRows);
    }
    
    // Si no hay clave de cifrado, mapear los campos para que coincidan con lo que espera el frontend
    const mappedRows = rows.map(row => ({
      ...row,
      name: row.nombreMedicamento,
      dosage: row.dosis,
      administrationRoute: row.viaAdministracion,
      administrationRouteName: row.viaAdministracionNombre,
      days: row.dias,
      hours: row.horario,
      notes: row.notas,
      active: row.activo === 1
    }));
    
    return NextResponse.json(mappedRows);
  } catch (error) {
    console.error('[API] Error al obtener medicaciones:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

// POST /api/medicaciones
export async function POST(request) {
  let connection;
  try {
    const data = await request.json();
    connection = await db.getConnection();

    await connection.beginTransaction();

    // Calcular la duración en días si se proporcionan fechas
    let duracionDias = data.duracionDias || 7;
    
    if (data.fechaInicio && data.fechaFin) {
      const startDate = new Date(data.fechaInicio);
      const endDate = new Date(data.fechaFin);
      
      // Validar que la fecha de fin sea posterior a la de inicio
      if (endDate < startDate) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      
      // Calcular la diferencia en días (redondeando hacia arriba para incluir el día completo)
      const diffTime = Math.abs(endDate - startDate);
      duracionDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Importar las funciones de cifrado
    const { encryptToPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    // Preparar los valores para la inserción
    const valores = [
      data.pacienteId,
      data.dias,
      data.horario,
      duracionDias,
      data.fechaInicio || null,
      data.fechaFin || null,
      data.activo ?? 1
    ];
    
    let campos = 'pacienteId, dias, horario, duracionDias, fechaInicio, fechaFin, activo';
    let placeholders = '?, ?, ?, ?, ?, ?, ?';
    
    if (isDataKeyConfigured()) {
      console.log('[API Medicaciones] Datos recibidos:', {
        notas: data.notas,
        notasType: typeof data.notas,
        notasLength: data.notas ? data.notas.length : 0,
        nombreMedicamento: data.nombreMedicamento
      });
      
      campos = 'pacienteId, nombreMedicamento, viaAdministracion, dosis, dias, horario, duracionDias, fechaInicio, fechaFin, notas, activo';
      placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
      
      valores.splice(1, 0, 
        encryptToPacked(data.nombreMedicamento),
        data.viaAdministracion || null,
        encryptToPacked(data.dosis)
      );
      
      const notasCifradas = data.notas ? encryptToPacked(data.notas) : '';
      console.log('[API Medicaciones] Notas cifradas:', {
        original: data.notas,
        cifradas: notasCifradas,
        cifradasLength: notasCifradas ? notasCifradas.length : 0
      });
      
      valores.splice(valores.length - 1, 0, notasCifradas);
    } else {
      valores.splice(1, 0, data.nombreMedicamento, data.viaAdministracion || null, data.dosis);
      valores.splice(valores.length - 1, 0, data.notas || '');
      campos = 'pacienteId, nombreMedicamento, viaAdministracion, dosis, dias, horario, duracionDias, fechaInicio, fechaFin, notas, activo';
      placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
    }
    
    // Insertar en la base de datos
    const [result] = await connection.query(
      `INSERT INTO medicaciones (${campos}) VALUES (${placeholders})`,
      valores
    );

    const medicacionId = result.insertId;
    
    await connection.commit();

    // Programar notificaciones para la nueva medicación después de confirmar la transacción
    if (data.activo !== false) {
      try {
        await programarNotificaciones(medicacionId);
      } catch (error) {
        console.error('Error programando notificaciones:', error);
      }
    }

    return NextResponse.json({ id: medicacionId, ...data }, { status: 201 });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
  }
}

// PUT /api/medicaciones/:id - Actualizar medicación
export async function PUT(request, { params }) {
  let connection;
  try {
    const { id } = params;
    const data = await request.json();
    connection = await db.getConnection();
    
    // Obtener la medicación actual para comparar cambios
    const [current] = await connection.query(
      'SELECT * FROM medicaciones WHERE id = ?',
      [id]
    );
    
    if (current.length === 0) {
      return NextResponse.json(
        { error: 'Medicación no encontrada' },
        { status: 404 }
      );
    }
    
    const currentMed = current[0];
    
    // Actualizar solo los campos proporcionados
    const updateFields = [];
    const updateValues = [];
    
    // Lista de campos permitidos para actualizar (sin los campos cifrados)
    const allowedFields = [
      'dias', 'horario', 'fechaInicio', 'fechaFin', 'notas', 'activo'
    ];
    
    // Campos que necesitan ser cifrados
    const encryptedFields = ['nombreMedicamento', 'dosis'];
    
    // Importar la función de cifrado
    const { encryptToPacked } = await import('@/lib/crypto');
    
    // Procesar campos normales
    Object.keys(data).forEach(field => {
      if (allowedFields.includes(field) && data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(data[field]);
      }
    });
    
    // Procesar campos cifrados
    Object.keys(data).forEach(field => {
      if (encryptedFields.includes(field) && data[field] !== undefined) {
        const encryptedValue = encryptToPacked(data[field]);
        if (encryptedValue) {
          updateFields.push(`${field} = ?`);
          updateValues.push(encryptedValue);
        }
      }
    });
    
    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      );
    }
    
    updateValues.push(id);
    
    const query = `
      UPDATE medicaciones 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    await connection.query(query, updateValues);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error al actualizar medicación:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

export const dynamic = 'force-dynamic';
