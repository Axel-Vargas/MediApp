import React, { useState, useEffect, useRef, memo } from "react";
import Toast from "./Toast";
import { verificarEstadoMedicacion, marcarMedicacionComoTomada, marcarDosisPerdida } from "@/lib/services/medicacionService";

const MedicationCard = memo(({ medication, pacienteId, onMedicationTaken }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isTaken, setIsTaken] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [fechaMarcado, setFechaMarcado] = useState(null);
  const [debeTomarHoy, setDebeTomarHoy] = useState(true);
  const [proximoDia, setProximoDia] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDoseMissed, setIsDoseMissed] = useState(false);
  const [estadoHorarios, setEstadoHorarios] = useState([]);
  const [isHorarioYaMarcado, setIsHorarioYaMarcado] = useState(false);
  const isMarkingAsMissed = useRef(false); 
  

  // Función para calcular la próxima dosis
  const getNextDose = (times) => {
    if (!Array.isArray(times) || times.length === 0) return "No definido";

    const now = getCurrentDate();
    const currentTime = now.getHours() * 60 + now.getMinutes(); 

    // Convertir las horas del medicamento a minutos
    const timesInMinutes = times.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    });

    // Encontrar la próxima hora que sea mayor a la hora actual
    const nextTimeInMinutes = timesInMinutes.find((time) => time > currentTime);

    if (nextTimeInMinutes !== undefined) {
      const nextHours = Math.floor(nextTimeInMinutes / 60);
      const nextMinutes = nextTimeInMinutes % 60;
      return `${nextHours.toString().padStart(2, "0")}:${nextMinutes
        .toString()
        .padStart(2, "0")}`;
    }

    // Si no hay una próxima hora hoy, devolver la primera hora del día siguiente
    const [firstHours, firstMinutes] = times[0].split(":").map(Number);
    return `${firstHours.toString().padStart(2, "0")}:${firstMinutes
      .toString()
      .padStart(2, "0")}`;
  };

  // Función para verificar si ya se tomó la dosis en el horario actual
  const isCurrentDoseTaken = () => {
    if (!medication.hours || !Array.isArray(medication.hours) || medication.hours.length === 0) {
      return false;
    }

    const now = getCurrentDate();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const timesInMinutes = medication.hours.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    });

    const currentDoseTime = timesInMinutes
      .filter(time => time <= currentTime)
      .sort((a, b) => b - a)[0];

    if (currentDoseTime === undefined) {
      return false; 
    }

    return isTaken;
  };

  // Función para obtener el próximo horario disponible
  const getNextAvailableTime = () => {
    if (!medication.hours || !Array.isArray(medication.hours) || medication.hours.length === 0) {
      return null;
    }

    const now = getCurrentDate();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const toleranceMinutes = 10; 

    const timesInMinutes = medication.hours.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    });

    // Encontrar el próximo horario que aún no se ha tomado (considerando tolerancia)
    const nextTime = timesInMinutes.find(time => {
      const timeWithTolerance = time + toleranceMinutes;
      return timeWithTolerance > currentTime;
    });

    if (nextTime !== undefined) {
      const nextHours = Math.floor(nextTime / 60);
      const nextMinutes = nextTime % 60;
      return `${nextHours.toString().padStart(2, "0")}:${nextMinutes.toString().padStart(2, "0")}`;
    }

    return null;
  };

  const getCurrentDate = () => {
    return new Date();
  };

  const normalizeText = (text) => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // Función para verificar si la medicación se debe tomar hoy
  const shouldTakeToday = () => {
    if (!medication.days || medication.days.length === 0) {
      return true;
    }
    
    const today = getCurrentDate().toLocaleDateString('es-ES', { weekday: 'long' });
    const todayNormalized = normalizeText(today);
    
    let daysArray = medication.days;
    if (typeof daysArray === 'string') {
      daysArray = daysArray.split(',').map(day => normalizeText(day.trim()));
    } else if (Array.isArray(daysArray)) {
      daysArray = daysArray.map(day => normalizeText(day));
    }
    
    return daysArray.includes(todayNormalized);
  };

  // Función para obtener el horario actual disponible
  const getCurrentAvailableTime = () => {
    if (!shouldTakeToday()) {
      return null;
    }
    if (!medication.hours || !Array.isArray(medication.hours) || medication.hours.length === 0) {
      return null;
    }

    const now = getCurrentDate();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const toleranceMinutes = 10; 

    const timesInMinutes = medication.hours.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    });

    for (let i = 0; i < timesInMinutes.length; i++) {
      const time = timesInMinutes[i];
      const timeWithTolerance = time + toleranceMinutes;
      const isAvailable = currentTime >= time && currentTime < timeWithTolerance; 
      
      if (isAvailable) {
        const horarioString = medication.hours[i];
        const horarioTomado = estadoHorarios.find(h => h.horario === horarioString)?.tomado || false;
        
        if (!horarioTomado) {
          return horarioString;
        }
      }
    }
    return null;
  };

  // Función para verificar si hay horarios disponibles hoy 
  const hasAvailableTimesToday = () => {
    return getCurrentAvailableTime() !== null;
  };

  // Función para verificar si se perdió la dosis del día
  const checkIfDoseMissed = () => {
    if (!shouldTakeToday()) {
      return false;
    }
    if (!medication.hours || !Array.isArray(medication.hours) || medication.hours.length === 0) {
      return false;
    }

    const now = getCurrentDate();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const toleranceMinutes = 10; 

    const timesInMinutes = medication.hours.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    });
    
    const hasFutureTimes = timesInMinutes.some((time, index) => {
      const timeWithTolerance = time + toleranceMinutes;
      const isFuture = currentTime < timeWithTolerance; 
      const horarioString = medication.hours[index];
      const horarioTomado = estadoHorarios.find(h => h.horario === horarioString)?.tomado || false;
      
      return isFuture && !horarioTomado;
    });
    
    const allTimesPassed = timesInMinutes.every((time, index) => {
      const timeWithTolerance = time + toleranceMinutes;
      const hasPassed = currentTime >= timeWithTolerance; // Cambio: >= en lugar de >
      const horarioString = medication.hours[index];
      const horarioTomado = estadoHorarios.find(h => h.horario === horarioString)?.tomado || false;
      
      return hasPassed && !horarioTomado;
    });
    
    const doseMissed = allTimesPassed && !hasFutureTimes;
    
    return doseMissed;
  };

  // Función para obtener el próximo día de la semana configurado
  const getNextScheduledDay = () => {
    if (!medication.days || medication.days.length === 0) return null;
    
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const today = getCurrentDate().toLocaleDateString('es-ES', { weekday: 'long' });
    const todayNormalized = normalizeText(today);
    const indiceActual = diasSemana.findIndex(day => normalizeText(day) === todayNormalized);
    
    let daysArray = medication.days;
    if (typeof daysArray === 'string') {
      daysArray = daysArray.split(',').map(day => normalizeText(day.trim()));
    } else if (Array.isArray(daysArray)) {
      daysArray = daysArray.map(day => normalizeText(day));
    }
    
    if (daysArray.includes(todayNormalized)) {
      return null; 
    }
    
    for (let i = 1; i <= 7; i++) {
      const proximoIndice = (indiceActual + i) % 7;
      const proximoDia = diasSemana[proximoIndice];
      const proximoDiaNormalized = normalizeText(proximoDia);
      
      if (daysArray.includes(proximoDiaNormalized)) {
        return proximoDia;
      }
    }
    
    if (typeof medication.days === 'string') {
      const firstDay = medication.days.split(',')[0].trim();
      return firstDay;
    } else if (Array.isArray(medication.days)) {
      return medication.days[0];
    }
    return null;
  };

  // Verificar el estado de la medicación al cargar el componente
  useEffect(() => {
    const checkMedicationStatus = async () => {
      if (!pacienteId || !medication.id) {
        setIsCheckingStatus(false);
        return;
      }

      if (medication.activo === false || medication.activo === 0 || medication.active === false) {
        setIsCheckingStatus(false);
        return;
      }

      try {
        const data = await verificarEstadoMedicacion(medication.id, pacienteId);
        
        const horariosActualizados = data.estadoHorarios || [];
        setEstadoHorarios(horariosActualizados);
        
        const hoy = new Date().toISOString().split('T')[0];
        const hayHorariosTomadosHoy = horariosActualizados.some(h => 
          h.tomado && h.fechaMarcado && h.fechaMarcado.startsWith(hoy)
        );
        
        const todosLosHorariosTomados = horariosActualizados.length > 0 && 
          horariosActualizados.every(h => h.tomado);
        
        if (hayHorariosTomadosHoy || todosLosHorariosTomados) {
          setIsTaken(true);
          const ultimoHorarioTomado = [...horariosActualizados]
            .filter(h => h.tomado)
            .sort((a, b) => new Date(b.fechaMarcado) - new Date(a.fechaMarcado))[0];
            
          setFechaMarcado(ultimoHorarioTomado?.fechaMarcado || data.fechaMarcado || new Date().toISOString());
          setDebeTomarHoy(false);
          setProximoDia(data.proximoDia || getNextScheduledDay());
          return;
        }
        
        setIsTaken(false);
        setFechaMarcado(null);
        
        if (data.debeTomarHoy !== undefined) {
          setDebeTomarHoy(data.debeTomarHoy);
        } else {
          const shouldTake = shouldTakeToday();
          const hasAvailableTimes = hasAvailableTimesToday();
          const localDebeTomarHoy = shouldTake && hasAvailableTimes;
          setDebeTomarHoy(localDebeTomarHoy);
        }
        
        setProximoDia(data.proximoDia || getNextScheduledDay());
        
        if (data.dosisPerdida !== undefined) {
          setIsDoseMissed(data.dosisPerdida);
        } else {
          const doseMissed = checkIfDoseMissed();
          setIsDoseMissed(doseMissed);
        }

      } catch (error) {
        console.error('Error al verificar estado de medicación:', error);
        try {
          const shouldTake = shouldTakeToday();
          const hasAvailableTimes = hasAvailableTimesToday();
          const doseMissed = checkIfDoseMissed();
          const localDebeTomarHoy = shouldTake && hasAvailableTimes;
          
          setIsTaken(false);
          setFechaMarcado(null);
          setDebeTomarHoy(localDebeTomarHoy);
          setProximoDia(getNextScheduledDay());
          setIsDoseMissed(doseMissed);
        } catch (fallbackError) {
          console.error('Error en lógica de fallback:', fallbackError);
          setIsTaken(false);
          setFechaMarcado(null);
          setDebeTomarHoy(false);
          setProximoDia('');
          setIsDoseMissed(false);
        }
        
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkMedicationStatus();
  }, [pacienteId, medication.id]);



  // Verificar periódicamente si las dosis se perdieron
  useEffect(() => {
    if (!shouldTakeToday() || isTaken) {
      return;
    }

    const checkMissedDose = () => {
      const doseMissed = checkIfDoseMissed();
      
      if (doseMissed !== isDoseMissed) {
        setIsDoseMissed(doseMissed);
        
        if (doseMissed && !isMarkingAsMissed.current) {
          isMarkingAsMissed.current = true;
          
          marcarDosisPerdida(medication.id, pacienteId).then(() => {
            isMarkingAsMissed.current = false;
          }).catch(error => {
            console.error('Error al marcar dosis como perdida:', error);
            isMarkingAsMissed.current = false;
          });
        }
      }
    };

    const interval = setInterval(checkMissedDose, 60000);
    
    checkMissedDose();

    return () => clearInterval(interval);
  }, [medication.id, pacienteId, shouldTakeToday, isTaken]); 
  
  // Actualizar el estado de horario marcado cuando cambian los horarios
  useEffect(() => {
    if (!medication.hours || !Array.isArray(medication.hours)) return;
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    const currentSchedule = medication.hours.find(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduleTimeInMinutes = hours * 60 + minutes;
      return (scheduleTimeInMinutes + 10) >= currentTimeInMinutes;
    });
    
    if (currentSchedule) {
      const horarioMarcado = estadoHorarios.some(h => 
        h.horario === currentSchedule && h.tomado
      );
      setIsHorarioYaMarcado(horarioMarcado);
    } else {
      setIsHorarioYaMarcado(false);
    }
  }, [estadoHorarios, medication.hours]);

  // Función para marcar la medicación como tomada
  const handleMarkAsTaken = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isLoading) return;
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Encontrar el horario más cercano que aún no ha pasado 
    const currentSchedule = (medication.hours || []).find(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduleTimeInMinutes = hours * 60 + minutes;
      return (scheduleTimeInMinutes + 10) >= currentTimeInMinutes; 
    });
    
    // Verificar si ya está marcado este horario
    const horarioMarcado = currentSchedule ? estadoHorarios.some(h => 
      h.horario === currentSchedule && h.tomado
    ) : false;
    
    setIsHorarioYaMarcado(horarioMarcado);
    
    if (horarioMarcado) {
      setToast({
        message: `Ya se marcó este horario (${currentSchedule}) como tomado.`,
        type: 'info'
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const data = await marcarMedicacionComoTomada(
        medication.id, 
        pacienteId,
        currentSchedule
      );
      
      setEstadoHorarios(prev => [
        ...prev.filter(h => h.horario !== currentSchedule),
        {
          horario: currentSchedule,
          tomado: true,
          fechaMarcado: new Date().toISOString()
        }
      ]);
      
      setToast({
        message: `¡${medication.name} marcada como tomada a las ${currentSchedule}!`,
        type: 'success'
      });
      
      if (onMedicationTaken) {
        onMedicationTaken(medication.id);
      }
      
    } catch (error) {
      console.error('Error al marcar medicación como tomada:', error);
      setToast({
        message: error.message || 'Error al marcar la medicación como tomada. Intenta de nuevo.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      data-medication-card
      className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow ${isCheckingStatus ? 'opacity-75' : ''}`}
    >
      <div className="p-6">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-semibold text-gray-900">{medication.name}</h2>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            {medication.dosage}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-gray-600">
            <span className="font-medium">Horario:</span>{" "}
            {Array.isArray(medication.hours)
              ? medication.hours.join(", ")
              : (typeof medication.hours === "string" ? medication.hours.split(",").join(", ") : "")}
          </p>
          <p className="text-gray-600">
            <span className="font-medium">Dias:</span>{" "}
            {Array.isArray(medication.days)
              ? medication.days.join(", ")
              : (typeof medication.days === "string" ? medication.days.split(",").join(", ") : "")}
          </p>
          {medication.notes && (
            <p className="text-gray-600">
              <span className="font-medium">Notas:</span> {medication.notes}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="flex flex-col">
            <button 
              type="button"
              onClick={(e) => handleMarkAsTaken(e)}
              disabled={isLoading || isCheckingStatus || isHorarioYaMarcado}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isCheckingStatus
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : isHorarioYaMarcado
                  ? 'bg-green-500 text-white cursor-default'
                  : isLoading || isCheckingStatus
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              {isCheckingStatus 
                ? 'Verificando...' 
                : isLoading 
                ? 'Marcando...' 
                : isHorarioYaMarcado
                ? '✓ Tomada' 
                : isLoading || isCheckingStatus
                ? 'Procesando...'
                : 'Tomé la dosis'
              }
            </button>
            {isTaken && fechaMarcado && (
              <span className="text-xs text-green-600 mt-1">
                Tomada: {new Date(fechaMarcado).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {isTaken && !debeTomarHoy && proximoDia && (
              <span className="text-xs text-blue-600 mt-1">
                Próxima dosis: {proximoDia}
              </span>
            )}

          </div>
          <span className="text-sm text-gray-500">
            Próxima: {getNextDose(medication.hours)}
          </span>
        </div>
      </div>
      
      {/* Toast de notificación */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.medication?.id === nextProps.medication?.id &&
    prevProps.pacienteId === nextProps.pacienteId &&
    prevProps.medication?.activo === nextProps.medication?.activo &&
    prevProps.medication?.yaTomada === nextProps.medication?.yaTomada &&
    JSON.stringify(prevProps.medication?.hours) === JSON.stringify(nextProps.medication?.hours)
  );
});

MedicationCard.displayName = 'MedicationCard';

export default MedicationCard;