import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(request, { params }) {
  let connection;
  try {
    const { pacienteId } = params;
    const data = await request.json();
    const { doctorId } = data;
    
    if (!doctorId) {
      return NextResponse.json(
        { message: 'Se requiere doctorId' },
        { status: 400 }
      );
    }
    
    connection = await db.getConnection();
    
    const [paciente] = await connection.execute(
      'SELECT id FROM usuarios WHERE id = ? AND rol = "paciente"',
      [pacienteId]
    );
    
    if (paciente.length === 0) {
      return NextResponse.json(
        { message: 'Paciente no encontrado' },
        { status: 404 }
      );
    }
    
    const [doctor] = await connection.execute(
      'SELECT id FROM doctores WHERE id = ?',
      [doctorId]
    );
    
    if (doctor.length === 0) {
      return NextResponse.json(
        { message: 'Doctor no encontrado' },
        { status: 404 }
      );
    }
    
    // Eliminar la relación actual del paciente
    await connection.execute(
      'DELETE FROM pacientes_doctores WHERE pacienteId = ?',
      [pacienteId]
    );
    
    // Crear la nueva relación
    const [result] = await connection.execute(
      'INSERT INTO pacientes_doctores (pacienteId, doctorId) VALUES (?, ?)',
      [pacienteId, doctorId]
    );
    
    return NextResponse.json({ 
      id: result.insertId,
      pacienteId,
      doctorId,
      message: 'Doctor actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar doctor del paciente:', error);
    return NextResponse.json(
      { message: 'Error al actualizar doctor del paciente', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en PUT /api/pacientes-doctores/[pacienteId]');
      } catch (releaseError) {
        console.error('Error al liberar conexión en PUT /api/pacientes-doctores/[pacienteId]:', releaseError);
      }
    }
  }
}

export async function DELETE(request, { params }) {
  let connection;
  try {
    const { pacienteId } = params;
    
    connection = await db.getConnection();
    
    // Verificar que el paciente existe
    const [paciente] = await connection.execute(
      'SELECT id FROM usuarios WHERE id = ? AND rol = "paciente"',
      [pacienteId]
    );
    
    if (paciente.length === 0) {
      return NextResponse.json(
        { message: 'Paciente no encontrado' },
        { status: 404 }
      );
    }
    
    // Eliminar todas las relaciones del paciente con doctores
    const [result] = await connection.execute(
      'DELETE FROM pacientes_doctores WHERE pacienteId = ?',
      [pacienteId]
    );
    
    return NextResponse.json({ 
      pacienteId,
      deletedRelations: result.affectedRows,
      message: 'Todas las relaciones con doctores eliminadas exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar relaciones paciente-doctor:', error);
    return NextResponse.json(
      { message: 'Error al eliminar relaciones paciente-doctor', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en DELETE /api/pacientes-doctores/[pacienteId]');
      } catch (releaseError) {
        console.error('Error al liberar conexión en DELETE /api/pacientes-doctores/[pacienteId]:', releaseError);
      }
    }
  }
} 