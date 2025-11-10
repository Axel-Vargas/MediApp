"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/userContext";
import Toast from "@/components/Toast";
import { encryptToPacked } from "@/lib/crypto";

export default function AssignMedication() {
  const { user, loading } = useUser();
  const router = useRouter();

  // Estado para guardar las medicaciones por paciente
  const [medicacionesPorPaciente, setMedicacionesPorPaciente] = useState({});
  
  // Estado para las vías de administración
  const [viasAdministracion, setViasAdministracion] = useState([]);
  
  // Estado para el Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (!user?.patients) return;
    const fetchMedicaciones = async () => {
      const result = {};
      for (const paciente of user.patients) {
        try {
          const res = await fetch(`/api/pacientes/${paciente.id}/medicaciones`);
          const data = await res.json();
          result[paciente.id] = Array.isArray(data) ? data : [];
        } catch (e) {
          result[paciente.id] = [];
        }
      }
      setMedicacionesPorPaciente(result);
    };
    fetchMedicaciones();
  }, [user?.patients]);

  // Cargar vías de administración
  useEffect(() => {
    const fetchViasAdministracion = async () => {
      try {
        const response = await fetch('/api/vias-administracion?activas=true');
        const data = await response.json();
        setViasAdministracion(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error al cargar vías de administración:', error);
        setViasAdministracion([]);
      }
    };
    
    fetchViasAdministracion();
  }, []);

  const [formData, setFormData] = useState({
    patientId: "",
    administrationRoute: "", 
    name: "",
    dosage: "",
    dosageUnit: "mg",
    frequency: [], 
    times: [""],
    startDate: "", 
    endDate: "", 
    notes: "",
  });

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'doctor')) {
      router.push('/');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!user || user.rol !== 'doctor') {
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Validación especial para el campo de dosis
    if (name === 'dosage') {
      const numericValue = value.replace(/[^0-9.]/g, '');
      
      const parts = numericValue.split('.');
      const validValue = parts.length > 2 
        ? parts[0] + '.' + parts.slice(1).join('')
        : numericValue;
      
      setFormData((prev) => ({ ...prev, [name]: validValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...formData.times];
    newTimes[index] = value;
    setFormData((prev) => ({ ...prev, times: newTimes }));
  };

  const addTimeField = () => {
    setFormData((prev) => ({ ...prev, times: [...prev.times, ""] }));
  };

  // Manejar el cambio de los checkboxes de días
  const handleFrequencyChange = (day) => {
    setFormData((prev) => {
      if (prev.frequency.includes(day)) {
        return { ...prev, frequency: prev.frequency.filter((d) => d !== day) };
      } else {
        return { ...prev, frequency: [...prev.frequency, day] };
      }
    });
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ show: false, message: '', type: 'success' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validar que se haya seleccionado un paciente
      if (!formData.patientId) {
        showToast('Por favor selecciona un paciente', 'error');
        return;
      }

      // Validar campos requeridos
      if (!formData.name || !formData.dosage || formData.times.length === 0 || formData.frequency.length === 0) {
        showToast('Por favor completa todos los campos requeridos', 'error');
        return;
      }

      // Validar que al menos un horario tenga un valor
      if (formData.times.every(time => !time.trim())) {
        showToast('Por favor ingresa al menos un horario', 'error');
        return;
      }

      // Validar fechas
      if (!formData.startDate) {
        showToast('Por favor ingresa la fecha de inicio', 'error');
        return;
      }

      // Calcular duración en días si hay fecha de fin
      let diffDays = 0;
      if (formData.startDate && formData.endDate) {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }

      // Preparar los datos para enviar al servidor
      const dataToSend = {
        pacienteId: parseInt(formData.patientId, 10),
        nombreMedicamento: formData.name.trim(),
        dosis: `${formData.dosage.trim()} ${formData.dosageUnit}`, 
        viaAdministracion: formData.administrationRoute, 
        dias: formData.frequency.join(","),
        horario: JSON.stringify(formData.times.filter(time => time.trim() !== '')),
        fechaInicio: formData.startDate,
        fechaFin: formData.endDate || null,
        duracionDias: diffDays || null,
        notas: formData.notes?.trim() || '',
        activo: true
      };

      const response = await fetch('/api/medicaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar la medicación');
      }

      const result = await response.json();

      // Actualizar el estado local con la nueva medicación
      setMedicacionesPorPaciente(prev => ({
        ...prev,
        [formData.patientId]: [...(prev[formData.patientId] || []), result]
      }));

      showToast('Medicación asignada correctamente', 'success');

      setFormData({
        patientId: '',
        administrationRoute: '',
        name: '',
        dosage: '',
        dosageUnit: 'mg',
        frequency: [],
        times: [''],
        startDate: '',
        endDate: '',
        notes: '',
      });
    } catch (error) {
      console.error(error);
      showToast('Error al guardar la medicación: ' + error.message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
      {/* Formulario para asignar medicación */}
      <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Asignar nueva medicación
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Paciente
              </label>
              <select
                name="patientId"
                value={formData.patientId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                required
              >
                <option value="">Seleccionar paciente</option>
                {(user.patients || []).map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Vía de administración
              </label>
              <select
                name="administrationRoute"
                value={formData.administrationRoute}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                required
              >
                <option value="">Seleccionar vía</option>
                {viasAdministracion.map((via) => (
                  <option key={via.id} value={via.id}>
                    {via.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Nombre del medicamento
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Dosis
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="dosage"
                  value={formData.dosage}
                  onChange={handleChange}
                  placeholder="Ej: 500"
                  className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                  required
                />
                <select
                  name="dosageUnit"
                  value={formData.dosageUnit}
                  onChange={handleChange}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-transparent border-none outline-none text-gray-600 text-sm"
                >
                  <option value="mg">mg</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="mcg">mcg</option>
                  <option value="UI">UI</option>
                  <option value="unidad">unidad</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Fecha de inicio
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                required
                min={new Date(new Date().setHours(0, 0, 0, 0)).toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Fecha de fin
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                required
                min={formData.startDate || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Selector de días con borde similar a los inputs y botón fuera, al nivel del título */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-gray-700 text-sm font-medium">
                Frecuencia (días de la semana)
              </label>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, frequency: [] }))}
                className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700 transition-colors"
              >
                Desmarcar todos
              </button>
            </div>
            <div className="border border-gray-300 rounded-md p-2 md:p-4">
              <div className="grid grid-cols-7 gap-1 md:gap-2 mb-1">
                {[
                  { label: "Lunes", value: "lunes", short: "L" },
                  { label: "Martes", value: "martes", short: "M" },
                  { label: "Miércoles", value: "miércoles", short: "X" },
                  { label: "Jueves", value: "jueves", short: "J" },
                  { label: "Viernes", value: "viernes", short: "V" },
                  { label: "Sábado", value: "sábado", short: "S" },
                  { label: "Domingo", value: "domingo", short: "D" },
                ].map((day) => (
                  <div key={day.value} className="flex flex-col items-center">
                    <label htmlFor={`check-${day.value}`} className="mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.frequency.includes(day.value)}
                        onChange={() => handleFrequencyChange(day.value)}
                        id={`check-${day.value}`}
                        className="sr-only peer"
                      />
                      <div className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full border-2 border-gray-400 peer-checked:border-blue-600 bg-white transition-colors duration-200">
                        {formData.frequency.includes(day.value) && (
                          <svg className="w-3 h-3 md:w-4 md:h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {[
                  { label: "Lunes", value: "lunes", short: "L" },
                  { label: "Martes", value: "martes", short: "M" },
                  { label: "Miércoles", value: "miércoles", short: "X" },
                  { label: "Jueves", value: "jueves", short: "J" },
                  { label: "Viernes", value: "viernes", short: "V" },
                  { label: "Sábado", value: "sábado", short: "S" },
                  { label: "Domingo", value: "domingo", short: "D" },
                ].map((day) => (
                  <label
                    key={day.value}
                    htmlFor={`check-${day.value}`}
                    className={`text-center text-xs md:text-sm font-medium cursor-pointer select-none
                        ${formData.frequency.includes(day.value) ? 'text-blue-700 font-bold' : 'text-gray-700'}`}
                  >
                    <span className="md:hidden">{day.short}</span>
                    <span className="hidden md:inline">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Horarios
            </label>
            {formData.times.map((time, index) => (
              <div key={index} className="flex mb-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(index, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
                  required
                />
                {index === formData.times.length - 1 && (
                  <button
                    type="button"
                    onClick={addTimeField}
                    className="ml-2 px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Notas
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
              rows="3"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors mt-2"
          >
            Asignar Medicación
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Resumen de Pacientes
        </h3>
        <div className="space-y-4">
          {(user.patients || []).map((patient) => (
            <div
              key={patient.id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <h4 className="font-medium text-gray-900">
                {patient.nombre}
              </h4>
              <p className="text-sm text-gray-600">
                Medicamentos: {(medicacionesPorPaciente[patient.id] || []).length} | Pendientes: 0
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Toast para notificaciones */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </div>
  );
}