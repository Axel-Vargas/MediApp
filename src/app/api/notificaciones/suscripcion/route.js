import { NextResponse } from 'next/server';
import db from '@/lib/db';

// POST /api/notificaciones/suscripcion
export async function POST(request) {
  let connection;
  try {
    const subscription = await request.json();
    console.log('📥 Recibida suscripción:', { 
      endpoint: subscription.endpoint?.substring(0, 50) + '...',
      userId: subscription.userId,
      familiarId: subscription.familiarId,
      hasKeys: !!subscription.keys,
      keysStructure: subscription.keys ? Object.keys(subscription.keys) : []
    });

    // Validar que al menos uno de los dos IDs esté presente
    if (!subscription.userId && !subscription.familiarId) {
      console.error('❌ Se requiere userId o familiarId');
      return NextResponse.json({ 
        error: 'Se requiere userId o familiarId para la suscripción' 
      }, { status: 400 });
    }

    connection = await db.getConnection();

    // Verificar que la tabla existe
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'push_subscriptions'"
    );

    if (tables.length === 0) {
      console.error('❌ Tabla push_subscriptions no existe');
      return NextResponse.json({ 
        error: 'Tabla push_subscriptions no existe. Ejecuta el script SQL primero.' 
      }, { status: 500 });
    }

    // Validar datos requeridos con más detalle
    if (!subscription.endpoint) {
      console.error('❌ Endpoint faltante');
      return NextResponse.json({ 
        error: 'Endpoint de suscripción requerido' 
      }, { status: 400 });
    }

    if (!subscription.keys) {
      console.error('❌ Objeto keys faltante');
      return NextResponse.json({ 
        error: 'Objeto keys de suscripción requerido' 
      }, { status: 400 });
    }

    if (!subscription.keys.p256dh) {
      console.error('❌ Clave p256dh faltante');
      return NextResponse.json({ 
        error: 'Clave p256dh requerida' 
      }, { status: 400 });
    }

    if (!subscription.keys.auth) {
      console.error('❌ Clave auth faltante');
      return NextResponse.json({ 
        error: 'Clave auth requerida' 
      }, { status: 400 });
    }

    // Guardar la suscripción en la base de datos
    const [result] = await connection.query(
      `INSERT INTO push_subscriptions 
        (endpoint, p256dh, auth, userId, familiarId, createdAt)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        p256dh = VALUES(p256dh),
        auth = VALUES(auth),
        userId = VALUES(userId),
        familiarId = VALUES(familiarId),
        updatedAt = NOW()`,
      [
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        subscription.userId || null,
        subscription.familiarId || null
      ]
    );

    console.log('✅ Suscripción guardada correctamente:', result.insertId);

    return NextResponse.json({ 
      message: 'Suscripción guardada correctamente',
      id: result.insertId 
    });
  } catch (error) {
    console.error('❌ Error en POST /api/notificaciones/suscripcion:', error);
    return NextResponse.json({ 
      error: error.message || 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}

// GET /api/notificaciones/suscripcion?userId=123&familiarId=456
export async function GET(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const familiarId = searchParams.get('familiarId');

    if (!userId && !familiarId) {
      return NextResponse.json({ 
        error: 'Se requiere userId o familiarId' 
      }, { status: 400 });
    }

    connection = await db.getConnection();

    let query = `SELECT * FROM push_subscriptions WHERE 1=1`;
    const params = [];

    if (userId) {
      query += ` AND userId = ?`;
      params.push(userId);
    } else if (familiarId) {
      query += ` AND familiarId = ?`;
      params.push(familiarId);
    }

    const [subscriptions] = await connection.query(query, params);
    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('❌ Error en GET /api/notificaciones/suscripcion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
