import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptFromPacked, decryptTriple, isDataKeyConfigured } from '@/lib/crypto';

// GET - Obtener todos los pacientes
export async function GET() {
  let connection;
  try {
    connection = await db.getConnection();
    
    const [rows] = await connection.query(`
      SELECT 
        p.id,
        p.usuarioId,
        p.activo,
        u.nombre,
        u.telefono,
        u.usuario,
        u.fechaRegistro
      FROM pacientes p
      INNER JOIN usuarios u ON p.usuarioId = u.id
      ORDER BY u.fechaRegistro DESC
    `);
    
    if (isDataKeyConfigured()) {
      for (const r of rows) {
        try {
          r.nombre = decryptTriple(r, 'nombre') || decryptFromPacked(r.nombre) || r.nombre;
          r.telefono = decryptTriple(r, 'telefono') || decryptFromPacked(r.telefono) || r.telefono;
          r.usuario = decryptTriple(r, 'usuario') || decryptFromPacked(r.usuario) || r.usuario;
        } catch (_) {}
      }
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error al obtener pacientes:', error);
    return NextResponse.json(
      { message: 'Error al obtener los pacientes', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/admin/pacientes');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/admin/pacientes:', releaseError);
      }
    }
  }
}

// PUT - Actualizar el estado de un paciente
export async function PUT(request) {
  let connection;
  try {
    const { pacienteId, activo } = await request.json();
    
    if (pacienteId === undefined || activo === undefined) {
      return NextResponse.json(
        { message: 'pacienteId y activo son requeridos' },
        { status: 400 }
      );
    }
    
    connection = await db.getConnection();
    
    await connection.query(
      'UPDATE pacientes SET activo = ? WHERE id = ?',
      [activo, pacienteId]
    );
    
    const [updatedPaciente] = await connection.query(`
      SELECT 
        p.id,
        p.usuarioId,
        p.activo,
        u.nombre,
        u.telefono,
        u.usuario
      FROM pacientes p
      INNER JOIN usuarios u ON p.usuarioId = u.id
      WHERE p.id = ?
    `, [pacienteId]);
    
    if (updatedPaciente.length === 0) {
      return NextResponse.json(
        { message: 'Paciente no encontrado' },
        { status: 404 }
      );
    }
    
    if (updatedPaciente[0] && isDataKeyConfigured()) {
      try {
        updatedPaciente[0].nombre = decryptTriple(updatedPaciente[0], 'nombre') || decryptFromPacked(updatedPaciente[0].nombre) || updatedPaciente[0].nombre;
        updatedPaciente[0].telefono = decryptTriple(updatedPaciente[0], 'telefono') || decryptFromPacked(updatedPaciente[0].telefono) || updatedPaciente[0].telefono;
        updatedPaciente[0].usuario = decryptTriple(updatedPaciente[0], 'usuario') || decryptFromPacked(updatedPaciente[0].usuario) || updatedPaciente[0].usuario;
      } catch (_) {}
    }
    return NextResponse.json(updatedPaciente[0]);
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    return NextResponse.json(
      { message: 'Error al actualizar el paciente', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en PUT /api/admin/pacientes');
      } catch (releaseError) {
        console.error('Error al liberar conexión en PUT /api/admin/pacientes:', releaseError);
      }
    }
  }
}

// DELETE - Eliminar un paciente
export async function DELETE(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('id');
    
    if (!pacienteId) {
      return NextResponse.json(
        { message: 'ID del paciente es requerido' },
        { status: 400 }
      );
    }
    
    connection = await db.getConnection();
    
    const [pacienteRows] = await connection.query(
      'SELECT usuarioId FROM pacientes WHERE id = ?',
      [pacienteId]
    );
    
    if (pacienteRows.length === 0) {
      return NextResponse.json(
        { message: 'Paciente no encontrado' },
        { status: 404 }
      );
    }
    
    const usuarioId = pacienteRows[0].usuarioId;
    
    await connection.query('START TRANSACTION');
    
    try {
      await connection.query('DELETE FROM pacientes WHERE id = ?', [pacienteId]);
      
      await connection.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);
      
      await connection.query('COMMIT');
      
      return NextResponse.json({ message: 'Paciente eliminado exitosamente' });
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    return NextResponse.json(
      { message: 'Error al eliminar el paciente', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en DELETE /api/admin/pacientes');
      } catch (releaseError) {
        console.error('Error al liberar conexión en DELETE /api/admin/pacientes:', releaseError);
      }
    }
  }
} 