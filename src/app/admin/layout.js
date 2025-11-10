"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminProvider, useAdmin } from "@/context/adminContext";
import LayoutHeader from "@/components/LayoutHeader";

function AdminLayoutContent({ children }) {
  const { admin, loading, handleLogout, updateAdmin, toggleMobileMenu } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  
  // No aplicar protección de autenticación en la página de login
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!isLoginPage && !loading && !admin) {
      router.push("/admin/login");
    }
  }, [loading, admin, router, isLoginPage]);

  const handleLogoutClick = () => {
    handleLogout();
    router.push("/");
  };

  const handleUpdateProfile = async (updatedData) => {
    try {
      const response = await fetch(`/api/usuarios/${admin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        const result = await response.json();
        updateAdmin(updatedData);
      } else {
        console.error('Error al actualizar perfil del admin');
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Si es la página de login, renderizar sin protección
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Para otras páginas, verificar autenticación
  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <LayoutHeader
        user={admin}
        onLogout={handleLogoutClick}
        onUpdateProfile={handleUpdateProfile}
        availableDoctors={[]}
        hideLogout={true}
        showMobileMenuButton={!isLoginPage}
        onMobileMenuToggle={toggleMobileMenu}
      />
      <main>
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <AdminProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminProvider>
  );
}