import { NextResponse } from 'next/server';
import db from '@/lib/db';

// GET /api/vias-administracion
export async function GET(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const activas = searchParams.get('activas');

    connection = await db.getConnection();

    let query = `
      SELECT id, nombre, activo 
      FROM vias_administracion 
    `;
    
    const params = [];
    
    if (activas === 'true') {
      query += ' WHERE activo = 1';
    }
    
    query += ' ORDER BY nombre';

    const [rows] = await connection.query(query, params);
    
    return NextResponse.json(rows);
    
  } catch (error) {
    console.error('[API] Error al obtener vías de administración:', error);
    return NextResponse.json(
      { error: 'Error al obtener las vías de administración', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[API] Error al liberar conexión:', releaseError);
      }
    }
  }
}

// POST /api/vias-administracion (para crear nuevas vías)
export async function POST(request) {
  let connection;
  try {
    const data = await request.json();
    
    if (!data.nombre) {
      return NextResponse.json(
        { error: 'El nombre de la vía de administración es requerido' },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    
    // Verificar si ya existe una vía con ese nombre
    const [existing] = await connection.query(
      'SELECT id FROM vias_administracion WHERE nombre = ?',
      [data.nombre]
    );
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una vía de administración con ese nombre' },
        { status: 409 }
      );
    }

    // Insertar nueva vía de administración
    const [result] = await connection.query(
      'INSERT INTO vias_administracion (nombre, activo) VALUES (?, ?)',
      [data.nombre, data.activo !== false]
    );

    return NextResponse.json(
      { 
        id: result.insertId, 
        nombre: data.nombre, 
        activo: data.activo !== false 
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('[API] Error al crear vía de administración:', error);
    return NextResponse.json(
      { error: 'Error al crear la vía de administración', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[API] Error al liberar conexión:', releaseError);
      }
    }
  }
}

// PUT /api/vias-administracion (para actualizar vías existentes)
export async function PUT(request) {
  let connection;
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json(
        { error: 'El ID de la vía de administración es requerido' },
        { status: 400 }
      );
    }
    
    if (!data.nombre || !data.nombre.trim()) {
      return NextResponse.json(
        { error: 'El nombre de la vía de administración es requerido' },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    
    // Verificar que la vía existe
    const [existing] = await connection.query(
      'SELECT id FROM vias_administracion WHERE id = ?',
      [data.id]
    );
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Vía de administración no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si ya existe otra vía con ese nombre
    const [duplicate] = await connection.query(
      'SELECT id FROM vias_administracion WHERE nombre = ? AND id != ?',
      [data.nombre.trim(), data.id]
    );
    
    if (duplicate.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe otra vía de administración con ese nombre' },
        { status: 409 }
      );
    }

    // Actualizar vía de administración
    await connection.query(
      'UPDATE vias_administracion SET nombre = ? WHERE id = ?',
      [data.nombre.trim(), data.id]
    );

    return NextResponse.json(
      { 
        id: data.id, 
        nombre: data.nombre.trim(),
        message: 'Vía de administración actualizada exitosamente'
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('[API] Error al actualizar vía de administración:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la vía de administración', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[API] Error al liberar conexión:', releaseError);
      }
    }
  }
}

// DELETE /api/vias-administracion (para activar/desactivar vías)
export async function DELETE(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'El ID de la vía de administración es requerido' },
        { status: 400 }
      );
    }

    // Obtener el body de la petición
    const body = await request.json();
    const nuevoEstado = body.activo ? 1 : 0;

    connection = await db.getConnection();
    
    // Verificar que la vía existe
    const [existing] = await connection.query(
      'SELECT id, activo FROM vias_administracion WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Vía de administración no encontrada' },
        { status: 404 }
      );
    }

    // Cambiar el estado activo
    await connection.query(
      'UPDATE vias_administracion SET activo = ? WHERE id = ?',
      [nuevoEstado, id]
    );
    
    return NextResponse.json(
      { message: `Vía de administración ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente` },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('[API] Error al cambiar estado de vía de administración:', error);
    return NextResponse.json(
      { error: 'Error al cambiar estado de la vía de administración', details: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[API] Error al liberar conexión:', releaseError);
      }
    }
  }
}