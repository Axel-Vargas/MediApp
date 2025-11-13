"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useUser } from "@/context/userContext";
import { useRouter } from "next/navigation";
import MedicationCard from "@/components/MedicationCard";
import MedicationHistoryChart from "@/components/MedicationHistoryChart";

export default function Medications() {
  const { user, loading, pacienteId, patientMedications, loadPatientMedications, invalidateMedicationHistory } = useUser();
  const router = useRouter();
  const [error, setError] = useState(null);

  // Cargar medicaciones desde el contexto (con caché)
  useEffect(() => {
    if (!loading && user && user.rol === 'paciente' && pacienteId) {
      loadPatientMedications().catch(err => {
        console.error('[Medications] Error al cargar medicaciones:', err);
        setError(err.message || 'Error al cargar las medicaciones');
      });
    }
  }, [user?.id, pacienteId]);

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!user || user.rol !== 'paciente') {
    if (typeof window !== 'undefined') {
      router.push('/');
    }
    return null;
  }

  // Filtrar solo medicaciones activas y mapear los campos - memoizado
  const mappedMedications = useMemo(() => {
    if (!patientMedications || patientMedications.length === 0) return [];
    
    return patientMedications
      .filter(med => med.activo === true || med.activo === 1 || med.active === true) 
      .map(med => {
        return {
          ...med,
          name: med.nombreMedicamento,
          dosage: med.dosis,
          days: med.dias,
          hours:
            typeof med.horario === "string" && med.horario.trim().startsWith("[")
              ? JSON.parse(med.horario)
              : (Array.isArray(med.horario) ? med.horario : [med.horario]),
          notes: med.notas || '', 
          yaTomada: med.yaTomada || false,
          fechaMarcado: med.fechaMarcado || null,
          debeTomarHoy: med.debeTomarHoy !== false,
          proximoDia: med.proximoDia || null
        };
      });
  }, [patientMedications]);

  // Función para manejar cuando se toma una medicación - memoizada
  const handleMedicationTaken = useCallback(async (medicationId) => {
    try {
      await loadPatientMedications(true);
      if (pacienteId) {
        invalidateMedicationHistory(pacienteId);
      }
    } catch (err) {
      console.error('Error al actualizar el estado de las medicaciones:', err);
    }
  }, [loadPatientMedications, invalidateMedicationHistory, pacienteId]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Mis Medicamentos</h1>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Error: {error}
        </div>
      )}
      <MedicationHistoryChart medications={mappedMedications} pacienteId={pacienteId} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {mappedMedications.map((med) => (
          <MedicationCard 
            key={med.id} 
            medication={med} 
            pacienteId={pacienteId}
            onMedicationTaken={handleMedicationTaken}
          />
        ))}
      </div>
    </div>
  );
}