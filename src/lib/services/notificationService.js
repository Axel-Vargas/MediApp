const API_URL = '/api/notificaciones';

export const notificationService = {
  // Solicitar permisos de notificación
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones');
      return false;
    }

    // Si ya se denegaron los permisos, no mostrar el diálogo de nuevo
    if (Notification.permission === 'denied') {
      console.warn('Los permisos de notificación ya fueron denegados');
      return false;
    }

    // Si ya están concedidos, retornar true
    if (Notification.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error al solicitar permisos de notificación:', error);
      return false;
    }
  },

  // Registrar el service worker
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Este navegador no soporta service workers');
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      return registration;
    } catch (error) {
      console.error('Error registrando service worker:', error);
      throw error;
    }
  },

  // Suscribirse a notificaciones push
  async subscribeToPush() {
    try {
      const registration = await this.registerServiceWorker();
      
      // Solicitar permisos
      await this.requestPermission();

      // Verificar que la clave VAPID esté configurada
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('Clave VAPID pública no configurada');
      }

      // Obtener la suscripción existente o crear una nueva
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Crear nueva suscripción
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        });
        console.log('✅ Nueva suscripción creada');
      } else {
        console.log('✅ Suscripción existente encontrada');
      }

      // Asegurarse de que la suscripción tenga la estructura correcta
      if (!subscription.keys) {
        // Si no hay keys, intentar obtener la información de la suscripción
        const subscriptionJson = subscription.toJSON();
        if (subscriptionJson.keys) {
          subscription.keys = subscriptionJson.keys;
        } else {
          // Si aún no hay keys, forzar una nueva suscripción
          console.log('⚠️ La suscripción no contiene keys, forzando nueva suscripción...');
          await subscription.unsubscribe();
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
          });
        }
      }

      // Verificar que las claves necesarias estén presentes
      if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
        console.error('❌ La suscripción no contiene las claves necesarias:', {
          hasKeys: !!subscription.keys,
          hasP256dh: !!subscription.keys?.p256dh,
          hasAuth: !!subscription.keys?.auth
        });
        throw new Error('La suscripción no contiene las claves necesarias');
      }

      return subscription;
    } catch (error) {
      console.error('Error suscribiéndose a notificaciones push:', error);
      throw error;
    }
  },

  // Activar notificaciones push automáticamente (para registro)
  async activatePushNotifications(userId = null, familiarId = null) {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Este navegador no soporta notificaciones push');
        return { success: false, error: 'Navegador no compatible con notificaciones push' };
      }

      if (!userId && !familiarId) {
        console.error('Se requiere userId o familiarId para activar notificaciones');
        return { success: false, error: 'Se requiere un ID de usuario o familiar' };
      }

      // 1. Registrar el service worker primero
      const registration = await this.registerServiceWorker();
      if (!registration) {
        console.error('No se pudo registrar el service worker');
        return { success: false, error: 'Error al registrar el service worker' };
      }

      // 2. Intentar suscribir al push sin pedir permisos primero
      let subscription;
      
      try {
        subscription = await this.subscribeToPush();
      } catch (error) {
        console.warn('Error al suscribirse a notificaciones push:', error);
        const permissionGranted = await this.requestPermission();
        if (permissionGranted) {
          subscription = await this.subscribeToPush();
        }
      }

      if (!subscription) {
        console.warn('No se pudo suscribir a las notificaciones push');
        return { 
          success: false, 
          error: 'No se pudo completar la suscripción a notificaciones',
          requiresPermission: Notification.permission === 'default'
        };
      }

      // 3. Enviar la suscripción al servidor con el ID correspondiente
      await this.sendSubscriptionToServer(subscription, userId, familiarId);
      
      return { 
        success: true, 
        subscription,
        permission: Notification.permission
      };
    } catch (error) {
      console.error('❌ Error activando notificaciones push:', error);
      return { 
        success: false, 
        error: error.message || 'Error desconocido',
        requiresPermission: Notification.permission === 'default' && 
          error.message?.toLowerCase().includes('permission')
      };
    }
  },

  // Enviar suscripción al servidor
  async sendSubscriptionToServer(subscription, userId = null, familiarId = null) {
    try {
      if (!subscription) {
        console.error('❌ No se proporcionó una suscripción');
        throw new Error('No se proporcionó una suscripción');
      }

      if (!userId && !familiarId) {
        console.error('❌ Se requiere userId o familiarId para la suscripción');
        throw new Error('Se requiere userId o familiarId para la suscripción');
      }
      
      // Verificar si la suscripción tiene el formato correcto
      const subscriptionJson = subscription.toJSON ? subscription.toJSON() : subscription;
      
      // Extraer los datos de la suscripción
      const subscriptionData = {
        endpoint: subscriptionJson.endpoint || subscriptionJson.endpoint,
        keys: {
          p256dh: subscriptionJson.keys?.p256dh || subscriptionJson.p256dh || null,
          auth: subscriptionJson.keys?.auth || subscriptionJson.auth || null
        },
        userId: userId,
        familiarId: familiarId
      };

      // Verificar que los datos requeridos estén presentes
      if (!subscriptionData.keys.p256dh || !subscriptionData.keys.auth) {
        console.error('❌ Datos de suscripción incompletos:', {
          endpoint: subscriptionData.endpoint?.substring(0, 50) + '...',
          hasP256dh: !!subscriptionData.keys.p256dh,
          hasAuth: !!subscriptionData.keys.auth,
          originalKeys: subscriptionJson.keys || 'No keys found',
          subscriptionType: subscription.constructor?.name || typeof subscription,
          subscriptionJson: JSON.stringify(subscriptionJson, null, 2).substring(0, 200) + '...'
        });
        
        // Intentar extraer las claves de la URL si es necesario
        if (subscriptionData.endpoint) {
          const endpoint = subscriptionData.endpoint;
          const auth = endpoint.match(/[?&]auth=([^&]*)/)?.[1];
          const p256dh = endpoint.match(/[?&]p256dh=([^&]*)/)?.[1];
          
          if (auth && p256dh) {
            console.log('ℹ️ Se encontraron claves en la URL del endpoint');
            subscriptionData.keys = { auth, p256dh };
          }
        }
        
        // Si después de intentar extraer de la URL aún faltan claves
        if (!subscriptionData.keys.p256dh || !subscriptionData.keys.auth) {
          throw new Error('Datos de suscripción incompletos');
        }
      }

      const response = await fetch('/api/notificaciones/suscripcion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error en la respuesta del servidor:', errorData);
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Error enviando suscripción:', error);
      throw error;
    }
  },

  // Convertir clave VAPID
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },

  // Obtener notificaciones
  async getNotifications(usuarioId, rol) {
    try {
      if (!usuarioId || !rol) {
        throw new Error('Se requieren usuarioId y rol para obtener notificaciones');
      }

      const params = new URLSearchParams();
      params.append('usuarioId', usuarioId);
      params.append('rol', rol);

      const response = await fetch(`${API_URL}?${params}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error obteniendo notificaciones');
      }

      return await response.json();
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error);
      throw error;
    }
  },

  // Crear notificación
  async createNotification(data) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Error creando notificación');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creando notificación:', error);
      throw error;
    }
  }
};
