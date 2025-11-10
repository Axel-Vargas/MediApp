import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptFromPacked, isDataKeyConfigured } from '@/lib/crypto';

// GET - Obtener todos los doctores con su estado de autorización
export async function GET() {
  let connection;
  try {
    console.log('Iniciando consulta de doctores...');
    connection = await db.getConnection();
    
    const [rows] = await connection.query(`
      SELECT 
        d.id,
        d.usuarioId,
        d.especialidad,
        d.autorizado,
        d.activo,
        u.nombre,
        u.telefono,
        u.usuario,
        u.fechaRegistro,
        e.nombre as especialidadNombre
      FROM doctores d
      INNER JOIN usuarios u ON d.usuarioId = u.id
      LEFT JOIN especialidades e ON d.especialidad = e.id
      ORDER BY d.autorizado ASC, u.fechaRegistro DESC
    `);
    
    console.log(`Resultado de la consulta:`, {
      rowsCount: rows ? rows.length : 0,
      firstRow: rows && rows[0] ? '...' : 'No hay filas'
    });
    
    if (isDataKeyConfigured()) {
      for (const r of rows) {
        try {
          // Descifrar todos los campos necesarios
          if (r.nombre) r.nombre = decryptFromPacked(r.nombre) || r.nombre;
          if (r.usuario) r.usuario = decryptFromPacked(r.usuario) || r.usuario;
          if (r.telefono) r.telefono = decryptFromPacked(r.telefono) || r.telefono;
        } catch (error) {
          console.error('Error al descifrar datos del doctor:', error);
        }
      }
    }
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error al obtener doctores:', error);
    return NextResponse.json(
      { message: 'Error al obtener los doctores', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/admin/doctores');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/admin/doctores:', releaseError);
      }
    }
  }
}

// PUT - Actualizar el estado de autorización de un doctor
export async function PUT(request) {
  let connection;
  try {
    const { doctorId, autorizado, activo } = await request.json();
    
    if (doctorId === undefined || autorizado === undefined) {
      return NextResponse.json(
        { message: 'doctorId y autorizado son requeridos' },
        { status: 400 }
      );
    }
    
    connection = await db.getConnection();
    
    let updateFields = ['autorizado = ?'];
    let updateValues = [autorizado];
    
    if (activo !== undefined) {
      updateFields.push('activo = ?');
      updateValues.push(activo);
    }
    
    // Actualizar el estado de autorización y activo
    await connection.query(
      `UPDATE doctores SET ${updateFields.join(', ')} WHERE id = ?`,
      [...updateValues, doctorId]
    );
    
    // Obtener el doctor actualizado
    const [updatedDoctor] = await connection.query(`
      SELECT 
        d.id,
        d.usuarioId,
        d.especialidad,
        d.autorizado,
        d.activo,
        u.nombre,
        u.telefono,
        u.usuario,
        u.fechaRegistro,
        e.nombre as especialidadNombre
      FROM doctores d
      INNER JOIN usuarios u ON d.usuarioId = u.id
      LEFT JOIN especialidades e ON d.especialidad = e.id
      WHERE d.id = ?
    `, [doctorId]);

    if (updatedDoctor[0] && isDataKeyConfigured()) {
      try {
        // Descifrar todos los campos necesarios
        const doc = updatedDoctor[0];
        if (doc.nombre) doc.nombre = decryptFromPacked(doc.nombre) || doc.nombre;
        if (doc.usuario) doc.usuario = decryptFromPacked(doc.usuario) || doc.usuario;
        if (doc.telefono) doc.telefono = decryptFromPacked(doc.telefono) || doc.telefono;
      } catch (error) {
        console.error('Error al descifrar datos del doctor actualizado:', error);
      }
    }
    
    if (updatedDoctor.length === 0) {
      return NextResponse.json(
        { message: 'Doctor no encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedDoctor[0]);
  } catch (error) {
    console.error('Error al actualizar doctor:', error);
    return NextResponse.json(
      { message: 'Error al actualizar el doctor', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en PUT /api/admin/doctores');
      } catch (releaseError) {
        console.error('Error al liberar conexión en PUT /api/admin/doctores:', releaseError);
      }
    }
  }
}

// DELETE - Rechazar/eliminar un doctor
export async function DELETE(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('id');
    
    if (!doctorId) {
      return NextResponse.json(
        { message: 'ID del doctor es requerido' },
        { status: 400 }
      );
    }
    
    connection = await db.getConnection();
    
    const [doctorRows] = await connection.query(
      'SELECT usuarioId FROM doctores WHERE id = ?',
      [doctorId]
    );
    
    if (doctorRows.length === 0) {
      return NextResponse.json(
        { message: 'Doctor no encontrado' },
        { status: 404 }
      );
    }
    
    const usuarioId = doctorRows[0].usuarioId;
    
    await connection.query('START TRANSACTION');
    
    try {
      await connection.query('DELETE FROM doctores WHERE id = ?', [doctorId]);
      
      await connection.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);
      
      await connection.query('COMMIT');
      
      return NextResponse.json({ message: 'Doctor eliminado exitosamente' });
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar doctor:', error);
    return NextResponse.json(
      { message: 'Error al eliminar el doctor', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en DELETE /api/admin/doctores');
      } catch (releaseError) {
        console.error('Error al liberar conexión en DELETE /api/admin/doctores:', releaseError);
      }
    }
  }
}