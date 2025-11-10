"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/userContext";
import { useRouter } from "next/navigation";
import { userService } from "@/lib/services/userService";
import { medicacionService } from "@/lib/services/medicacionService";
import MedicationCard from "@/components/MedicationCard";
import MedicationHistoryChart from "@/components/MedicationHistoryChart";

export default function Medications() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [medications, setMedications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pacienteId, setPacienteId] = useState(null);
  

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    
    // Función para cargar medicaciones solo si hay un usuario autenticado
    const loadMedications = async () => {
      if (loading || !user || !user.id) {
        if (isMounted) setIsLoading(false);
        return;
      }
      try {
        // Paso 1: Obtener el paciente por usuarioId
        const paciente = await userService.getPacienteByUsuarioId(user.id);
        if (!paciente || !paciente.id) {
          throw new Error('No se encontró el paciente asociado a este usuario');
        }
        // Paso 2: Obtener medicaciones usando el id del paciente
        const data = await medicacionService.obtenerMedicacionesPorPaciente(paciente.id);
        if (isMounted) {
          setMedications(Array.isArray(data) ? data : []);
          setPacienteId(paciente.id);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error(`[Medications] Error:`, err);
          setError(err.message || 'Error al cargar las medicaciones');
          setMedications([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadMedications();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [user, loading]);

  if (loading) {
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

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Error: {error}</div>;
  }

  // Filtrar solo medicaciones activas y mapear los campos
  const mappedMedications = medications
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



  // Función para manejar cuando se toma una medicación
  const handleMedicationTaken = async (medicationId) => {
    try {
      setMedications(prevMedications => 
        prevMedications.map(med => 
          med.id === medicationId 
            ? { ...med, yaTomada: true, fechaMarcado: new Date().toISOString() }
            : med
        )
      );

      // Recargar las medicaciones para sincronizar con el servidor
      const paciente = await userService.getPacienteByUsuarioId(user.id);
      if (paciente && paciente.id) {
        const data = await medicacionService.obtenerMedicacionesPorPaciente(paciente.id);
        setMedications(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error al actualizar el estado de las medicaciones:', err);
      setMedications(prevMedications => 
        prevMedications.map(med => 
          med.id === medicationId 
            ? { ...med, yaTomada: false, fechaMarcado: null }
            : med
        )
      );
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Mis Medicamentos</h1>
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