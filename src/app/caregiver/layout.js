"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/userContext";
import NavigationTabs from "@/components/NavigationTabs";
import LayoutHeader from "@/components/LayoutHeader";
import "@/globals.css";

export default function CaregiverLayout({ children }) {
  const { user, loading, activeTabCaregiver, setActiveTabCaregiver, handleLogout, updateUser, loadDoctorPatientMedications, loadAdministrationRoutes } = useUser();
  
  const handleUpdateProfile = async (updatedData) => {
    try {
      await updateUser(updatedData);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      throw error;
    }
  };
  const router = useRouter();

  useEffect(() => {
    if (user && user.rol === 'doctor' && user.id && user.patients && user.patients.length > 0) {
      Promise.all([
        loadDoctorPatientMedications().catch(() => {
        }),
        loadAdministrationRoutes().catch(() => {
        })
      ]);
    }
  }, [user?.id, user?.patients?.length, user?.rol, loadDoctorPatientMedications, loadAdministrationRoutes]); 

  useEffect(() => {
    if (!loading && (!user || user.rol !== "doctor")) {
      router.push("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!user || user.rol !== "doctor") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LayoutHeader
        user={user}
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
      />
      <main className="container mx-auto px-4 py-8">
        <NavigationTabs
          activeTab={activeTabCaregiver}
          setActiveTab={setActiveTabCaregiver}
          isPatient={false}
        />
        {children}
      </main>
    </div>
  );
}