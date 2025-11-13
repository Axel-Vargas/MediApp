"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/context/userContext";
import NavigationTabs from "@/components/NavigationTabs";
import "@/globals.css";

export default function Home() {
  const { user, loading, handleLogin, handleRegister, allUsers, loadAllUsers } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  if (pathname !== "/") {
    return null;
  }

  useEffect(() => {
    if (!user && !loading && loadAllUsers && pathname === "/") {
      const loadUsers = () => {
        loadAllUsers().catch(() => {
        });
      };
      
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        window.requestIdleCallback(loadUsers, { timeout: 1000 });
      } else {
        setTimeout(loadUsers, 100);
      }
    }
  }, [user, loading, loadAllUsers, pathname]);

  // Manejar login y navegación
  const handleLoginWithNavigation = async (username, password) => {
    try {
      const result = await handleLogin(username, password);
      if (result && result.user) {
        if (result.redirectPath) {
          router.push(result.redirectPath);
        } else if (result.user?.rol === 'doctor') {
          router.push('/caregiver/assign');
        } else if (result.user?.rol === 'paciente') {
          router.push('/patient/medications');
        }
      }
    } catch (error) {
      throw error;
    }
  };

  // Obtener solo doctores autorizados - memoizado
  const caregivers = useMemo(() => {
    if (!allUsers || allUsers.length === 0) {
      return [];
    }
    return allUsers.filter(u => {
      const isDoctor = u.rol === 'doctor';
      const isAuthorized = u.autorizado === true || u.autorizado === 1 || u.doctor_autorizado === true || u.doctor_autorizado === 1;
      return isDoctor && isAuthorized;
    });
  }, [allUsers]);

  useEffect(() => {
    if (typeof window === 'undefined' || pathname !== "/") {
      return;
    }

    if (!loading && user) {
      let targetPath = "/patient/medications";
      
      if (user.rol === "doctor") {
        targetPath = "/caregiver/assign";
      } else if (user.rol !== "paciente") {
        console.warn(`[Home] Rol no reconocido: "${user.rol}", redirigiendo a inicio`);
        return;
      }
      
      router.replace(targetPath);
    }
  }, [loading, user, pathname, router]);


  return (
    <NavigationTabs
      isPatient={false}
      caregivers={caregivers}
      onLogin={handleLoginWithNavigation}
      onRegister={handleRegister}
    />
  );
}