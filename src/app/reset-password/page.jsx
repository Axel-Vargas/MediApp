"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Toast from "@/components/Toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "error" });

  useEffect(() => {
    const t = searchParams.get("token") || "";
    setToken(t);
  }, [searchParams]);

  const validatePassword = (pwd) => {
    return typeof pwd === "string" && pwd.length >= 6;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setToast({ show: true, message: "Token inválido o faltante.", type: "error" });
      return;
    }
    if (!password || !confirmPassword) {
      setToast({ show: true, message: "Completa ambos campos de contraseña.", type: "error" });
      return;
    }
    if (password !== confirmPassword) {
      setToast({ show: true, message: "Las contraseñas no coinciden.", type: "error" });
      return;
    }
    if (!validatePassword(password)) {
      setToast({ show: true, message: "La contraseña debe tener al menos 6 caracteres.", type: "error" });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "No se pudo actualizar la contraseña");
      }
      setToast({ show: true, message: "Contraseña actualizada correctamente.", type: "success" });
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err) {
      setToast({ show: true, message: err.message || "Error al actualizar la contraseña", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((prev) => ({ ...prev, show: false }))}
        />
      )}
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Restablecer contraseña</h1>
        <p className="text-base text-center text-gray-600 mb-6">
          Ingresa tu nueva contraseña.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none placeholder-gray-400"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md enabled:hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
