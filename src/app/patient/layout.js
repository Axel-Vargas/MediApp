"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/userContext';
import LayoutHeader from '@/components/LayoutHeader';
import NavigationTabs from '@/components/NavigationTabs';

export default function PatientLayout({ children }) {
  const { user, loading, handleLogout, updateUser, allUsers, getPacienteId } = useUser(); 
  const router = useRouter();
  const [activeTabPatient, setActiveTabPatient] = useState('medicamentos');
  
  const availableDoctors = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];
    return allUsers.filter(u => u.rol === 'doctor');
  }, [allUsers]);

  useEffect(() => {
    if (user && user.rol === 'paciente' && user.id && getPacienteId) {
      getPacienteId().catch(() => {
      });
    }
  }, [user, getPacienteId]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'paciente')) {
      router.push('/');
    }
  }, [loading, user, router]);

  const handleLogoutClick = () => {
    handleLogout();
    router.push('/');
  };

  const handleUpdateProfile = async (updatedData) => {
    try {
      await updateUser(updatedData);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user || user.rol !== 'paciente') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LayoutHeader
        user={user}
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
        availableDoctors={availableDoctors}
      />

      <main className="container mx-auto px-4 py-8">
        <NavigationTabs
          activeTab={activeTabPatient}
          setActiveTab={setActiveTabPatient}
          isPatient={true}
        />
        {children}
      </main>
    </div>
  );
}