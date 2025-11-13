import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { encryptAesGcm, decryptTriple, isDataKeyConfigured, encryptToPacked, decryptFromPacked } from '@/lib/crypto';

export async function PUT(request, { params }) {
  let connection;
  try {
    const { id } = params;
    const data = await request.json();
    
    connection = await db.getConnection();
    
    const [user] = await connection.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (user.length === 0) {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error al liberar conexión:', releaseError);
        }
      }
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar solo los campos permitidos
    const allowedFields = ['nombre', 'telefono', 'correo', 'usuario', 'contrasena', 'politicaAceptada', 'politicaFecha'];
    const updateData = {};
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key] !== undefined && data[key] !== '') {
        updateData[key] = data[key];
      }
    });

    if (data.email && !updateData.correo) {
      updateData.correo = data.email;
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos válidos para actualizar' },
        { status: 400 }
      );
    }

    // Preparar actualización: si hay contrasena, hashear
    if (updateData.contrasena) {
      updateData.contrasena = await bcrypt.hash(updateData.contrasena, 10);
    }

    // Si hay clave de datos y hay campos sensibles, cifrarlos empaquetados en la misma columna
    if (isDataKeyConfigured()) {
      if (updateData.nombre !== undefined) updateData.nombre = encryptToPacked(updateData.nombre);
      if (updateData.telefono !== undefined) updateData.telefono = encryptToPacked(updateData.telefono);
      if (updateData.correo !== undefined) updateData.correo = encryptToPacked(updateData.correo);
      if (updateData.usuario !== undefined) updateData.usuario = encryptToPacked(updateData.usuario);
    }

    await connection.query('UPDATE usuarios SET ? WHERE id = ?', [updateData, id]);

    if (data.especialidad !== undefined) {
      const [doctor] = await connection.query('SELECT id FROM doctores WHERE usuarioId = ?', [id]);
      if (doctor.length > 0) {
        await connection.query(
          'UPDATE doctores SET especialidad = ? WHERE usuarioId = ?',
          [parseInt(data.especialidad, 10), id]
        );
      }
    }

    // Obtener el usuario actualizado
    const [updatedUser] = await connection.query(
      'SELECT * FROM usuarios WHERE id = ?', 
      [id]
    );

    if (updatedUser[0] && isDataKeyConfigured()) {
      try {
        updatedUser[0].nombre = decryptTriple(updatedUser[0], 'nombre') || decryptFromPacked(updatedUser[0].nombre) || updatedUser[0].nombre;
        updatedUser[0].telefono = decryptTriple(updatedUser[0], 'telefono') || decryptFromPacked(updatedUser[0].telefono) || updatedUser[0].telefono;
        updatedUser[0].correo = decryptTriple(updatedUser[0], 'correo') || decryptFromPacked(updatedUser[0].correo) || updatedUser[0].correo;
      } catch (_) {}
    }

    return NextResponse.json(updatedUser[0]);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el usuario' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en PUT /api/usuarios/[id]');
      } catch (releaseError) {
        console.error('Error al liberar conexión en PUT /api/usuarios/[id]:', releaseError);
      }
    }
  }
}