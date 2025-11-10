import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request) {
  let connection;
  try {
    const data = await request.json();
    const { pacienteId, doctorId } = data;
    
    if (!pacienteId || !doctorId) {
      return NextResponse.json(
        { message: 'Se requiere pacienteId y doctorId' },
        { status: 400 }
      );
    }
    
    connection = await db.getConnection();
    
    // Verificar que la relación no exista ya
    const [existingRelation] = await connection.execute(
      'SELECT id FROM pacientes_doctores WHERE pacienteId = ? AND doctorId = ?',
      [pacienteId, doctorId]
    );
    
    if (existingRelation.length > 0) {
      return NextResponse.json(
        { message: 'El paciente ya está asignado a este doctor' },
        { status: 409 }
      );
    }
    
    // Insertar la relación paciente-doctor
    const [result] = await connection.execute(
      'INSERT INTO pacientes_doctores (pacienteId, doctorId) VALUES (?, ?)',
      [pacienteId, doctorId]
    );
    
    return NextResponse.json({ 
      id: result.insertId,
      pacienteId,
      doctorId,
      message: 'Paciente asignado al doctor exitosamente'
    }, { status: 201 });
  } catch (error) {
    console.error('Error al asignar paciente al doctor:', error);
    return NextResponse.json(
      { message: 'Error al asignar paciente al doctor', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/pacientes-doctores');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/pacientes-doctores:', releaseError);
      }
    }
  }
} 