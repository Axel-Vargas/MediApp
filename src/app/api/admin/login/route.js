import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { decryptTriple, decryptFromPacked } from '@/lib/crypto';

// Función segura para descifrar
const safeDecrypt = (value) => {
  if (!value) return value;
  
  if (typeof value !== 'string' || !value.includes('.')) {
    return value;
  }
  
  try {
    const decrypted = decryptFromPacked(value);
    if (decrypted && decrypted !== value) {
      return decrypted;
    }
    
    const tripleDecrypted = decryptTriple({ value });
    if (tripleDecrypted && tripleDecrypted !== value) {
      return tripleDecrypted;
    }
    
    return value;
  } catch (error) {
    console.warn('Error al descifrar valor:', error.message);
    return value;
  }
};

export async function POST(request) {
  let connection;
  try {
    const { usuario: username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    console.log('Iniciando proceso de login para admin:', username);
    
    connection = await db.getConnection();
    
    const [candidates] = await connection.query("SELECT * FROM usuarios WHERE rol = 'admin'");
    console.log(`Se encontraron ${candidates.length} administradores`);
    
    const admin = candidates.find(u => {
      try {
        if (String(u.usuario).trim() === String(username).trim()) {
          return true;
        }
        
        const dbUsername = safeDecrypt(u.usuario);
        console.log(`Comparando usuario cifrado: ${u.usuario}`);
        console.log(`Usuario descifrado: ${dbUsername}`);
        console.log(`Usuario ingresado: ${username}`);
        
        return String(dbUsername).trim().toLowerCase() === String(username).trim().toLowerCase();
      } catch (error) {
        console.warn('Error al comparar usuario:', error.message);
        return false;
      }
    });
    
    console.log('Admin encontrado:', admin ? 'Sí' : 'No');
    console.log('Administrador encontrado:', admin ? 'Sí' : 'No');
    
    if (!admin) {
      return NextResponse.json(
        { error: "Credenciales inválidas o no eres administrador" },
        { status: 401 }
      );
    }
    
    if (!admin.contrasena || !(await bcrypt.compare(password, admin.contrasena))) {
      console.log('Contraseña inválida');
      return NextResponse.json(
        { error: "Credenciales inválidas o no eres administrador" },
        { status: 401 }
      );
    }
    
    // Descifrar campos sensibles de forma segura
    admin.nombre = safeDecrypt(admin.nombre);
    admin.correo = safeDecrypt(admin.correo);
    admin.telefono = safeDecrypt(admin.telefono);
    admin.usuario = safeDecrypt(admin.usuario);
    
    console.log('Datos del administrador descifrados:', {
      usuario: admin.usuario,
      nombre: admin.nombre
    });
    
    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        usuario: admin.usuario,
        nombre: admin.nombre,
        correo: admin.correo,
        telefono: admin.telefono,
        rol: admin.rol,
      },
    });

  } catch (error) {
    console.error("Error en login de administrador:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/admin/login');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/admin/login:', releaseError);
      }
    }
  }
} 