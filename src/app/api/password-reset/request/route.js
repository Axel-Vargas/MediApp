import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { randomBytes } from 'crypto';
import { encryptToPacked, decryptFromPacked, isDataKeyConfigured } from '@/lib/crypto';

function generateToken(lengthBytes = 32) {
  const buf = randomBytes(lengthBytes);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function POST(request) {
  let connection;
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ message: 'El correo es requerido' }, { status: 400 });
    }

    connection = await db.getConnection();

    // Verificar que el usuario existe por correo
    let userExists = false;
    
    if (isDataKeyConfigured()) {
      const [allUsers] = await connection.query('SELECT id, usuario, nombre, correo FROM usuarios');
      
      for (const user of allUsers) {
        const correoDescifrado = decryptFromPacked(user.correo);
        if (correoDescifrado === email) {
          userExists = true;
          break;
        }
      }
    } else {
      const [users] = await connection.query('SELECT id, usuario, nombre FROM usuarios WHERE correo = ? LIMIT 1', [email]);
      userExists = users && users.length > 0;
    }
    
    if (!userExists) {
      return NextResponse.json({ success: true });
    }

    const token = generateToken(32);

    const now = new Date();
    const expMs = 20 * 60 * 1000;
    const expira = new Date(now.getTime() + expMs);

    // Asegurar tabla (idempotente)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tokens_recuperacion_contrasena (
        id INT AUTO_INCREMENT PRIMARY KEY,
        correo VARCHAR(191) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expira_en DATETIME NOT NULL,
        usado TINYINT(1) NOT NULL DEFAULT 0,
        creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_trc_correo (correo),
        UNIQUE INDEX uq_trc_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Insertar token con correo cifrado
    const correoCifrado = isDataKeyConfigured() ? encryptToPacked(email) : email;
    
    await connection.query(
      `INSERT INTO tokens_recuperacion_contrasena (correo, token, expira_en, usado, creado_en, actualizado_en)
       VALUES (?, ?, ?, 0, NOW(), NOW())`,
      [correoCifrado, token, expira.toISOString().slice(0, 19).replace('T', ' ')]
    );

    console.log('[password-reset/request] Token creado para', email, 'expira:', expira.toISOString());
    return NextResponse.json({ success: true, token, expiresAt: expira.toISOString() });
  } catch (error) {
    console.error('[password-reset/request] Error:', error);
    return NextResponse.json({ message: 'Error del servidor' }, { status: 500 });
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/password-reset/request');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/password-reset/request:', releaseError);
      }
    }
  }
}
