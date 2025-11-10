import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptFromPacked, isDataKeyConfigured } from '@/lib/crypto';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  let connection;
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ message: 'Token y nueva contraseña son requeridos' }, { status: 400 });
    }

    connection = await db.getConnection();

    // Buscar token válido (no usado y no expirado)
    const [rows] = await connection.query(
      `SELECT * FROM tokens_recuperacion_contrasena 
       WHERE token = ? AND usado = 0 AND expira_en > NOW() 
       LIMIT 1`,
      [token]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: 'Token inválido o expirado' }, { status: 400 });
    }

    const record = rows[0];
    
    // Descifrar el correo si está cifrado
    const correoDescifrado = isDataKeyConfigured() ? decryptFromPacked(record.correo) : record.correo;
    
    console.log('[password-reset/confirm] Datos del token:', {
      token: token,
      correoOriginal: record.correo,
      correoDescifrado: correoDescifrado,
      isDataKeyConfigured: isDataKeyConfigured()
    });
    
    // Verificar que el usuario existe antes de actualizar
    let usuarioExiste = false;
    let usuarioId = null;
    
    if (isDataKeyConfigured()) {
      const [allUsers] = await connection.query('SELECT id, correo FROM usuarios');
      
      for (const user of allUsers) {
        const userCorreoDescifrado = decryptFromPacked(user.correo);
        if (userCorreoDescifrado === correoDescifrado) {
          usuarioExiste = true;
          usuarioId = user.id;
          console.log('[password-reset/confirm] Usuario encontrado:', { id: user.id, correo: userCorreoDescifrado });
          break;
        }
      }
    } else {
      const [users] = await connection.query('SELECT id FROM usuarios WHERE correo = ? LIMIT 1', [correoDescifrado]);
      usuarioExiste = users && users.length > 0;
      if (usuarioExiste) {
        usuarioId = users[0].id;
      }
    }
    
    if (!usuarioExiste) {
      console.error('[password-reset/confirm] Usuario no encontrado para correo:', correoDescifrado);
      return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
    }
    
    // Hashear la nueva contraseña con bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Actualizar contraseña del usuario por ID
    const [updateUser] = await connection.query(
      `UPDATE usuarios SET contrasena = ? WHERE id = ? LIMIT 1`,
      [passwordHash, usuarioId]
    );
    if (updateUser.affectedRows !== 1) {
      console.warn('[password-reset/confirm] Usuario no actualizado para correo:', correoDescifrado);
      return NextResponse.json({ message: 'No se pudo actualizar la contraseña del usuario' }, { status: 500 });
    }

    // Marcar token como usado
    await connection.query(
      `UPDATE tokens_recuperacion_contrasena 
       SET usado = 1, actualizado_en = NOW()
       WHERE id = ?`,
      [record.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[password-reset/confirm] Error:', error);
    return NextResponse.json({ message: 'Error del servidor' }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/password-reset/confirm');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/password-reset/confirm:', releaseError);
      }
    }
  }
}
