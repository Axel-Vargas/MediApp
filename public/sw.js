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

// Función para procesar los datos de la notificación (disponible globalmente)
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
  // Forzar que el service worker se active inmediatamente
  event.waitUntil(
    self.clients.claim()
  );
  
  // Procesar los datos del push
  let payload = 'Sin datos';
  try {
    if (event.data) {
      try {
        // Intentar parsear como JSON primero
        payload = event.data.json();
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
  
  // Si se hace clic en la acción "tomar", registrar la toma directamente
  if (action === 'tomar') {
    console.log('El usuario marcó la medicación como tomada');
    
    // NO intentar abrir el navegador cuando se hace clic en "tomar"
    event.waitUntil(
      (async () => {
        try {
          const processedData = await processNotificationData(notificationData);
          console.log('Datos procesados para la acción:', processedData);
          
          // Verificar que tenemos los datos necesarios
          if (!processedData.medicacionId || !processedData.pacienteId) {
            console.error('❌ Faltan datos necesarios:', {
              medicacionId: processedData.medicacionId,
              pacienteId: processedData.pacienteId
            });
            
            await self.registration.showNotification('Error al registrar', {
              body: 'Faltan datos necesarios. Por favor, abre la aplicación para registrar la toma.',
              icon: '/icons/icon-192x192.png',
              badge: '/icons/badge-72x72.png',
              tag: 'medication-error',
              requireInteraction: false
            });
            return;
          }
          
          // Registrar la toma directamente desde el service worker
          // El pacienteId ya viene en el payload de la notificación
          // Las cookies HTTP se envían automáticamente con credentials: 'include'
          const response = await fetch(`/api/medicaciones/${processedData.medicacionId}/tomar`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              pacienteId: processedData.pacienteId 
            }),
            credentials: 'include' // Envía cookies HTTP automáticamente (incluye authToken si existe)
          });

          if (response.ok) {
            const result = await response.json();
            console.log('✅ Medicación marcada como tomada:', result);
            
            // Mostrar una notificación de confirmación
            await self.registration.showNotification('✅ Medicación registrada', {
              body: `Has marcado ${processedData.nombreMedicamento || 'la medicación'} como tomada`,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/badge-72x72.png',
              tag: 'medication-taken',
              requireInteraction: false,
              silent: false
            });
          } else {
            const error = await response.json();
            console.error('❌ Error al registrar la toma:', error);
            
            // Mostrar notificación de error
            await self.registration.showNotification('Error al registrar', {
              body: error.message || 'No se pudo registrar la toma. Intenta desde la aplicación.',
              icon: '/icons/icon-192x192.png',
              badge: '/icons/badge-72x72.png',
              tag: 'medication-error',
              requireInteraction: false
            });
          }
        } catch (fetchError) {
          console.error('❌ Error de red al registrar la toma:', fetchError);
          
          // Mostrar notificación de error de red
          await self.registration.showNotification('Error de conexión', {
            body: 'No se pudo conectar al servidor. Intenta desde la aplicación.',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: 'medication-error',
            requireInteraction: false
          });
        }
      })()
    );
    
    // NO intentar abrir el navegador cuando se hace clic en "tomar"
    return;
  }
  
  // Solo abrir la aplicación cuando se hace clic en la notificación (no en la acción)
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    })
      .then((clientList) => {
        // Buscar cualquier ventana abierta de la app
        for (const client of clientList) {
          const url = new URL(client.url);
          if (url.origin === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, intentar abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
      .catch(error => {
        console.error('Error al abrir ventana:', error);
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notificación cerrada:', event.notification);
});
