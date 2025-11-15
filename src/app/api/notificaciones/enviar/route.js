import { NextResponse } from 'next/server';
import db from '@/lib/db';
import webPush from 'web-push';

// Configurar web-push con las claves VAPID
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

webPush.setVapidDetails(
  'mailto:tu-email@ejemplo.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// POST /api/notificaciones/enviar
export async function POST(request) {
  let connection;
  try {
    connection = await db.getConnection();
    console.log('Buscando notificaciones pendientes...');

    const [serverTime] = await connection.query('SELECT NOW() as currentTime');
    console.log('Hora actual del servidor:', serverTime[0].currentTime);

    // Consulta para obtener notificaciones pendientes
    const [notificaciones] = await connection.query(
      `SELECT 
          n.id, n.estado, n.fechaProgramada, n.mensaje, n.destinatario,
          m.nombreMedicamento, m.dosis, 
          u.nombre as nombrePaciente, u.notiWebPush,
          ps.endpoint, ps.userId as subscriptionUserId,
          JSON_OBJECT('p256dh', ps.p256dh, 'auth', ps.auth) as subscriptionKeys
       FROM notificaciones n
       INNER JOIN medicaciones m ON n.medicacionId = m.id
       INNER JOIN pacientes p ON n.pacienteId = p.id
       INNER JOIN usuarios u ON p.usuarioId = u.id
       LEFT JOIN push_subscriptions ps ON 
         (n.destinatario = 'paciente' AND p.usuarioId = ps.userId) OR
         (n.destinatario = 'familiar' AND n.familiarId = ps.familiarId)
       WHERE n.estado = 'pendiente' 
       AND n.fechaProgramada <= NOW()
       AND (
         -- Para pacientes: verificar que las notificaciones web estén habilitadas
         (n.destinatario = 'paciente' AND u.notiWebPush = 1) OR
         -- Para familiares: no necesitamos verificar notiWebPush ya que no tienen usuario
         n.destinatario = 'familiar'
       )
       AND ps.endpoint IS NOT NULL  -- Solo notificaciones con suscripción válida
       ORDER BY n.fechaProgramada ASC`
    );

    // Importar las funciones de cifrado/descifrado
    const { decryptFromPacked, isDataKeyConfigured } = await import('@/lib/crypto');
    
    // Descifrar los campos de medicación, paciente y mensaje si hay clave configurada
    if (isDataKeyConfigured()) {
      for (const notificacion of notificaciones) {
        try {
          notificacion.nombreMedicamento = decryptFromPacked(notificacion.nombreMedicamento) || notificacion.nombreMedicamento;
          notificacion.dosis = decryptFromPacked(notificacion.dosis) || notificacion.dosis;
          
          notificacion.nombrePaciente = decryptFromPacked(notificacion.nombrePaciente) || notificacion.nombrePaciente;
          
          notificacion.mensaje = decryptFromPacked(notificacion.mensaje) || notificacion.mensaje;
          
          console.log(`Notificación ${notificacion.id} descifrada:`, {
            medicamento: notificacion.nombreMedicamento,
            dosis: notificacion.dosis,
            paciente: notificacion.nombrePaciente,
            mensaje: notificacion.mensaje,
            destinatario: notificacion.destinatario
          });
        } catch (error) {
          console.error(`Error al descifrar datos de notificación ${notificacion.id}:`, error);
        }
      }
    }
    
    console.log('Notificaciones encontradas:', JSON.stringify(notificaciones, null, 2));

    if (notificaciones.length === 0) {
      console.log('No hay notificaciones pendientes para enviar');
      return NextResponse.json({ 
        success: true, 
        message: 'No hay notificaciones pendientes para enviar',
        notificacionesEncontradas: 0
      });
    }
    
    console.log(`Encontradas ${notificaciones.length} notificaciones pendientes`);

    const resultados = [];

    for (const notificacion of notificaciones) {
      try {
        console.log('Procesando notificación:', notificacion.id);
        
        const tieneSuscripcion = notificacion.endpoint && notificacion.subscriptionKeys;
        console.log('Tiene suscripción?', {
          endpoint: !!notificacion.endpoint,
          subscriptionKeys: !!notificacion.subscriptionKeys,
          subscriptionUserId: notificacion.subscriptionUserId
        });
        
        if (tieneSuscripcion) {
          // Verificar si subscriptionKeys ya es un objeto o necesita parsearse
          let keys;
          if (typeof notificacion.subscriptionKeys === 'string') {
            try {
              keys = JSON.parse(notificacion.subscriptionKeys);
            } catch (parseError) {
              console.error(`Error al parsear subscriptionKeys para notificación ${notificacion.id}:`, parseError);
              console.error('Valor recibido:', notificacion.subscriptionKeys);
              continue; // Saltar esta notificación
            }
          } else if (typeof notificacion.subscriptionKeys === 'object' && notificacion.subscriptionKeys !== null) {
            // Ya es un objeto, usarlo directamente
            keys = notificacion.subscriptionKeys;
          } else {
            console.error(`subscriptionKeys tiene un formato inválido para notificación ${notificacion.id}:`, typeof notificacion.subscriptionKeys);
            continue; // Saltar esta notificación
          }

          // Validar que las claves necesarias estén presentes
          if (!keys || !keys.p256dh || !keys.auth) {
            console.error(`Claves de suscripción incompletas para notificación ${notificacion.id}:`, keys);
            continue; // Saltar esta notificación
          }

          const subscription = {
            endpoint: notificacion.endpoint,
            keys: keys
          };

          const payload = JSON.stringify({
            mensaje: notificacion.mensaje || `Es hora de tomar ${notificacion.nombreMedicamento}`,
            nombreMedicamento: notificacion.nombreMedicamento,
            dosis: notificacion.dosis,
            nombrePaciente: notificacion.nombrePaciente,
            url: '/',
            notificacionId: notificacion.id,
            medicacionId: notificacion.medicacionId,
            pacienteId: notificacion.pacienteId
          });

          // Enviar notificación push
          try {
            console.log('Intentando enviar notificación push para:', {
              notificacionId: notificacion.id,
              medicamento: notificacion.nombreMedicamento,
              para: notificacion.nombrePaciente,
              endpoint: subscription.endpoint.substring(0, 50) + '...',
              tieneClaves: !!subscription.keys
            });
            
            // Validar la suscripción antes de enviar
            if (!subscription || !subscription.endpoint) {
              throw new Error('Suscripción inválida: falta endpoint');
            }
            
            if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
              throw new Error('Suscripción inválida: faltan claves de cifrado');
            }
            
            // Enviar la notificación con un timeout
            const sendPromise = webPush.sendNotification(subscription, payload);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout al enviar notificación')), 10000)
            );
            
            await Promise.race([sendPromise, timeoutPromise]);
            
            console.log('✅ Notificación push enviada:', notificacion.id);
            resultados.push({
              id: notificacion.id,
              status: 'enviada',
              message: `Notificación enviada para ${notificacion.nombreMedicamento}`,
              pushSent: true
            });
          } catch (error) {
            console.error('❌ Error enviando notificación push:', {
              notificacionId: notificacion.id,
              error: error.message,
              stack: error.stack,
              subscription: {
                endpoint: subscription?.endpoint?.substring(0, 50) + '...',
                keys: subscription?.keys ? Object.keys(subscription.keys) : 'No hay claves'
              }
            });
            
            // Si el error es por suscripción inválida, eliminarla
            if (error.statusCode === 404 || error.statusCode === 410) {
              console.log(`⚠️ Suscripción inválida (${error.statusCode}), eliminando suscripción expirada`);
              try {
                await connection.query(
                  'DELETE FROM push_subscriptions WHERE endpoint = ?',
                  [subscription.endpoint]
                );
                console.log(`✅ Suscripción eliminada: ${subscription.endpoint.substring(0, 50)}...`);
                
                // Intentar notificar al cliente para que renueve la suscripción
                await connection.query(
                  'UPDATE usuarios SET notiWebPush = 0 WHERE id = ?',
                  [notificacion.subscriptionUserId]
                );
                console.log(`✅ Notificaciones web desactivadas para el usuario ${notificacion.subscriptionUserId}`);
                
              } catch (dbError) {
                console.error('Error al limpiar suscripción expirada:', dbError);
              }
            }
            
            resultados.push({
              id: notificacion.id,
              status: 'error',
              error: error.message,
              errorType: error.name,
              errorCode: error.statusCode || 'N/A'
            });
            continue;
          }
        }

        // Actualizar estado de la notificación
        await connection.query(
          `UPDATE notificaciones 
           SET estado = 'enviado', fechaEnvio = NOW()
           WHERE id = ?`,
          [notificacion.id]
        );

        resultados.push({
          id: notificacion.id,
          status: 'enviada',
          mensaje: `Notificación enviada para ${notificacion.nombreMedicamento}`,
          pushSent: !!(notificacion.endpoint && notificacion.subscriptionKeys)
        });
      } catch (error) {
        console.error(`Error enviando notificación ${notificacion.id}:`, error);
        resultados.push({
          id: notificacion.id,
          status: 'error',
          error: error.message
        });
      }
    }

    return NextResponse.json({ 
      message: 'Proceso completado',
      resultados 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
