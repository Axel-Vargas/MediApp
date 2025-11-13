import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { decryptTriple, decryptFromPacked } from '@/lib/crypto';

export async function POST(req) {
  let connection;
  try {
    const { username, password } = await req.json();
    
    connection = await db.getConnection();
    
    let rows;
    const [candidates] = await connection.query('SELECT * FROM usuarios');
    const matched = candidates.find(u => {
      const candidate = decryptFromPacked(u.usuario) || u.usuario;
      return candidate && String(candidate) === String(username);
    });
    rows = matched ? [matched] : [];
    
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
    }
    
    const usuario = rows[0];
    if (!usuario.contrasena || !(await bcrypt.compare(password, usuario.contrasena))) {
      return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
    }
    
    if (!usuario.rol) {
      usuario.rol = 'paciente';
    }
    
    if (usuario.rol === 'doctor') {
      const [doctorRows] = await connection.query(
        'SELECT autorizado, activo FROM doctores WHERE usuarioId = ?',
        [usuario.id]
      );
      
      if (doctorRows.length === 0) {
        return NextResponse.json({ message: 'Doctor no encontrado en el sistema' }, { status: 401 });
      }
      
      const doctor = doctorRows[0];
      
      if (!doctor.autorizado) {
        return NextResponse.json({ 
          message: 'Su cuenta está pendiente de autorización por el administrador. Por favor, espere a ser aprobado.' 
        }, { status: 403 });
      }
      
      if (doctor.activo === false || doctor.activo === 0) {
        return NextResponse.json({ 
          message: 'Su cuenta ha sido dada de baja. Contacte al administrador para más información.' 
        }, { status: 403 });
      }
    }

    if (usuario.rol === 'paciente') {
      const [pacienteRows] = await connection.query(
        'SELECT activo FROM pacientes WHERE usuarioId = ?',
        [usuario.id]
      );
      
      if (pacienteRows.length > 0) {
        const paciente = pacienteRows[0];
        
        if (paciente.activo === false || paciente.activo === 0) {
          return NextResponse.json({ 
            message: 'Su cuenta ha sido dada de baja. Contacte al administrador para más información.' 
          }, { status: 403 });
        }
      }
    }
    
    const sessionToken = Buffer.from(JSON.stringify({
      id: usuario.id,
      username: usuario.usuario || username,
      rol: usuario.rol,
      timestamp: Date.now()
    })).toString('base64');
    
    try {
      usuario.nombre = decryptTriple(usuario, 'nombre') || decryptFromPacked(usuario.nombre) || usuario.nombre;
      usuario.correo = decryptTriple(usuario, 'correo') || decryptFromPacked(usuario.correo) || usuario.correo;
      usuario.telefono = decryptTriple(usuario, 'telefono') || decryptFromPacked(usuario.telefono) || usuario.telefono;
    } catch (e) {
      console.warn('[login] Fallo descifrando datos de usuario:', e?.message);
    }

    // Creamos la respuesta con los datos del usuario
    const response = NextResponse.json({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: usuario.rol,
      token: sessionToken
    });
    
    // Establecer la cookie del lado del servidor
    response.cookies.set({
      name: 'authToken',
      value: sessionToken,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
        
    return response;
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json({ message: 'Error del servidor' }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/login');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/login:', releaseError);
      }
    }
  }
}