import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { FiEye, FiEyeOff } from 'react-icons/fi';
import Toast from '@/components/Toast';
import { validateInput, sanitizeInput, validateEmail } from '@/lib/utils/validators';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [touched, setTouched] = useState({ username: false, password: false });
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (username) {
      const cleanUsername = sanitizeInput(username, { allowSpaces: false });
      if (cleanUsername !== username) {
        setUsername(cleanUsername);
      }
    }

    if (password) {
      if (!validateInput(password)) {
        setToast({
          show: true,
          message: 'La contraseña contiene caracteres no permitidos',
          type: 'error',
          duration: 3000
        });
      }
    }
  }, [username, password]);

  const sendPasswordResetEmail = async () => {
    try {
      if (!forgotEmail || !validateEmail(forgotEmail)) {
        setToast({ show: true, message: 'Ingresa un correo válido', type: 'error', duration: 3000 });
        return;
      }

      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        setToast({ show: true, message: 'Faltan credenciales de EmailJS en el entorno', type: 'error', duration: 4000 });
        return;
      }

      setSendingReset(true);

      // 1) Pedimos token al backend
      const tokenRes = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData?.token) {
        throw new Error(tokenData?.message || 'No se pudo generar el token de recuperación');
      }

      const resetLink = typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password?token=${encodeURIComponent(tokenData.token)}`
        : '';

      const verifiedFrom = process.env.NEXT_PUBLIC_EMAILJS_FROM_EMAIL || 'no-reply@mediapp.local';

      // Asegurarse de que el correo ingresado se use correctamente
      const emailDestino = forgotEmail.trim().toLowerCase();

      const payload = {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: emailDestino,
          to_name: emailDestino.split('@')[0],
          from_email: verifiedFrom,
          reply_to: emailDestino,
          from_name: 'MediApp',
          subject: 'Recuperación de contraseña',
          message: 'Hola, recibimos tu solicitud de recuperación de contraseña.',
          reset_link: resetLink,
          button_text: 'Recuperar contraseña',
          expiration_minutes: (tokenData?.expiresAt ? Math.ceil((new Date(tokenData.expiresAt) - Date.now()) / 60000) : '20').toString()
        }
      };

      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resText = await res.text().catch(() => '');

      if (!res.ok) {
        console.error('[EmailJS] Error:', res.status, resText);
        throw new Error(resText || `No se pudo enviar el correo (status ${res.status})`);
      }

      setToast({ show: true, message: 'Hemos enviado un correo con instrucciones', type: 'success', duration: 4000 });
      setShowForgot(false);
      setForgotEmail('');
    } catch (e) {
      setToast({ show: true, message: e.message || 'Error enviando el correo', type: 'error', duration: 4000 });
    } finally {
      setSendingReset(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, password: true });

    if (!username || !password) {
      setToast({
        show: true,
        message: 'Por favor completa todos los campos',
        type: 'error',
        duration: 3000
      });
      return;
    }

    // Sanitizar entradas
    const cleanUsername = sanitizeInput(username, { allowSpaces: false });
    const cleanPassword = sanitizeInput(password, { allowSpaces: false });

    // Validar entradas después de sanitizar
    if (!validateInput(cleanUsername) || !validateInput(cleanPassword)) {
      setToast({
        show: true,
        message: 'Entrada no válida. Por favor usa solo caracteres alfanuméricos.',
        type: 'error',
        duration: 3000
      });
      return;
    }
    setLoading(true);
    setError('');
    setToast(prev => ({ ...prev, show: false })); 
    
    try {
      await onLogin(cleanUsername, cleanPassword);
    } catch (err) {
      const errorMessage = err?.message || 'Error al iniciar sesión';
      const isCredentialError = errorMessage.toLowerCase().includes('credenciales') || 
                                errorMessage.toLowerCase().includes('inválidas') ||
                                errorMessage.toLowerCase().includes('invalidas') ||
                                errorMessage.toLowerCase().includes('incorrectos') ||
                                errorMessage.toLowerCase().includes('incorrectas');
      
      setToast({ 
        show: true, 
        message: isCredentialError ? 'Usuario o contraseña incorrectos' : errorMessage, 
        type: 'error',
        duration: 4000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Iniciar Sesión</h2>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
          duration={toast.duration || 4000}
        />
      )}

      {/* FORMULARIO DE PACIENTES/CUIDADORES */}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="username">
            Usuario
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
            className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none border-gray-300`}
            disabled={loading}
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none border-gray-300`}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
              disabled={loading}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <FiEyeOff className="h-5 w-5" />
              ) : (
                <FiEye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Olvidé mi contraseña */}
        <div className="mt-2 mb-4 flex justify-start">
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-sm text-blue-600 hover:text-blue-800 no-underline focus:outline-none focus:ring-0"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md enabled:hover:bg-blue-600 transition-colors disabled:opacity-60"
          disabled={loading || !username || !password}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      {/* BOTÓN EXCLUSIVO PARA ADMIN - FUERA DEL FORM */}
      <button
        type="button"
        onClick={() => {
          router.prefetch("/admin/login");
          router.push("/admin/login");
        }}
        className="mt-4 w-full bg-blue-700 text-white py-2 px-4 rounded-md hover:bg-blue-800 transition-colors"
        onMouseEnter={() => {
          router.prefetch("/admin/login");
        }}
      >
        Ingresar como Administrador
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">o</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          router.prefetch("/family/access");
          router.push("/family/access");
        }}
        className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors"
        onMouseEnter={() => {
          router.prefetch("/family/access");
        }}
      >
        Soy familiar
      </button>

      {/* Modal Recuperar Contraseña */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Recuperar contraseña</h3>
            <p className="text-sm text-gray-600 mb-4">Ingresa tu correo y te enviaremos instrucciones.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                placeholder="correo@ejemplo.com"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowForgot(false); setForgotEmail(''); }}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                disabled={sendingReset}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendPasswordResetEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                disabled={sendingReset}
              >
                {sendingReset ? 'Enviando...' : 'Enviar correo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
