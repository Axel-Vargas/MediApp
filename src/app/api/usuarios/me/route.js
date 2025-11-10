import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptTriple, isDataKeyConfigured, decryptFromPacked } from '@/lib/crypto';

export async function GET(request) {
  let connection;
  try {
    connection = await db.getConnection();    
    // Obtener el token de la cabecera Authorization o de la cookie
    let authToken = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      authToken = authHeader.substring(7);
    } else {
      authToken = request.cookies.get('authToken')?.value;
    }
    

    if (!authToken) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    
    // Decodificar el token para obtener el ID del usuario
    let userId;
    try {
      const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
      userId = tokenData.id;
    } catch (e) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    // Buscar el usuario por su ID
    const [rows] = await connection.query(
      `SELECT 
        *,
        COALESCE(politicaAceptada, 0) as politicaAceptada 
      FROM usuarios 
      WHERE id = ?
      LIMIT 1`,
      [userId]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    
    // Asegurarnos de que el usuario tenga un rol definido
    const usuario = rows[0];
    if (!usuario.rol) {
      usuario.rol = 'paciente';
    }
    // Descifrar datos si corresponde
    if (isDataKeyConfigured()) {
      try {
        usuario.nombre = decryptTriple(usuario, 'nombre') || decryptFromPacked(usuario.nombre) || usuario.nombre;
        usuario.telefono = decryptTriple(usuario, 'telefono') || decryptFromPacked(usuario.telefono) || usuario.telefono;
        usuario.correo = decryptTriple(usuario, 'correo') || decryptFromPacked(usuario.correo) || usuario.correo;
        usuario.usuario = decryptTriple(usuario, 'usuario') || decryptFromPacked(usuario.usuario) || usuario.usuario;
      } catch (_) {}
    }


    // Asegurarnos de que politicaAceptada sea un booleano
    usuario.politicaAceptada = Boolean(usuario.politicaAceptada);

    // Si es un doctor, cargar su especialidad
    if (usuario.rol === 'doctor') {
      try {
        const [doctorData] = await connection.query(`
          SELECT d.especialidad as especialidadId, e.nombre as especialidadNombre
          FROM doctores d
          LEFT JOIN especialidades e ON d.especialidad = e.id
          WHERE d.usuarioId = ?
        `, [usuario.id]);
        
        if (doctorData.length > 0) {
          usuario.especialidadId = doctorData[0].especialidadId;
          usuario.especialidadNombre = doctorData[0].especialidadNombre;
        }
      } catch (err) {
        console.warn('Error al cargar especialidad del doctor:', err);
      }
    }

    // Si es un paciente, cargar sus doctores asignados
    if (usuario.rol === 'paciente') {
      try {
        const [doctores] = await connection.query(`
          SELECT d.id as doctorId, d.especialidad, u.id, u.nombre, u.telefono
          FROM doctores d
          INNER JOIN usuarios u ON d.usuarioId = u.id
          INNER JOIN pacientes_doctores pd ON d.id = pd.doctorId
          WHERE pd.pacienteId = ?
        `, [usuario.id]);
        
        usuario.doctors = doctores;
        usuario.doctorIds = doctores.map(d => d.id); 
      } catch (err) {
        console.warn('Error al cargar doctores del paciente:', err);
        usuario.doctors = [];
        usuario.doctorIds = [];
      }
    }

    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/usuarios/me');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/usuarios/me:', releaseError);
      }
    }
  }
}