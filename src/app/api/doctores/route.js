import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request) {
  let connection;
  try {
    const data = await request.json();
    const { usuarioId, especialidad, anosExperiencia } = data;
    
    connection = await db.getConnection();
    
    // Insertar el doctor en la tabla doctores
    const [result] = await connection.execute(
      'INSERT INTO doctores (usuarioId, especialidad, anosExperiencia) VALUES (?, ?, ?)',
      [usuarioId, especialidad || '', anosExperiencia || 0]
    );
    
    return NextResponse.json({ 
      id: result.insertId, 
      usuarioId, 
      especialidad, 
      anosExperiencia 
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear doctor:', error);
    return NextResponse.json(
      { message: 'Error al crear el doctor', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/doctores');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/doctores:', releaseError);
      }
    }
  }
} 