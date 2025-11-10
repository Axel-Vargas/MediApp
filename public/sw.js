const CACHE_NAME = 'medi-app-v1';
const NOTIFICATION_TAG = 'medication-reminder';

const decryptFromPacked = async (packed) => {
  if (!packed) return null;
  
  try {
    return packed;
  } catch (error) {
    console.error('Error al procesar notificación:', error);
    return packed; 
  }
};

// Instalación del service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalado');
  self.skipWaiting();
});

// Activación del service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activado');
  event.waitUntil(
    self.clients.claim()
      .then(() => {
        console.log('[Service Worker] Reclamado para todos los clientes');
      })
      .catch(error => {
        console.error('[Service Worker] Error al reclamar clientes:', error);
      })
  );
});

// Manejo de notificaciones push
self.addEventListener('push', async (event) => {
  console.log('[SW] ===== Evento push recibido =====');
  console.log('[SW] Origen del evento:', event.origin);
  console.log('[SW] URL del Service Worker:', self.registration.scope);
  
  // Forzar que el service worker se active inmediatamente
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] Service Worker reclamó el control de los clientes');
    })
  );
  
  // Mostrar información detallada del evento
  console.group('[SW] Detalles del evento push:');
  console.log('Tipo:', event.type);
  console.log('Burbujea:', event.bubbles);
  console.log('Cancelable:', event.cancelable);
  console.log('Composición:', event.composed);
  console.log('TimeStamp:', new Date(event.timeStamp).toISOString());
  console.groupEnd();
  
  // Procesar los datos del push
  let payload = 'Sin datos';
  try {
    if (event.data) {
      try {
        // Intentar parsear como JSON primero
        payload = event.data.json();
        console.log('[SW] Payload (JSON):', JSON.stringify(payload, null, 2));
      } catch (e) {
        // Si falla, intentar como texto plano
        payload = event.data.text();
        console.log('[SW] Payload (texto):', payload);
      }
    }
  } catch (error) {
    console.error('[SW] Error al procesar push:', error);
    payload = 'Error al procesar notificación';
  }

  // Función para procesar los datos de la notificación
  const processNotificationData = async (data) => {
    try {
      if (!data) return data;
      
      const processedData = { ...data };
      
      return processedData;
    } catch (error) {
      console.error('Error al procesar datos de notificación:', error);
      return data;
    }
  };

  // Procesar los datos de la notificación
  const processNotificationPayload = async (payload) => {
    try {
      if (typeof payload === 'string') return payload;
      
      const processedData = await processNotificationData(payload);
      
      let message = 'Tienes un nuevo recordatorio';
      
      if (processedData.mensaje) {
        message = processedData.mensaje;
      } else if (processedData.nombreMedicamento || processedData.dosis) {
        message = `Toma tu medicamento: ${processedData.nombreMedicamento || ''} ${processedData.dosis ? `(${processedData.dosis})` : ''}`.trim();
      }
      
      return {
        title: 'Recordatorio de Medicación',
        message,
        data: processedData
      };
    } catch (error) {
      console.error('Error al procesar la notificación:', error);
      return {
        title: 'Recordatorio de Medicación',
        message: 'Tienes un nuevo recordatorio',
        data: payload
      };
    }
  };

  try {
    const notificationData = await processNotificationPayload(payload);
    
    const title = notificationData.title;
    const notificationOptions = {
      body: typeof notificationData === 'string' ? notificationData : notificationData.message,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      renotify: true,
      tag: NOTIFICATION_TAG,
      data: {
        url: '/',
        timestamp: Date.now(),
        ...(typeof notificationData === 'object' ? notificationData.data || {} : {})
      }
    };

    if (self.Notification && self.Notification.maxActions > 0) {
      notificationOptions.actions = [
        {
          action: 'tomar',
          title: '✅ Tomar',
          icon: '/icons/check-72x72.png'
        }
      ];
    }

    // Mostrar la notificación
    event.waitUntil(
      self.registration.getNotifications({ tag: NOTIFICATION_TAG })
        .then(existingNotifications => {
          existingNotifications.forEach(notification => {
            notification.close();
          });

          return self.registration.showNotification(title, notificationOptions);
        })
        .then(() => {
          console.log('[SW] Notificación mostrada correctamente');
          
          return self.clients.matchAll({ type: 'window' });
        })
        .then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'NOTIFICATION_RECEIVED',
              payload: payload
            });
          });
        })
        .catch(error => {
          console.error('[SW] Error al mostrar notificación:', error);
        })
    );
  } catch (error) {
    console.error('[SW] Error en el manejador de notificaciones push:', error);
  }
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', async (event) => {
  console.log('Notificación clickeada:', event);
  
  const notificationData = event.notification.data;
  
  event.notification.close();
  
  const action = event.action;
  console.log('Acción seleccionada:', action);
  
  if (action === 'tomar') {
    console.log('El usuario marcó la medicación como tomada');
    try {
      const processedData = await processNotificationData(notificationData);
      console.log('Datos procesados para la acción:', processedData);
      
      if (processedData.medicacionId) {
        // Ejemplo de cómo podrías registrar la toma
        // await fetch('/api/medicaciones/registrar-toma', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     medicacionId: decryptedData.medicacionId,
        //     fecha: new Date().toISOString()
        //   })
        // });
      }
    } catch (error) {
      console.error('Error al procesar la acción de la notificación:', error);
    }
  }
  
  // Abrir la aplicación cuando se hace clic en la notificación
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notificación cerrada:', event.notification);
});
