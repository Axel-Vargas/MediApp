"use client";

import React, { useState, useEffect } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/userContext";
import FamilyMemberCard from "@/components/FamilyMemberCard";
import AddFamilyMemberForm from "@/components/AddFamilyMemberForm";
import ConfirmationModal from "@/components/ConfirmationModal";
import Toast from "@/components/Toast";

export default function FamilyManagement() {
  const router = useRouter();
  const { user, setUser, handleAddFamilyMember, handleRemoveFamilyMember, pacienteId, patientFamilyMembers, patientDoctor, loadPatientFamilyMembers, loadPatientDoctor } = useUser();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [isAcceptingPolicy, setIsAcceptingPolicy] = useState(false); 
  const [error, setError] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [loadingFamilyMembers, setLoadingFamilyMembers] = useState(true);
  const [loadingDoctor, setLoadingDoctor] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== "paciente") {
      setLoadingFamilyMembers(false);
      setLoadingDoctor(false);
      return;
    }
        
    // Verificar si la política NO está aceptada
    // Solo mostrar el modal si politicaAceptada es explícitamente 0, false, null o undefined
    const politicaAceptada = user.politicaAceptada;
    const politicaNoAceptada = politicaAceptada === 0 || 
                                politicaAceptada === false || 
                                politicaAceptada === null || 
                                politicaAceptada === undefined;
    
    if (politicaNoAceptada) {
      setShowPolicyModal(true);
      setLoadingFamilyMembers(false);
      setLoadingDoctor(false);
      return;
    }
    
    if (!pacienteId) {
      setLoadingFamilyMembers(true);
      setLoadingDoctor(true);
      return;
    }
    
    const hasFamilyMembersData = patientFamilyMembers !== null && patientFamilyMembers !== undefined;
    const hasDoctorData = patientDoctor !== null && patientDoctor !== undefined;
    
    if (!hasFamilyMembersData) {
      setLoadingFamilyMembers(true);
    }
    if (!hasDoctorData) {
      setLoadingDoctor(true);
    }
    
    Promise.all([
      loadPatientFamilyMembers()
        .then(() => {
          setLoadingFamilyMembers(false);
        })
        .catch(err => {
          console.error('[Family] Error al cargar familiares:', err);
          setLoadingFamilyMembers(false);
          if (!hasFamilyMembersData) {
            setToast({ 
              show: true, 
              message: 'No se pudieron cargar los familiares', 
              type: 'error' 
            });
          }
        }),
      loadPatientDoctor()
        .then(() => {
          setLoadingDoctor(false);
        })
        .catch(err => {
          console.error('[Family] Error al cargar doctor:', err);
          setLoadingDoctor(false);
        })
    ]);
  }, [user?.id, pacienteId]); 
  // Función para manejar la aceptación de la política
  const handleAcceptPolicy = async () => {
    if (isAcceptingPolicy) return;
    
    setIsAcceptingPolicy(true);
    
    try {
      // Actualizar el estado de aceptación de política
      const response = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          politicaAceptada: 1
          // politicaFecha se establecerá automáticamente con NOW() en el backend
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al actualizar la política');
      }
      
      // Actualizar el estado del usuario y cerrar el modal
      setUser({ ...user, politicaAceptada: 1 });
      setShowPolicyModal(false);
      
      // Cargar datos después de aceptar política usando pacienteId del contexto
      if (pacienteId) {
        setLoadingFamilyMembers(true);
        setLoadingDoctor(true);
        Promise.all([
          loadPatientFamilyMembers()
            .then(() => {
              setLoadingFamilyMembers(false);
            })
            .catch(() => {
              setLoadingFamilyMembers(false);
            }),
          loadPatientDoctor()
            .then(() => {
              setLoadingDoctor(false);
            })
            .catch(() => {
              setLoadingDoctor(false);
            })
        ]);
      }
      
    } catch (error) {
      console.error('Error al aceptar la política:', error);
      setToast({ 
        show: true, 
        message: error.message || 'Error al aceptar la política', 
        type: 'error' 
      });
    } finally {
      setIsAcceptingPolicy(false);
    }
  };

  // Función para manejar el rechazo de la política
  const handleRejectPolicy = () => {
    setToast({ 
      show: true, 
      message: 'Debes aceptar la política de privacidad para continuar', 
      type: 'warning' 
    });
    router.push('/patient/medications');
  };

  useEffect(() => {
    if (!user) {
      router.push('/');
    } else if (user && user.rol !== "paciente") {
      router.push('/');
    }
  }, [user, router]);

  if (!user || user.rol !== "paciente") {
    return null;
  }

  if (showPolicyModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Política de Privacidad</h2>

          <div className="prose prose-sm text-gray-600 mb-6 max-h-[60vh] overflow-y-auto">
            <p className="mb-4">
              Para continuar, necesitamos tu consentimiento para compartir tu información personal
              con los miembros de tu familia.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Al aceptar, estás de acuerdo con nuestra Política de Privacidad y los Términos de Servicio.
            </p>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={handleRejectPolicy}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isAcceptingPolicy}
            >
              Rechazar
            </button>
            <button
              onClick={handleAcceptPolicy}
              className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
              disabled={isAcceptingPolicy}
            >
              {isAcceptingPolicy ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Aceptando...
                </>
              ) : 'Aceptar y continuar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Gestión Familiar</h1>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Doctor Encargado</h2>
        {loadingDoctor ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Cargando información del doctor...</span>
            </div>
          </div>
        ) : patientDoctor ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
                    <span className="text-blue-600 text-2xl font-medium">
                      {patientDoctor.nombre?.charAt(0) || 'D'}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Dr. {patientDoctor.nombre}
                  </h3>
                  <p className="text-sm text-blue-600 font-medium">{patientDoctor.especialidad}</p>
                  <div className="mt-2">
                    {patientDoctor.telefono && (
                      <a 
                        href={`tel:${patientDoctor.telefono}`}
                        className="inline-flex items-center text-sm text-gray-700 hover:text-blue-600 transition-colors"
                      >
                        <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {patientDoctor.telefono}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Sin médico asignado</h3>
            <p className="text-gray-500">Actualmente no tienes un doctor asignado.</p>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Miembros de la Familia</h2>
          <p className="text-sm text-gray-500">
            {patientFamilyMembers?.length || 0} miembro{(patientFamilyMembers?.length || 0) !== 1 ? 's' : ''} en tu familia
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          {showAddForm ? (
            <>
              <FiX className="-ml-1 mr-2 h-5 w-5" />
              Cancelar
            </>
          ) : (
            <>
              <FiPlus className="-ml-1 mr-2 h-5 w-5" />
              Agregar Familiar
            </>
          )}
        </button>
      </div>

      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showAddForm ? 'max-h-[1000px] opacity-100 mb-8' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <AddFamilyMemberForm
            onAdd={async (member) => {
              try {
                if (!pacienteId) {
                  throw new Error('No se pudo obtener la información del paciente');
                }
                           
                setLoadingFamilyMembers(true);
                const response = await handleAddFamilyMember(pacienteId, member);
                
                if (response) {
                  setToast({
                    show: true,
                    message: 'Familiar agregado exitosamente',
                    type: 'success'
                  });
                  await loadPatientFamilyMembers(true).then(() => {
                    setLoadingFamilyMembers(false);
                  }).catch(() => {
                    setLoadingFamilyMembers(false);
                  });
                }
                setShowAddForm(false);
              } catch (error) {
                setToast({ 
                  show: true, 
                  message: error.message || 'Error al agregar el familiar', 
                  type: 'error' 
                });
              }
            }}
            onError={(errorMessage) => {
              setToast({
                show: true,
                message: errorMessage,
                type: 'error'
              });
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      </div>

      {loadingFamilyMembers ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">Cargando miembros de la familia...</p>
          </div>
        </div>
      ) : error && (!patientFamilyMembers || patientFamilyMembers.length === 0) ? (
        <div className="text-center py-12 text-red-600">
          <p>{error}</p>
        </div>
      ) : patientFamilyMembers && patientFamilyMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patientFamilyMembers.map((member) => (
            <FamilyMemberCard
              key={member.id}
              member={member}
              onRemove={(memberId) => {
                setMemberToDelete(memberId);
                setShowDeleteModal(true);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay miembros familiares</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comienza agregando un nuevo miembro a tu familia.
          </p>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        className="bg-black/50"
        onConfirm={async () => {
          if (!memberToDelete || !pacienteId) return;
          
          try {
            // Eliminar de la base de datos usando el ID del paciente
            const response = await fetch(`/api/pacientes/${pacienteId}/familiares?familiarId=${memberToDelete}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.error || 'Error al eliminar el familiar');
            }
            
            await handleRemoveFamilyMember(pacienteId, memberToDelete);
            
            setShowDeleteModal(false);
            
            setToast({ 
              show: true, 
              message: 'Familiar eliminado correctamente', 
              type: 'success' 
            });
            
            await loadPatientFamilyMembers(true).catch(() => {
            });
          } catch (error) {
            console.error('Error eliminando familiar:', error);
            setToast({ 
              show: true, 
              message: error.message || 'No se pudo eliminar el familiar. Por favor, inténtalo de nuevo.', 
              type: 'error' 
            });
            setShowDeleteModal(false);
          } finally {
            setMemberToDelete(null);
          }
        }}
        title="Eliminar familiar"
        message="¿Estás seguro de que deseas eliminar a este familiar? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {/* Toast Notification */}
      {toast.show && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
        />
      )}
    </div>
  );

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);
}