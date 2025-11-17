import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { decryptTriple, decryptFromPacked } from '@/lib/crypto';

export async function POST(request, { params }) {
  let connection;
  try {
    const { id } = await params;
    const { nombre, email, relacion, telefono } = await request.json();

    connection = await db.getConnection();

    // Validar que el paciente existe
    const [paciente] = await connection.query('SELECT id FROM pacientes WHERE id = ?', [id]);
    
    if (paciente.length === 0) {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error al liberar conexión:', releaseError);
        }
      }
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    // Generar código de verificación de 6 dígitos
    const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
    const fechaActual = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const { encryptToPacked } = await import('@/lib/crypto');

    await connection.query('START TRANSACTION');

    try {
      // 1. Insertar el familiar en la tabla familiares con datos cifrados
      const [result] = await connection.query(
        `INSERT INTO familiares 
         (nombre, email, relacion, telefono, codigoVerificacion, verificado, fechaVerificacion) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          await encryptToPacked(nombre),
          await encryptToPacked(email),
          await encryptToPacked(relacion),
          await encryptToPacked(telefono),
          await encryptToPacked(codigoVerificacion),
          0, 
          fechaActual
        ]
      );

      const familiarId = result.insertId;

      // 2. Insertar la relación en la tabla pacientes_familiares
      await connection.query(
        `INSERT INTO pacientes_familiares 
         (pacienteId, familiarId) 
         VALUES (?, ?)`,
        [id, familiarId]
      );

      // 3. Obtener el familiar recién insertado con los datos completos
      const [familiar] = await connection.query(
        `SELECT f.* 
         FROM familiares f
         INNER JOIN pacientes_familiares pf ON f.id = pf.familiarId
         WHERE f.id = ? AND pf.pacienteId = ?`,
        [familiarId, id]
      );

      await connection.query('COMMIT');

      return NextResponse.json(familiar[0], { status: 201 });
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Error interno del servidor al agregar familiar' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en POST /api/pacientes/[id]/familiares');
      } catch (releaseError) {
        console.error('Error al liberar conexión en POST /api/pacientes/[id]/familiares:', releaseError);
      }
    }
  }
}

export async function GET(request, { params }) {
  let connection;
  try {
    const { id: pacienteId } = await params;

    connection = await db.getConnection();

    // Obtener todos los familiares del paciente
    const [familiares] = await connection.query(
      `SELECT f.id, f.nombre, f.email, f.relacion, f.telefono, f.verificado, f.fechaVerificacion, f.codigoVerificacion 
       FROM familiares f
       INNER JOIN pacientes_familiares pf ON f.id = pf.familiarId
       WHERE pf.pacienteId = ?`,
      [pacienteId]
    );

    const familiaresDescifrados = familiares.map(familiar => ({
      ...familiar,
      nombre: decryptTriple(familiar, 'nombre') || decryptFromPacked(familiar.nombre) || familiar.nombre,
      email: decryptTriple(familiar, 'email') || decryptFromPacked(familiar.email) || familiar.email,
      telefono: decryptTriple(familiar, 'telefono') || decryptFromPacked(familiar.telefono) || familiar.telefono,
      relacion: decryptTriple(familiar, 'relacion') || decryptFromPacked(familiar.relacion) || familiar.relacion,
      codigoVerificacion: decryptTriple(familiar, 'codigoVerificacion') || decryptFromPacked(familiar.codigoVerificacion) || familiar.codigoVerificacion
    }));

    return NextResponse.json(familiaresDescifrados);
  } catch (error) {
    console.error('Error al obtener familiares:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al obtener familiares' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en GET /api/pacientes/[id]/familiares');
      } catch (releaseError) {
        console.error('Error al liberar conexión en GET /api/pacientes/[id]/familiares:', releaseError);
      }
    }
  }
}

export async function DELETE(request, { params }) {
  let connection;
  try {
    const { id: pacienteId } = await params;
    
    const url = new URL(request.url);
    const familiarId = url.searchParams.get('familiarId');

    if (!familiarId) {
      return NextResponse.json(
        { error: 'Se requiere el ID del familiar' },
        { status: 400 }
      );
    }

    console.log(`Eliminando familiar ${familiarId} del paciente ${pacienteId}`);

    connection = await db.getConnection();

    // Verificar que el familiar pertenece al paciente
    const [verificacion] = await connection.query(
      'SELECT * FROM pacientes_familiares WHERE pacienteId = ? AND familiarId = ?',
      [pacienteId, familiarId]
    );

    if (verificacion.length === 0) {
      console.error('No se encontró la relación entre el paciente y el familiar');
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error al liberar conexión:', releaseError);
        }
      }
      return NextResponse.json(
        { error: 'No se encontró la relación entre el paciente y el familiar' },
        { status: 404 }
      );
    }

    await connection.query('START TRANSACTION');

    try {
      // 1. Eliminar la relación en pacientes_familiares
      await connection.query(
        'DELETE FROM pacientes_familiares WHERE pacienteId = ? AND familiarId = ?',
        [pacienteId, familiarId]
      );

      console.log(`Relación eliminada para el familiar ${familiarId}`);

      // 2. Verificar si el familiar tiene más relaciones
      const [otrasRelaciones] = await connection.query(
        'SELECT * FROM pacientes_familiares WHERE familiarId = ?',
        [familiarId]
      );

      // 3. Si no hay más relaciones, eliminar el familiar
      if (otrasRelaciones.length === 0) {
        console.log(`Eliminando familiar ${familiarId} ya que no tiene más relaciones`);
        await connection.query('DELETE FROM familiares WHERE id = ?', [familiarId]);
      } else {
        console.log(`El familiar ${familiarId} tiene ${otrasRelaciones.length} relaciones más`);
      }

      await connection.query('COMMIT');
      console.log(`Eliminación completada para el familiar ${familiarId}`);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error en la transacción de eliminación:', error);
      await connection.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar familiar:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al eliminar familiar' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('🔓 Conexión liberada en DELETE /api/pacientes/[id]/familiares');
      } catch (releaseError) {
        console.error('Error al liberar conexión en DELETE /api/pacientes/[id]/familiares:', releaseError);
      }
    }
  }
}
