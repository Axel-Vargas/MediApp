import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptTriple, decryptFromPacked } from '@/lib/crypto';

export async function GET(request, { params }) {
  let connection;
  try {
    const { id: pacienteId } = await params;
    
    connection = await db.getConnection();
    
    const [rows] = await connection.execute(
      `SELECT 
          d.id, 
          d.usuarioId,
          e.nombre as especialidad,
          u.nombre, 
          u.telefono
       FROM doctores d
       JOIN usuarios u ON d.usuarioId = u.id
       JOIN especialidades e ON d.especialidad = e.id
       JOIN pacientes_doctores pd ON d.id = pd.doctorId
       WHERE pd.pacienteId = ?`,
      [pacienteId]
    );

    if (rows.length === 0) {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error al liberar conexión:', releaseError);
        }
      }
      return NextResponse.json(
        { message: 'No se encontró un doctor asignado' },
        { status: 404 }
      );
    }

    const doctor = rows[0];
    
    const doctorDescifrado = {
      ...doctor,
      nombre: decryptTriple(doctor, 'nombre') || decryptFromPacked(doctor.nombre) || doctor.nombre,
      telefono: decryptTriple(doctor, 'telefono') || decryptFromPacked(doctor.telefono) || doctor.telefono,
      especialidad: decryptTriple(doctor, 'especialidad') || decryptFromPacked(doctor.especialidad) || doctor.especialidad
    };

    return NextResponse.json(doctorDescifrado);
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return NextResponse.json(
      { message: 'Error al obtener la información del doctor', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/pacientes/[id]/doctor');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/pacientes/[id]/doctor:', releaseError);
      }
    }
  }
}
