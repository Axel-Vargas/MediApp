import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Obtener todos los pacientes
export async function GET() {
  let connection;
  try {
    connection = await db.getConnection();
    const [rows] = await connection.query('SELECT * FROM pacientes');
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/pacientes');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/pacientes:', releaseError);
      }
    }
  }
}

// Crear un nuevo paciente
export async function POST(req) {
  let connection;
  try {
    const data = await req.json();
    const { nombre, apellido, edad, genero } = data;
    
    connection = await db.getConnection();
    const [result] = await connection.query(
      'INSERT INTO pacientes (nombre, apellido, edad, genero) VALUES (?, ?, ?, ?)',
      [nombre, apellido, edad, genero]
    );
    return NextResponse.json({ id: result.insertId, ...data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/pacientes');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/pacientes:', releaseError);
      }
    }
  }
}