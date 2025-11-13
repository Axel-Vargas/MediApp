"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAdmin } from "@/context/adminContext";
import Toast from '@/components/Toast';
import { validateInput, sanitizeInput } from "@/lib/utils/validators";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const router = useRouter();
  const { handleLogin } = useAdmin();

  useEffect(() => {
    if (username) {
      const cleanUsername = sanitizeInput(username, { allowSpaces: false });
      if (cleanUsername !== username) {
        setUsername(cleanUsername);
      }
    }
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowToast(false);
    
    if (!username || !password) {
      setToast({ 
        show: true, 
        message: 'Por favor completa todos los campos', 
        type: 'error',
        duration: 3000
      });
      return;
    }
    
    const cleanUsername = sanitizeInput(username.trim(), { allowSpaces: false });
    
    if (!cleanUsername || !password) {
      setToast({ 
        show: true, 
        message: 'Usuario y contraseña son requeridos', 
        type: 'error',
        duration: 3000
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuario: cleanUsername,
          password: password,
        }),
      });

      const data = await response.json();
      console.log('Respuesta del servidor:', data);

      if (!response.ok) {
        const errorMessage = data.error || "Error en el login. Verifica tus credenciales.";
        console.error('Error en la respuesta del servidor:', errorMessage);
        
        setToast({ 
          show: true, 
          message: errorMessage, 
          type: 'error',
          duration: 4000
        });
        return;
      }

      if (!data.admin) {
        console.error('No se recibieron datos de administrador en la respuesta');
        throw new Error('Error en la autenticación');
      }

      handleLogin(data.admin);
      
      router.prefetch("/admin/dashboard");
      router.push("/admin/dashboard");
      
    } catch (error) {
      console.error("Error en login:", error);
      const errorMessage = error.message || "Error de conexión. Intenta nuevamente.";
      setError(errorMessage);
      setToast({ 
        show: true, 
        message: errorMessage, 
        type: 'error',
        duration: 4000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6">Acceso Administrador</h2>
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(prev => ({ ...prev, show: false }))}
            duration={toast.duration}
          />
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-1 text-sm">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                const sanitizedValue = sanitizeInput(e.target.value, { allowSpaces: false });
                setUsername(sanitizedValue);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-0 focus:ring-blue-500 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              placeholder="Ingrese su usuario"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-1 text-sm">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                required
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-0 focus:ring-blue-500 focus:border-blue-500 focus:outline-none placeholder-gray-400"
                placeholder="Ingrese su contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                disabled={isLoading}
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Ingresando..." : "Ingresar"}
          </button>
          <button
            type="button"
            onClick={() => {
              router.prefetch("/");
              router.push("/");
            }}
            className="w-full mt-3 border bg-red-500 border-gray-300 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors"
            onMouseEnter={() => {
              router.prefetch("/");
            }}
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
