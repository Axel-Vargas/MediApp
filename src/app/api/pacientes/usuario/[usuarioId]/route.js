import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET /api/pacientes/usuario/[usuarioId]
export async function GET(request, { params }) {
  let connection;
  try {
    const { usuarioId } = await params;
    if (!usuarioId || isNaN(parseInt(usuarioId))) {
      return NextResponse.json({ message: 'usuarioId inválido' }, { status: 400 });
    }

    connection = await db.getConnection();
    const [rows] = await connection.query('SELECT * FROM pacientes WHERE usuarioId = ?', [usuarioId]);
    if (rows.length === 0) {
      // Liberar conexión antes de retornar
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error al liberar conexión:', releaseError);
        }
      }
      return NextResponse.json({ message: 'Paciente no encontrado' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/pacientes/usuario/[usuarioId]');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/pacientes/usuario/[usuarioId]:', releaseError);
      }
    }
  }
} 