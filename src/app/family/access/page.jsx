'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Toast from '@/components/Toast';
import { notificationService } from '@/lib/services/notificationService';

export default function FamilyAccessPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [showNotificationHelp, setShowNotificationHelp] = useState(false);
  const [notificationBlocked, setNotificationBlocked] = useState(false);
  const router = useRouter();

  // Verificar y solicitar permisos de notificación al cargar el componente
  useEffect(() => {
    if ('Notification' in window) {
      const permission = Notification.permission;
      const hasSeenPrompt = localStorage.getItem('hasSeenNotificationPrompt');
      
      // Actualizar estado de bloqueo
      setNotificationBlocked(permission === 'denied');
      
      // Si es la primera vez o los permisos no están establecidos, solicitar permiso
      if ((!hasSeenPrompt || permission === 'default') && permission !== 'denied') {
        const timer = setTimeout(() => {
          Notification.requestPermission().then(permission => {
            localStorage.setItem('hasSeenNotificationPrompt', 'true');
            
            if (permission === 'granted') {
              notificationService.activatePushNotifications(null, null);
            }
            
            setNotificationBlocked(permission === 'denied');
          });
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      setToast({ show: true, message: 'Por favor ingresa tu número de teléfono', type: 'error' });
      return;
    }
    
    if (verificationCode.length !== 6) {
      setToast({ show: true, message: 'El código de verificación debe tener 6 dígitos', type: 'error' });
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/family/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          verificationCode: verificationCode
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al verificar el código');
      }
      
      // Guardar la información del familiar en la sesión
      sessionStorage.setItem('familyMember', JSON.stringify(data.familiar));
      
      // Solo intentar activar notificaciones si no están bloqueadas
      if (Notification.permission !== 'denied') {
        const notificationResult = await notificationService.activatePushNotifications(null, data.familiar.id);
        
        if (notificationResult.success) {
          console.log('✅ Notificaciones push activadas para el familiar:', data.familiar.id);
          setNotificationBlocked(false);
        } else {
          console.warn('No se pudieron activar las notificaciones push:', notificationResult.error);
          
          if (notificationResult.requiresPermission || notificationResult.error?.includes('permission')) {
            setNotificationBlocked(true);
            setShowNotificationHelp(true);
          }
        }
      }
      
      router.prefetch('/family/dashboard');
      router.push('/family/dashboard');
      
    } catch (error) {
      console.error('Error al verificar:', error);
      setToast({ 
        show: true, 
        message: error.message || 'Error al verificar el código', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setPhoneNumber(value);
  };

  const handleVerificationCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
  };
  


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md relative">
        {notificationBlocked && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Las notificaciones están desactivadas. Para recibir recordatorios importantes, por favor habilita los permisos de notificación en tu navegador.
                </p>
                <div className="mt-2">
                  <button
                    onClick={() => setShowNotificationHelp(!showNotificationHelp)}
                    className="text-sm font-medium text-yellow-700 hover:text-yellow-600 focus:outline-none focus:underline transition duration-150 ease-in-out"
                  >
                    {showNotificationHelp ? 'Ocultar instrucciones' : '¿Cómo habilitar las notificaciones?'}
                  </button>
                </div>
                {showNotificationHelp && (
                  <div className="mt-2 text-sm text-yellow-700">
                    <p className="font-medium">Para habilitar las notificaciones:</p>
                    <ol className="list-decimal pl-5 mt-1 space-y-1">
                      <li>Haz clic en el ícono de candado o información en la barra de direcciones</li>
                      <li>Busca "Permisos de notificaciones"</li>
                      <li>Selecciona "Permitir" en el menú desplegable</li>
                      <li>Actualiza la página para aplicar los cambios</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div>
          <button
            onClick={() => {
              router.prefetch('/');
              router.push('/');
            }}
            onMouseEnter={() => {
              router.prefetch('/');
            }}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-1" />
            Volver al inicio
          </button>
          
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            Acceso Familiar
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingrese su número de teléfono y su código de acceso
          </p>
        </div>

        {/* Toast Notification */}
        {toast.show && (
          <div className="mt-4">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(prev => ({ ...prev, show: false }))}
            />
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Número de teléfono
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">+593</span>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  maxLength="10"
                  placeholder="987654321"
                  className="focus:ring-blue-500 focus:border-blue-500 focus:outline-none block w-full pl-14 pr-3 sm:text-sm border-gray-300 rounded-md py-2 border placeholder-gray-600"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                Código de acceso
              </label>
              <input
                id="verificationCode"
                name="verificationCode"
                type="text"
                inputMode="numeric"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
                maxLength="6"
                placeholder="Ingrese su código"
                className="focus:ring-blue-500 focus:border-blue-500 focus:outline-none block w-full px-3 py-2 sm:text-sm border border-gray-300 rounded-md placeholder-gray-600"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !phoneNumber || verificationCode.length !== 6}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                (loading || !phoneNumber || verificationCode.length !== 6) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Procesando...' : 'Continuar'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Al continuar, aceptas nuestros Términos de Servicio y Política de Privacidad</p>
        </div>
      </div>
    </div>
  );
}
