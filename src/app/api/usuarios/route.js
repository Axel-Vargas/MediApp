import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { encryptAesGcm, decryptTriple, isDataKeyConfigured, encryptToPacked, decryptFromPacked } from '@/lib/crypto';

// Configurar revalidación: caché por 2 minutos para usuarios (puede cambiar frecuentemente)
export const revalidate = 120; 

export async function GET() {
  let connection;
  try {
    connection = await db.getConnection();    
    console.log('Obteniendo usuarios con rol doctor o paciente...');
    const [rows] = await connection.query(`
      SELECT 
        u.*,
        d.especialidad,
        d.autorizado as doctor_autorizado
      FROM usuarios u
      LEFT JOIN doctores d ON u.id = d.usuarioId
      WHERE (u.rol = 'doctor' AND (d.autorizado = 1 OR d.autorizado = true)) OR u.rol = 'paciente'
      ORDER BY u.nombre
    `);
    console.log(`Se encontraron ${rows.length} usuarios`);

    // Descifrar campos si hay clave configurada
    if (isDataKeyConfigured()) {
      for (const u of rows) {
        try {
          u.nombre = decryptTriple(u, 'nombre') || decryptFromPacked(u.nombre) || u.nombre;
          u.telefono = decryptTriple(u, 'telefono') || decryptFromPacked(u.telefono) || u.telefono;
          u.correo = decryptTriple(u, 'correo') || decryptFromPacked(u.correo) || u.correo;
          if (u.especialidad) {
            u.especialidad = decryptFromPacked(u.especialidad) || u.especialidad;
          }
        } catch (_) {}
      }
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json(
      { message: 'Error al obtener usuarios', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/usuarios');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/usuarios:', releaseError);
      }
    }
  }
}

export async function POST(request) {
  let connection;
  try {
    connection = await db.getConnection();
    console.log('🔗 Conexión adquirida para POST /api/usuarios');
    
    const data = await request.json();
    const { nombre, telefono, usuario, contrasena, rol, doctorIds = [], especialidad = '' } = data;
    const correo = (data.correo || data.email || null);
    
    if (!nombre || !usuario || !contrasena) {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error al liberar conexión:', releaseError);
        }
      }
      return NextResponse.json(
        { message: 'Nombre, usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }
    
    if (isDataKeyConfigured()) {
      const [allUsers] = await connection.query('SELECT id, usuario FROM usuarios');
      for (const u of allUsers) {
        const candidate = decryptFromPacked(u.usuario) || u.usuario;
        if (candidate && String(candidate) === String(usuario)) {
          return NextResponse.json(
            { message: 'El nombre de usuario ya está en uso' },
            { status: 409 }
          );
        }
      }
    } else {
      const [existingUsers] = await connection.query(
        'SELECT id FROM usuarios WHERE usuario = ?',
        [usuario]
      );
      if (existingUsers.length > 0) {
        return NextResponse.json(
          { message: 'El nombre de usuario ya está en uso' },
          { status: 409 }
        );
      }
    }
    
    // Validar unicidad de correo si fue proporcionado
    if (correo) {
      if (isDataKeyConfigured()) {
        const [allByEmail] = await connection.query('SELECT id, correo FROM usuarios');
        for (const u of allByEmail) {
          const emailCandidate = decryptFromPacked(u.correo) || u.correo;
          if (emailCandidate && String(emailCandidate).toLowerCase() === String(correo).toLowerCase()) {
            return NextResponse.json(
              { message: 'El correo electrónico ya está en uso' },
              { status: 409 }
            );
          }
        }
      } else {
        const [existingByEmail] = await connection.query(
          'SELECT id FROM usuarios WHERE correo = ?',
          [correo]
        );
        if (existingByEmail.length > 0) {
          return NextResponse.json(
            { message: 'El correo electrónico ya está en uso' },
            { status: 409 }
          );
        }
      }
    }
    
    // Obtener la fecha actual para fechaRegistro y terminosFecha
    const fechaRegistro = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const terminosFecha = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await connection.query('START TRANSACTION');
    
    try {
      // 1. Hashear contraseña
      const passwordHash = await bcrypt.hash(contrasena, 10);

      // 2. Insertar en columnas existentes; si hay clave, guardar empaquetado (iv.ct.tag)
      let result;
      if (isDataKeyConfigured()) {
        const pNombre = encryptToPacked(nombre);
        const pTelefono = encryptToPacked(telefono || '');
        const pCorreo = encryptToPacked(correo || '');
        const pUsuario = encryptToPacked(usuario);
        [result] = await connection.query(
          `INSERT INTO usuarios (
            nombre, telefono, correo, rol, usuario, contrasena, fechaRegistro,
            politicaAceptada, politicaFecha, terminosAceptados, terminosFecha,
            notiWebPush, notiWhatsapp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pNombre,
            pTelefono,
            pCorreo,
            rol || 'paciente',
            pUsuario,
            passwordHash,
            fechaRegistro,
            0,
            null,
            1,
            terminosFecha,
            1,
            0
          ]
        );
      } else {
        [result] = await connection.query(
          `INSERT INTO usuarios (
            nombre, telefono, correo, rol, usuario, contrasena, fechaRegistro,
            politicaAceptada, politicaFecha, terminosAceptados, terminosFecha,
            notiWebPush, notiWhatsapp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nombre,
            telefono || null,
            correo || null,
            rol || 'paciente',
            usuario,
            passwordHash,
            fechaRegistro,
            0,
            null,
            1,
            terminosFecha,
            1,
            0
          ]
        );
      }
      
      const userId = result.insertId;
      
      // 2. Si es un doctor, crear registro en la tabla doctores (pendiente de autorización)
      if (rol === 'doctor') {
        if (!especialidad) {
          throw new Error('Se requiere una especialidad para el doctor');
        }
        
        const [especialidadExistente] = await connection.query(
          'SELECT id FROM especialidades WHERE id = ?',
          [especialidad]
        );
        
        if (especialidadExistente.length === 0) {
          throw new Error('La especialidad seleccionada no existe');
        }
        
        await connection.query(
          'INSERT INTO doctores (usuarioId, especialidad, autorizado, activo) VALUES (?, ?, ?, ?)',
          [userId, parseInt(especialidad, 10), false, 1]
        );
      }
      
      // 3. Si es un paciente, crear registro en la tabla pacientes
      if (rol === 'paciente') {
        const [pacienteResult] = await connection.query(
          'INSERT INTO pacientes (usuarioId, activo) VALUES (?, 1)',
          [userId]
        );
        
        const pacienteId = pacienteResult.insertId;
        
        // 4. Si se seleccionaron doctores, crear las relaciones en pacientes_doctores
        if (doctorIds && doctorIds.length > 0) {
          const [doctores] = await connection.query(
            'SELECT id FROM doctores WHERE usuarioId IN (?)',
            [doctorIds]
          );
          
          // Crear las relaciones paciente-doctor
          for (const doctor of doctores) {
            await connection.query(
              'INSERT INTO pacientes_doctores (pacienteId, doctorId) VALUES (?, ?)',
              [pacienteId, doctor.id]
            );
          }
        }
      }
      
      await connection.query('COMMIT');
      
      // Obtener el usuario creado y descifrar antes de devolver
      const [newUserRows] = await connection.query(
        'SELECT * FROM usuarios WHERE id = ?',
        [userId]
      );
      const userRow = newUserRows[0];
      if (userRow && isDataKeyConfigured()) {
        try {
          userRow.nombre = decryptFromPacked(userRow.nombre) || decryptTriple(userRow, 'nombre') || userRow.nombre;
          userRow.telefono = decryptFromPacked(userRow.telefono) || decryptTriple(userRow, 'telefono') || userRow.telefono;
          userRow.correo = decryptFromPacked(userRow.correo) || decryptTriple(userRow, 'correo') || userRow.correo;
        } catch (_) {}
      }
      const responseBody = {
        id: userRow.id,
        nombre: userRow.nombre,
        usuario: userRow.usuario,
        rol: userRow.rol,
        correo: userRow.correo,
        terminosAceptados: userRow.terminosAceptados,
        notiWebPush: userRow.notiWebPush
      };
      return NextResponse.json(responseBody, { status: 201 });
      
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error en POST /api/usuarios:', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/usuarios');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/usuarios:', releaseError);
      }
    }
  }
}