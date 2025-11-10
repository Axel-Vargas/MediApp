"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/context/userContext";
import MedicationHistoryChart from "@/components/MedicationHistoryChart";
import ConfirmationModal from "@/components/ConfirmationModal";

export default function PatientList() {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientMedications, setPatientMedications] = useState({});
  const [loadingMedications, setLoadingMedications] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    dosage: '',
    dosageUnit: 'mg',
    administrationRoute: '',
    startDate: '',
    endDate: '',
    durationDays: '',
    notes: '',
    days: [],
    hours: []
  });
  const [viasAdministracion, setViasAdministracion] = useState([]);

  // Verificar que el usuario existe y es un doctor
  if (!user || user.rol !== 'doctor') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Acceso no autorizado. Solo los doctores pueden ver esta página.</p>
      </div>
    );
  }

  // Filtrar pacientes según el término de búsqueda
  const filteredPatients = (user.patients || []).filter((patient) =>
    (patient.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.telefono || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Función para cargar las medicaciones de un paciente
  const loadPatientMedications = async (patientId) => {
    if (patientMedications[patientId]) {
      return;
    }

    setLoadingMedications(true);
    try {
      const response = await fetch(`/api/pacientes/${patientId}/medicaciones`);
      if (response.ok) {
        const medications = await response.json();
        setPatientMedications(prev => ({
          ...prev,
          [patientId]: medications
        }));
      } else {
        console.error('Error al cargar medicaciones:', response.statusText);
        setPatientMedications(prev => ({
          ...prev,
          [patientId]: []
        }));
      }
    } catch (error) {
      console.error('Error al cargar medicaciones:', error);
      setPatientMedications(prev => ({
        ...prev,
        [patientId]: []
      }));
    } finally {
      setLoadingMedications(false);
    }
  };

  // Cargar vías de administración al montar el componente
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

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    loadPatientMedications(patient.id);
  };

  // Función para cambiar el estado activo/inactivo de una medicación
  const toggleMedicationStatus = async (medicationId, currentStatus) => {
    try {
      const response = await fetch(`/api/medicaciones/${medicationId}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: !currentStatus }),
      });

      if (response.ok) {
        setPatientMedications(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(patientId => {
            updated[patientId] = updated[patientId].map(med =>
              med.id === medicationId ? { ...med, active: !currentStatus } : med
            );
          });
          return updated;
        });
      } else {
        console.error('Error al cambiar estado de la medicación');
      }
    } catch (error) {
      console.error('Error al cambiar estado de la medicación:', error);
    }
  };

  // Función para abrir el modal de confirmación de eliminación
  const handleDeleteClick = (medicationId) => {
    setMedicationToDelete(medicationId);
    setShowDeleteModal(true);
  };

  // Función para eliminar una medicación
  const deleteMedication = async () => {
    if (!medicationToDelete) return;

    try {
      const response = await fetch(`/api/medicaciones/${medicationToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPatientMedications(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(patientId => {
            updated[patientId] = updated[patientId].filter(med => med.id !== medicationToDelete);
          });
          return updated;
        });
        setShowDeleteModal(false);
        setMedicationToDelete(null);
      } else {
        console.error('Error al eliminar la medicación');
      }
    } catch (error) {
      console.error('Error al eliminar la medicación:', error);
    } finally {
      setShowDeleteModal(false);
      setMedicationToDelete(null);
    }
  };

  // Función para abrir el modal de edición
  const openEditModal = (medication) => {
    setEditingMedication(medication);

    let dosage = '';
    let dosageUnit = 'mg';

    if (medication.dosage) {
      const dosageParts = medication.dosage.trim().split(' ');
      if (dosageParts.length >= 2) {
        dosage = dosageParts[0];
        dosageUnit = dosageParts[1];
      } else {
        dosage = medication.dosage;
      }
    }

    // Convertir fechas de ISO a formato YYYY-MM-DD para el input date
    const startDate = medication.fechaInicio ? medication.fechaInicio.split('T')[0] : '';
    const endDate = medication.fechaFin ? medication.fechaFin.split('T')[0] : '';

    setEditForm({
      name: medication.name || '',
      dosage: dosage,
      dosageUnit: dosageUnit,
      administrationRoute: medication.administrationRoute || '',
      startDate: startDate,
      endDate: endDate,
      durationDays: medication.durationDays || '',
      notes: medication.notes || '',
      days: Array.isArray(medication.days) ? [...medication.days] : medication.days ? [medication.days] : [],
      hours: Array.isArray(medication.hours) ? [...medication.hours] : medication.hours ? [medication.hours] : []
    });
    setShowEditModal(true);
  };

  // Función para manejar cambios en el formulario de edición
  const handleEditChange = (e) => {
    const { name, value } = e.target;

    if (name === 'dosage') {
      const numericValue = value.replace(/[^0-9.]/g, '');

      const parts = numericValue.split('.');
      const validValue = parts.length > 2
        ? parts[0] + '.' + parts.slice(1).join('')
        : numericValue;

      setEditForm((prev) => ({ ...prev, [name]: validValue }));
    } else {
      setEditForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Función para guardar los cambios de edición
  const saveEditChanges = async () => {
    try {
      let diffDays = editForm.durationDays || 0;

      if (editForm.startDate && editForm.endDate) {
        const start = new Date(editForm.startDate);
        const end = new Date(editForm.endDate);
        diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }

      const dataToSend = {
        ...editForm,
        dosage: `${editForm.dosage.trim()} ${editForm.dosageUnit}`,
        durationDays: diffDays,
        fechaInicio: editForm.startDate || null,
        fechaFin: editForm.endDate || null,
        active: editingMedication.active
      };

      const response = await fetch(`/api/medicaciones/${editingMedication.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        const viaSeleccionada = viasAdministracion.find(v => v.id === parseInt(editForm.administrationRoute));
        const administrationRouteName = viaSeleccionada ? viaSeleccionada.nombre : editingMedication.administrationRouteName;

        // Actualizar el estado local con todos los campos actualizados
        setPatientMedications(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(patientId => {
            updated[patientId] = updated[patientId].map(med =>
              med.id === editingMedication.id ? {
                ...med,
                ...editForm,
                dosage: dataToSend.dosage,
                durationDays: diffDays,
                fechaInicio: editForm.startDate,
                fechaFin: editForm.endDate,
                administrationRouteName: administrationRouteName,
                active: dataToSend.active
              } : med
            );
          });
          return updated;
        });

        setShowEditModal(false);
        setEditingMedication(null);
      } else {
        console.error('Error al actualizar la medicación');
      }
    } catch (error) {
      console.error('Error al actualizar la medicación:', error);
    }
  };

  // Cargar medicaciones de todos los pacientes cuando se cargan los pacientes
  useEffect(() => {
    if (user.patients && user.patients.length > 0) {
      user.patients.forEach(patient => {
        loadPatientMedications(patient.id);
      });
    }
  }, [user.patients]);

  // Función para generar reporte detallado del paciente
  const generarReporteDetallado = async (paciente) => {
    try {
      const historialResponse = await fetch(`/api/pacientes/${paciente.id}/medicaciones/historial`);
      const historial = historialResponse.ok ? await historialResponse.json() : [];

      const medicaciones = patientMedications[paciente.id] || [];

      const totalMedicaciones = medicaciones.length;
      const medicacionesActivas = medicaciones.filter(m => m.active).length;
      const medicacionesInactivas = totalMedicaciones - medicacionesActivas;

      let totalDosisTomadas = 0;
      let totalDosisPerdidas = 0;

      historial.forEach(h => {
        if (h.tomada) totalDosisTomadas++;
        if (h.perdida) totalDosisPerdidas++;
      });

      const totalDosis = totalDosisTomadas + totalDosisPerdidas;
      const adherencia = totalDosis > 0 ? ((totalDosisTomadas / totalDosis) * 100).toFixed(1) : 0;

      const reporteHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reporte Médico - ${paciente.nombre}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background: white;
              padding: 30px;
            }
            .container { 
              max-width: 100%; 
              margin: 0 auto; 
              background: white; 
              padding: 0; 
            }
            .header { 
              border-bottom: 3px solid #2563eb; 
              padding-bottom: 20px; 
              margin-bottom: 30px;
              text-align: center;
            }
            .header h1 { 
              color: #2563eb; 
              font-size: 28px; 
              margin-bottom: 10px;
            }
            .header p { 
              color: #666; 
              font-size: 14px;
            }
            .section { 
              margin-bottom: 30px; 
              padding: 20px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .section h2 { 
              color: #1f2937; 
              font-size: 20px; 
              margin-bottom: 15px; 
              border-left: 4px solid #2563eb; 
              padding-left: 12px;
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 15px; 
              margin-bottom: 15px;
            }
            .info-item { 
              padding: 12px;
              background: white;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .info-item label { 
              font-weight: 600; 
              color: #4b5563; 
              display: block; 
              margin-bottom: 5px;
              font-size: 13px;
            }
            .info-item p { 
              color: #1f2937; 
              font-size: 15px;
            }
            .stats-grid { 
              display: grid; 
              grid-template-columns: repeat(3, 1fr); 
              gap: 10px; 
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .stat-card { 
              text-align: center; 
              padding: 12px; 
              background: white;
              border-radius: 6px;
              border: 2px solid #e5e7eb;
            }
            .stat-card h3 { 
              font-size: 24px; 
              margin-bottom: 3px;
            }
            .stat-card p { 
              color: #6b7280; 
              font-size: 11px;
              font-weight: 500;
            }
            .stat-card.blue { border-color: #3b82f6; }
            .stat-card.blue h3 { color: #3b82f6; }
            .stat-card.green { border-color: #10b981; }
            .stat-card.green h3 { color: #10b981; }
            .stat-card.red { border-color: #ef4444; }
            .stat-card.red h3 { color: #ef4444; }
            .medication-list { 
              margin-top: 15px;
            }
            .medication-item { 
              background: white; 
              padding: 15px; 
              margin-bottom: 10px; 
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              border-left: 4px solid #3b82f6;
            }
            .medication-item.inactive { 
              border-left-color: #9ca3af; 
              opacity: 0.7;
            }
            .medication-header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              margin-bottom: 10px;
            }
            .medication-name { 
              font-weight: 600; 
              font-size: 16px; 
              color: #1f2937;
            }
            .badge { 
              padding: 4px 12px; 
              border-radius: 12px; 
              font-size: 12px; 
              font-weight: 600;
            }
            .badge.active { 
              background: #d1fae5; 
              color: #065f46;
            }
            .badge.inactive { 
              background: #f3f4f6; 
              color: #6b7280;
            }
            .medication-details { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 10px;
              font-size: 14px;
            }
            .medication-details p { 
              color: #4b5563;
            }
            .medication-details strong { 
              color: #1f2937;
            }
            .historial-table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              overflow: hidden;
              table-layout: auto;
            }
            .historial-table thead {
              background: #f3f4f6;
            }
            .historial-table th {
              padding: 8px;
              text-align: left;
              font-size: 11px;
              font-weight: 600;
              color: #4b5563;
              border-bottom: 2px solid #e5e7eb;
              text-transform: uppercase;
              white-space: nowrap;
            }
            .historial-table td {
              padding: 6px 8px;
              font-size: 12px;
              color: #1f2937;
              border-bottom: 1px solid #f3f4f6;
            }
            .historial-table td:nth-child(2),
            .historial-table td:nth-child(3),
            .historial-table td:nth-child(4) {
              white-space: nowrap;
            }
            .historial-table tbody tr:hover {
              background: #f9fafb;
            }
            .historial-table tbody tr:last-child td {
              border-bottom: none;
            }
            .estado-badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
            }
            .estado-badge.tomada {
              background: #d1fae5;
              color: #065f46;
            }
            .estado-badge.perdida {
              background: #fee2e2;
              color: #991b1b;
            }
            .estado-badge.pendiente {
              background: #fef3c7;
              color: #92400e;
            }
            .footer { 
              margin-top: 40px; 
              padding-top: 20px; 
              border-top: 2px solid #e5e7eb; 
              text-align: center; 
              color: #6b7280; 
              font-size: 13px;
            }
            @media print {
              @page {
                margin: 0.5cm;
                size: auto;
              }
              body { 
                background: white; 
                padding: 0;
                margin: 0;
              }
              .container { 
                box-shadow: none; 
                padding: 30px;
                page-break-inside: auto;
              }
              .header {
                padding-bottom: 15px;
                margin-bottom: 20px;
              }
              .section {
                page-break-inside: auto;
                break-inside: auto;
              }
              .section.no-break {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .medication-item {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .stat-card {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .info-item {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .historial-table {
                page-break-inside: auto;
                border: 1px solid #000;
              }
              .historial-table thead {
                display: table-header-group;
              }
              .historial-table tbody {
                display: table-row-group;
              }
              .historial-table tbody tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .historial-table th,
              .historial-table td {
                border: 1px solid #e5e7eb;
              }
              .estado-badge {
                border: 1px solid currentColor;
              }
              /* Ocultar encabezados y pies de página del navegador */
              header, footer {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Reporte Médico Detallado</h1>
              <p>MediTrack Pro - Sistema de Gestión de Medicamentos</p>
              <p style="margin-top: 10px; font-size: 12px;">Fecha de emisión: ${new Date().toLocaleString('es-EC', {
        dateStyle: 'full',
        timeStyle: 'short'
      })}</p>
            </div>

            <div class="section no-break">
              <h2>Información del Paciente</h2>
              <div class="info-grid">
                <div class="info-item">
                  <label>Nombre Completo</label>
                  <p>${paciente.nombre || 'No especificado'}</p>
                </div>
                <div class="info-item">
                  <label>Teléfono</label>
                  <p>${paciente.telefono || 'No especificado'}</p>
                </div>
                <div class="info-item" style="grid-column: 1 / -1;">
                  <label>Correo Electrónico</label>
                  <p>${paciente.correo || 'No especificado'}</p>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>Estadísticas Generales</h2>
              <div class="stats-grid">
                <div class="stat-card blue">
                  <h3>${totalMedicaciones}</h3>
                  <p>TOTAL MEDICACIONES</p>
                </div>
                <div class="stat-card green">
                  <h3>${medicacionesActivas}</h3>
                  <p>ACTIVAS</p>
                </div>
                <div class="stat-card red">
                  <h3>${medicacionesInactivas}</h3>
                  <p>INACTIVAS</p>
                </div>
              </div>
              <div class="stats-grid">
                <div class="stat-card green">
                  <h3>${totalDosisTomadas}</h3>
                  <p>DOSIS TOMADAS</p>
                </div>
                <div class="stat-card red">
                  <h3>${totalDosisPerdidas}</h3>
                  <p>DOSIS PERDIDAS</p>
                </div>
                <div class="stat-card ${adherencia >= 80 ? 'green' : adherencia >= 50 ? 'blue' : 'red'}">
                  <h3>${adherencia}%</h3>
                  <p>ADHERENCIA</p>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>Medicaciones del Paciente</h2>
              <div class="medication-list">
                ${medicaciones.length > 0 ? medicaciones.map(med => `
                  <div class="medication-item ${med.active ? '' : 'inactive'}">
                    <div class="medication-header">
                      <span class="medication-name">${med.name || 'Sin nombre'}</span>
                      <span class="badge ${med.active ? 'active' : 'inactive'}">
                        ${med.active ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </div>
                    <div class="medication-details">
                      <p><strong>Dosis:</strong> ${med.dosage || 'No especificada'}</p>
                      <p><strong>Vía:</strong> ${med.administrationRouteName || 'No especificada'}</p>
                      <p><strong>Frecuencia:</strong> ${Array.isArray(med.days) ? med.days.join(', ') : 'No especificada'}</p>
                      <p><strong>Horarios:</strong> ${Array.isArray(med.hours) ? med.hours.join(', ') : 'No especificados'}</p>
                      <p><strong>Fecha Inicio:</strong> ${med.fechaInicio ? new Date(med.fechaInicio).toLocaleDateString('es-EC') : 'No especificada'}</p>
                      <p><strong>Fecha Fin:</strong> ${med.fechaFin ? new Date(med.fechaFin).toLocaleDateString('es-EC') : 'Sin fecha fin'}</p>
                      ${med.notes ? `<p style="grid-column: 1 / -1;"><strong>Notas:</strong> ${med.notes}</p>` : ''}
                    </div>
                  </div>
                `).join('') : '<p style="text-align: center; color: #6b7280; padding: 20px;">No hay medicaciones registradas</p>'}
              </div>
            </div>

            <div class="section no-break">
              <h2>Información del Doctor Tratante</h2>
              <div class="info-grid">
                <div class="info-item">
                  <label>Nombre del Doctor</label>
                  <p>${user.nombre || 'No especificado'}</p>
                </div>
                <div class="info-item">
                  <label>Especialidad</label>
                  <p>${user.especialidadNombre || 'No especificada'}</p>
                </div>
                <div class="info-item">
                  <label>Teléfono</label>
                  <p>${user.telefono || 'No especificado'}</p>
                </div>
                <div class="info-item">
                  <label>Correo</label>
                  <p>${user.correo || 'No especificado'}</p>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>Historial de Medicación</h2>
              ${historial.length > 0 ? `
                <div style="overflow-x: auto;">
                  <table class="historial-table">
                    <thead>
                      <tr>
                        <th>Medicamento</th>
                        <th>Fecha</th>
                        <th>Hora Programada</th>
                        <th>Hora Tomada</th>
                        <th>Dosis</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${historial.slice(0, 100).map(item => {
        const estado = item.tomada ? 'tomada' : item.perdida ? 'perdida' : 'pendiente';
        const estadoTexto = item.tomada ? '✓ Tomada' : item.perdida ? '✗ Perdida' : 'Pendiente';

        let fechaTexto = 'No disponible';
        let horaProgramada = '-';

        if (item.fecha) {
          let fechaCompleta = item.fecha;

          if (fechaCompleta.includes(' ')) {
            const [fechaParte, horaParte] = fechaCompleta.split(' ');

            const partesFecha = fechaParte.split('-');
            if (partesFecha.length === 3) {
              const [year, month, day] = partesFecha;
              fechaTexto = day + '/' + month + '/' + year;
            }

            if (horaParte && horaParte !== '00:00:00') {
              horaProgramada = horaParte.substring(0, 5);
            }
          } else if (fechaCompleta.includes('T')) {
            const [fechaParte, horaParte] = fechaCompleta.split('T');

            const partesFecha = fechaParte.split('-');
            if (partesFecha.length === 3) {
              const [year, month, day] = partesFecha;
              fechaTexto = day + '/' + month + '/' + year;
            }

            if (horaParte) {
              const horaLimpia = horaParte.split('.')[0];
              if (horaLimpia !== '00:00:00') {
                horaProgramada = horaLimpia.substring(0, 5);
              }
            }
          }
        }

        let horaTomada = '-';
        if (item.tomada && item.fechaMarcado) {
          try {
            const fechaMarcadoDate = new Date(item.fechaMarcado);
            if (!isNaN(fechaMarcadoDate.getTime())) {
              const hours = String(fechaMarcadoDate.getHours()).padStart(2, '0');
              const minutes = String(fechaMarcadoDate.getMinutes()).padStart(2, '0');
              horaTomada = hours + ':' + minutes;
            }
          } catch (e) {
            horaTomada = '-';
          }
        }

        return `
                        <tr>
                          <td>${item.medicacionNombre || 'No especificado'}</td>
                          <td>${fechaTexto}</td>
                          <td>${horaProgramada}</td>
                          <td>${horaTomada}</td>
                          <td>${item.dosis || 'No especificada'}</td>
                          <td>
                            <span class="estado-badge ${estado}">
                              ${estadoTexto}
                            </span>
                          </td>
                        </tr>
                        `;
      }).join('')}
                    </tbody>
                  </table>
                  ${historial.length > 100 ? `
                    <p style="text-align: center; margin-top: 15px; color: #6b7280; font-size: 13px;">
                      Mostrando los últimos 100 registros de ${historial.length} total
                    </p>
                  ` : ''}
                </div>
              ` : '<p style="text-align: center; color: #6b7280; padding: 20px;">No hay historial de medicación registrado</p>'}
            </div>

            <div class="footer">
              <p><strong>MediTrack Pro</strong> - Sistema de Gestión de Medicamentos</p>
              <p>Este reporte es confidencial y de uso exclusivo médico</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const nombrePDF = `Reporte del paciente ${paciente.nombre}`;
      const reporteConTitulo = reporteHTML.replace(
        `<title>Reporte Médico - ${paciente.nombre}</title>`,
        `<title>${nombrePDF}</title>`
      );

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(reporteConTitulo);
      iframeDoc.close();

      // Configurar el título del documento del iframe
      iframe.contentWindow.document.title = nombrePDF;

      // Esperar a que se cargue el contenido y abrir diálogo de impresión
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Eliminar el iframe después de cerrar el diálogo de impresión
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 500);
    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('Error al generar el reporte. Por favor, intenta nuevamente.');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Lista de pacientes */}
      <div className="md:col-span-1 space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none placeholder-gray-400"
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

        <div className="overflow-y-auto max-h-[500px] space-y-3">
          {!user.patients || user.patients.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No tienes pacientes asignados
            </div>
          ) : filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => handleSelectPatient(patient)}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${selectedPatient?.id === patient.id
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-white hover:bg-gray-50 border border-gray-200"
                  }`}
              >
                <h4 className="text-lg font-semibold text-gray-900 mb-1">{patient.nombre || 'Sin nombre'}</h4>
                <p className="text-sm text-gray-600 mb-3">{patient.telefono || 'Sin teléfono'}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    {patientMedications[patient.id]?.length || 0} medicaciones
                  </span>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">
                        {patientMedications[patient.id]?.filter(med => med.active)?.length || 0} activas
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-xs text-gray-600">
                        {patientMedications[patient.id]?.filter(med => !med.active)?.length || 0} inactivas
                      </span>
                    </div>
                  </div>
                </div>
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
      <div className="md:col-span-2">
        {selectedPatient ? (
          <div className="bg-white p-6 rounded-lg shadow-sm h-full">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Información de {selectedPatient.nombre || 'Paciente'}
              </h3>

              <button
                onClick={() => generarReporteDetallado(selectedPatient)}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm md:text-lg bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Generar Reporte
              </button>
            </div>

            <div className="space-y-4">
              {/* Gráfico de Historial de Medicaciones */}
              <div className="border border-gray-200 rounded-lg">
                {loadingMedications ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Cargando medicaciones...</p>
                  </div>
                ) : (
                  <MedicationHistoryChart
                    medications={patientMedications[selectedPatient.id] || []}
                    pacienteId={selectedPatient.id}
                  />
                )}
              </div>

              {/* Lista de Medicaciones */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Medicaciones Asignadas ({patientMedications[selectedPatient.id]?.length || 0})
                </h4>
                {patientMedications[selectedPatient.id] && patientMedications[selectedPatient.id].length > 0 ? (
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
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {med.notes}
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
                                {med.active ? 'Activa' : 'Inactiva'}
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
                                  {Array.isArray(med.days) ? med.days.map((dia, index) => (
                                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                                      {dia}
                                    </span>
                                  )) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                                      {med.days}
                                    </span>
                                  )}
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
                                  {Array.isArray(med.hours) ? med.hours.map((hora, index) => {
                                    const horaFormateada = hora.includes(':') ? hora.substring(0, 5) : hora;
                                    return (
                                      <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                        {horaFormateada}
                                      </span>
                                    );
                                  }) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                      {med.hours}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Botones de acción */}
                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => openEditModal(med)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Editar
                            </button>

                            <button
                              onClick={() => toggleMedicationStatus(med.id, med.active)}
                              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${med.active
                                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={med.active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} />
                              </svg>
                              {med.active ? 'Desactivar' : 'Activar'}
                            </button>

                            <button
                              onClick={() => handleDeleteClick(med.id)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Eliminar
                            </button>
                          </div>
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
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay medicaciones asignadas</h3>
                    <p className="text-gray-500">Este paciente aún no tiene medicamentos asignados</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm h-full flex items-center justify-center">
            <p className="text-gray-500">
              Selecciona un paciente para ver su historial
            </p>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar Medicación</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del medicamento</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosis</label>
                <div className="relative">
                  <input
                    type="text"
                    name="dosage"
                    value={editForm.dosage}
                    onChange={handleEditChange}
                    placeholder="Ej: 500"
                    className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                  <select
                    name="dosageUnit"
                    value={editForm.dosageUnit}
                    onChange={handleEditChange}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vía de administración</label>
                <select
                  value={editForm.administrationRoute}
                  onChange={(e) => setEditForm({ ...editForm, administrationRoute: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Seleccionar vía</option>
                  {viasAdministracion.map((via) => (
                    <option key={via.id} value={via.id}>
                      {via.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
                  <input
                    type="date"
                    name="startDate"
                    value={editForm.startDate}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de fin</label>
                  <input
                    type="date"
                    name="endDate"
                    value={editForm.endDate}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditChanges}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setMedicationToDelete(null);
        }}
        onConfirm={deleteMedication}
        title="Confirmar eliminación"
        message="¿Estás seguro de que quieres eliminar esta medicación? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}