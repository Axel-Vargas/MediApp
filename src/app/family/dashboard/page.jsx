"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MedicationHistoryChart from "@/components/MedicationHistoryChart";

export default function FamilyDashboard() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientMedications, setPatientMedications] = useState({});
  const [loading, setLoading] = useState(true);
  const [familyMember, setFamilyMember] = useState(null);
  const [patients, setPatients] = useState([]);

  // Cargar datos del familiar
  useEffect(() => {
    const storedFamilyMember = sessionStorage.getItem('familyMember');
    if (storedFamilyMember) {
      const member = JSON.parse(storedFamilyMember);
      setFamilyMember(member);
      if (member.paciente) {
        setPatients([member.paciente]);
        setSelectedPatient(member.paciente);
        loadPatientMedications(member.paciente.id);
      }
    } else {
      router.push('/family/access');
    }
    setLoading(false);
  }, [router]);

  // Cargar medicaciones de un paciente
  const loadPatientMedications = async (patientId) => {
    if (patientMedications[patientId]) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/pacientes/${patientId}/medicaciones`);
      if (response.ok) {
        const medications = await response.json();
        setPatientMedications(prev => ({
          ...prev,
          [patientId]: medications
        }));
      } else {
        console.error(`[Family Dashboard] Error al cargar medicaciones: ${response.status}`);
      }
    } catch (error) {
      console.error('[Family Dashboard] Error al cargar medicaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    loadPatientMedications(patient.id);
  };

  // Filtrar pacientes según el término de búsqueda
  const filteredPatients = patients.filter((patient) =>
    (patient.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.telefono || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!familyMember) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No se encontraron datos de familiar. Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Familiar</h1>
          <p className="text-gray-600">Bienvenido, {familyMember.nombre}</p>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem('familyMember');
            router.push('/family/access');
          }}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de pacientes */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute right-3 top-2.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${selectedPatient?.id === patient.id ? 'bg-blue-50' : ''
                    }`}
                >
                  <h4 className="font-medium text-gray-900">{patient.nombre || 'Sin nombre'}</h4>
                  <p className="text-sm text-gray-600">{patient.telefono || 'Sin teléfono'}</p>
                  {patientMedications[patient.id] && (
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span>{patientMedications[patient.id].length} medicaciones</span>
                      <span className="mx-2">•</span>
                      <span className="text-green-600">
                        {patientMedications[patient.id].filter(m => m.active).length} activas
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                No se encontraron pacientes
              </div>
            )}
          </div>
        </div>

        {/* Detalles del paciente seleccionado */}
        <div className="lg:col-span-2">
          {selectedPatient ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                {selectedPatient.nombre || 'Paciente'}
              </h2>

              {/* Gráfico de medicación */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Historial de Medicación</h3>
                <div className="border border-gray-200 rounded-lg p-4">
                  {patientMedications[selectedPatient.id] ? (
                    <MedicationHistoryChart
                      medications={patientMedications[selectedPatient.id] || []}
                      pacienteId={selectedPatient.id}
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No hay datos de medicación disponibles
                    </p>
                  )}
                </div>
              </div>

              {/* Lista de medicaciones */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Medicamentos ({patientMedications[selectedPatient.id]?.length || 0})
                </h3>
                {patientMedications[selectedPatient.id]?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patientMedications[selectedPatient.id].map((med) => (
                      <div key={med.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        {/* Header con estado */}
                        <div className={`px-4 py-3 border-b ${med.active ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                          }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 text-lg truncate">
                                {med.name || 'Medicamento sin nombre'}
                              </h4>
                              {med.notes && (
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium">Notas:</span> {med.notes}
                                </p>
                              )}
                            </div>
                            <div className="ml-3 flex-shrink-0">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${med.active
                                  ? 'bg-green-100 text-green-800 border border-green-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                <span className={`w-2 h-2 rounded-full mr-2 ${med.active ? 'bg-green-400' : 'bg-gray-400'
                                  }`}></span>
                                {med.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Contenido principal */}
                        <div className="p-4 space-y-4">
                          {/* Dosis, Vía de administración y Duración */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Dosis</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {med.dosage || 'No especificada'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Vía</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {med.administrationRouteName || 'No especificada'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Duración</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {med.durationDays || 'No especificada'} días
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Días de la semana */}
                          {med.days && med.days.length > 0 && (
                            <div className="flex items-start">
                              <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3 mt-0.5">
                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 font-medium mb-1">Días de la semana</p>
                                <div className="flex flex-wrap gap-1">
                                  {med.days.map((dia, index) => (
                                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                                      {dia}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Horarios */}
                          {med.hours && med.hours.length > 0 && (
                            <div className="flex items-start">
                              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3 mt-0.5">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 font-medium mb-1">Horarios</p>
                                <div className="flex flex-wrap gap-1">
                                  {med.hours.map((hora, index) => {
                                    const horaFormateada = hora.includes(':') ? hora.substring(0, 5) : hora;
                                    return (
                                      <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                        {horaFormateada}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay medicamentos registrados</h3>
                    <p className="text-gray-500">Este paciente aún no tiene medicamentos asignados</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-500">Selecciona un paciente para ver sus detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
