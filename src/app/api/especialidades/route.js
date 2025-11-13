import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET - Obtener todas las especialidades (incluyendo inactivas para admin)
export async function GET(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    const activas = searchParams.get('activas'); 
    
    connection = await db.getConnection();
    
    let query = 'SELECT id, nombre, activo FROM especialidades';
    const params = [];
    
    const conditions = [];
    
    if (activas === 'true') {
      conditions.push('activo = 1');
    }
    
    if (searchQuery) {
      conditions.push('LOWER(nombre) LIKE ?');
      params.push(`%${searchQuery.toLowerCase()}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY nombre';
    
    const [especialidades] = await connection.query(query, params);
    
    return NextResponse.json(especialidades);
  } catch (error) {
    console.error('Error al obtener especialidades:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener las especialidades', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error al liberar conexión:', releaseError);
      }
    }
  }
}

// POST - Crear nueva especialidad
export async function POST(request) {
  let connection;
  try {
    const data = await request.json();
    
    if (!data.nombre || !data.nombre.trim()) {
      return NextResponse.json(
        { error: 'El nombre de la especialidad es requerido' },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    
    const [existing] = await connection.query(
      'SELECT id FROM especialidades WHERE nombre = ?',
      [data.nombre.trim()]
    );
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una especialidad con ese nombre' },
        { status: 409 }
      );
    }

    // Insertar nueva especialidad
    const [result] = await connection.query(
      'INSERT INTO especialidades (nombre, activo) VALUES (?, ?)',
      [data.nombre.trim(), data.activo !== false ? 1 : 0] 
    );

    return NextResponse.json(
      { 
        id: result.insertId, 
        nombre: data.nombre.trim(), 
        activo: data.activo !== false ? 1 : 0
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Error al crear especialidad:', error);
    return NextResponse.json(
      { error: 'Error al crear la especialidad', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error al liberar conexión:', releaseError);
      }
    }
  }
}

// PUT - Actualizar especialidad existente
export async function PUT(request) {
  let connection;
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json(
        { error: 'El ID de la especialidad es requerido' },
        { status: 400 }
      );
    }
    
    if (!data.nombre || !data.nombre.trim()) {
      return NextResponse.json(
        { error: 'El nombre de la especialidad es requerido' },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    
    // Verificar que la especialidad existe
    const [existing] = await connection.query(
      'SELECT id FROM especialidades WHERE id = ?',
      [data.id]
    );
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si ya existe otra especialidad con ese nombre
    const [duplicate] = await connection.query(
      'SELECT id FROM especialidades WHERE nombre = ? AND id != ?',
      [data.nombre.trim(), data.id]
    );
    
    if (duplicate.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe otra especialidad con ese nombre' },
        { status: 409 }
      );
    }

    // Actualizar especialidad
    await connection.query(
      'UPDATE especialidades SET nombre = ? WHERE id = ?',
      [data.nombre.trim(), data.id]
    );

    return NextResponse.json(
      { 
        id: data.id, 
        nombre: data.nombre.trim(),
        message: 'Especialidad actualizada exitosamente'
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error al actualizar especialidad:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la especialidad', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error al liberar conexión:', releaseError);
      }
    }
  }
}

// DELETE - Activar/Desactivar especialidad
export async function DELETE(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'El ID de la especialidad es requerido' },
        { status: 400 }
      );
    }

    // Obtener el body de la petición
    const body = await request.json();
    const nuevoEstado = body.activo ? 1 : 0;

    connection = await db.getConnection();
    
    // Verificar que la especialidad existe
    const [existing] = await connection.query(
      'SELECT id, activo FROM especialidades WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    // Cambiar el estado activo
    await connection.query(
      'UPDATE especialidades SET activo = ? WHERE id = ?',
      [nuevoEstado, id]
    );
    
    return NextResponse.json(
      { message: `Especialidad ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente` },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error al cambiar estado de especialidad:', error);
    return NextResponse.json(
      { error: 'Error al cambiar estado de la especialidad', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error al liberar conexión:', releaseError);
      }
    }
  }
}

export const dynamic = 'force-dynamic';
