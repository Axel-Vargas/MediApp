"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/context/userContext";
import { userService } from "@/lib/services/userService";
import NavigationTabs from "@/components/NavigationTabs";
import "@/globals.css";

export default function Home() {
  const { user, loading, handleLogin, handleRegister, getCaregivers, allUsers } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Obtener solo doctores autorizados
  const caregivers = allUsers.filter(u => {
    const isDoctor = u.rol === 'doctor';
    const isAuthorized = u.autorizado === true || u.autorizado === 1 || u.doctor_autorizado === true || u.doctor_autorizado === 1;
    return isDoctor && isAuthorized;
  }) || [];

  useEffect(() => {
    if (typeof window === 'undefined' || loading) {
      return;
    }

    const currentPath = window.location.pathname;

    // Definir rutas protegidas
    const protectedRoutes = {
      doctor: ['/caregiver/assign', '/caregiver'],
      paciente: ['/patient/medications', '/patient'],
      all: ['/caregiver/assign', '/caregiver', '/patient/medications', '/patient']
    };

    // Si hay un usuario autenticado
    if (user) {
      if (currentPath === "/") {
        let targetPath = "/";
        
        if (user.rol === "paciente") {
          targetPath = "/patient/medications";
        } else if (user.rol === "doctor") {
          targetPath = "/caregiver/assign";
        } else {
          console.warn(`[Home] Rol no reconocido: "${user.rol}", redirigiendo a inicio`);
          targetPath = "/";
        }
        
        if (currentPath !== targetPath) {
          router.replace(targetPath);
        }
      }
      // Si está en una ruta que no coincide con su rol, redirigir a la ruta correcta
      else if (user.rol === 'doctor' && !protectedRoutes.doctor.some(route => currentPath.startsWith(route)) ||
               user.rol === 'paciente' && !protectedRoutes.paciente.some(route => currentPath.startsWith(route))) {
        const targetPath = user.rol === 'doctor' ? '/caregiver/assign' : '/patient/medications';
        router.replace(targetPath);
      }
    }
    // Si no hay usuario autenticado y está en una ruta protegida, redirigir al inicio
    else if (protectedRoutes.all.some(route => currentPath.startsWith(route))) {
      router.replace('/');
    }
  }, [loading, user, pathname]);

  const isProtectedRoute = [
    '/caregiver/assign', '/caregiver', '/patient/medications', '/patient'
  ].some(route => pathname.startsWith(route));

  if (loading && (user || isProtectedRoute)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (pathname === "/") {
    return (
      <NavigationTabs
        isPatient={false}
        caregivers={caregivers}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

}