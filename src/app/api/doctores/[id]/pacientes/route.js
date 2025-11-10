import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptFromPacked, decryptTriple, isDataKeyConfigured } from '@/lib/crypto';

export async function GET(request, { params }) {
  let connection;
  try {
    const { id: userId } = params;
    
    connection = await db.getConnection();
    
    const [doctorRows] = await connection.execute(
      `SELECT id FROM doctores WHERE usuarioId = ?`,
      [userId]
    );
    
    if (doctorRows.length === 0) {
      return NextResponse.json(
        { message: 'Doctor no encontrado' },
        { status: 404 }
      );
    }
    
    const doctorId = doctorRows[0].id;
    
    const [patients] = await connection.execute(
      `SELECT 
          p.id, p.usuarioId,
          u.nombre, u.telefono, u.correo
       FROM pacientes p
       JOIN usuarios u ON p.usuarioId = u.id
       JOIN pacientes_doctores pd ON p.id = pd.pacienteId
       WHERE pd.doctorId = ? AND p.activo = 1`,
      [doctorId]
    );

    if (isDataKeyConfigured()) {
      for (const p of patients) {
        try {
          p.nombre = decryptTriple(p, 'nombre') || decryptFromPacked(p.nombre) || p.nombre;
          p.telefono = decryptTriple(p, 'telefono') || decryptFromPacked(p.telefono) || p.telefono;
          p.correo = decryptTriple(p, 'correo') || decryptFromPacked(p.correo) || p.correo;
        } catch (_) {}
      }
    }

    return NextResponse.json(patients);
  } catch (error) {
    console.error('Error fetching patients for doctor:', error);
    return NextResponse.json(
      { message: 'Error al obtener los pacientes del doctor', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/doctores/[id]/pacientes');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/doctores/[id]/pacientes:', releaseError);
      }
    }
  }
}
