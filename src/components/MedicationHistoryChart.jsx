import React, { useState, useEffect, memo, useRef } from 'react';
import { useUser } from '@/context/userContext';

const MedicationHistoryChart = memo(({ medications, pacienteId }) => {
  const { loadMedicationHistory, medicationHistory, invalidateMedicationHistory } = useUser();
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState(7); 
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const loadingRef = useRef(false);

  const cacheKey = pacienteId ? `${pacienteId}-${periodo}` : null;
  const historial = cacheKey ? (medicationHistory[cacheKey] || []) : [];

  useEffect(() => {
    if (!pacienteId) {
      return;
    }

    const loadHistorial = async () => {
      if (loadingRef.current) {
        return;
      }

      if (medicationHistory[cacheKey] && medicationHistory[cacheKey].length > 0) {
        setLoading(false);
        return;
      }

      try {
        loadingRef.current = true;
        setLoading(true);
        
        await loadMedicationHistory(pacienteId, periodo, false);
      } catch (err) {
        console.error('[MedicationHistoryChart] Error al cargar historial:', err);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    loadHistorial();
  }, [pacienteId, periodo, loadMedicationHistory, cacheKey]); 

  // Función para formatear la fecha completa
  const formatFullDate = (dateString) => {
    try {
      let date;
      
      if (typeof dateString === 'string') {
        if (dateString.includes('T')) {
          const [fechaPart, horaPart] = dateString.split('T');
          const [year, month, day] = fechaPart.split('-').map(Number);
          
          if (horaPart) {
            const [horas, minutos, segundos] = horaPart.split(':').map(Number);
            date = new Date(Date.UTC(year, month - 1, day, horas || 0, minutos || 0, segundos || 0));
          } else {
            date = new Date(Date.UTC(year, month - 1, day));
          }
        } else if (dateString.includes(' ')) {
          const [fechaPart, horaPart] = dateString.split(' ');
          const [year, month, day] = fechaPart.split('-').map(Number);
          
          if (horaPart) {
            const [horas, minutos, segundos] = horaPart.split(':').map(Number);
            date = new Date(Date.UTC(year, month - 1, day, horas || 0, minutos || 0, segundos || 0));
          } else {
            date = new Date(Date.UTC(year, month - 1, day));
          }
        } else {
          const [year, month, day] = dateString.split('-').map(Number);
          date = new Date(Date.UTC(year, month - 1, day));
        }
      } else {
        date = new Date(dateString);
      }
      
      // Verificar que la fecha es válida
      if (isNaN(date.getTime())) {
        console.error(`[Historial] Fecha inválida: ${dateString}`);
        return 'Fecha inválida';
      }
      
      return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error(`[Historial] Error al formatear fecha ${dateString}:`, error);
      return 'Error en fecha';
    }
  };

  // Función para formatear la fecha y hora de la toma
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para mostrar fecha y hora juntas del historial
  const formatDateAndTime = (fecha, horario) => {
    try {
      if (!fecha || !horario) return 'Fecha inválida';
      
      let fechaCompleta;
      
      if (fecha.includes('T')) {
        fechaCompleta = fecha;
      } else if (fecha.includes(' ')) {
        fechaCompleta = fecha.replace(' ', 'T');
      } else {
        fechaCompleta = `${fecha}T${horario}:00`;
      }
      
      const date = new Date(fechaCompleta);
      
      if (isNaN(date.getTime())) {
        console.error(`[Historial] Fecha inválida al combinar: ${fecha} + ${horario}`);
        return 'Fecha inválida';
      }
      
      return date.toLocaleString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error(`[Historial] Error al formatear fecha y hora: ${fecha} + ${horario}`, error);
      return 'Error en fecha';
    }
  };

  // Función para obtener el estado de cumplimiento
  const getComplianceStatus = (dayRecords) => {
    const totalDoses = dayRecords.length;
    const takenDoses = dayRecords.filter(r => r.tomada).length;
    const missedDoses = dayRecords.filter(r => r.perdida).length;

    if (totalDoses === 0) return { status: 'empty', text: 'Sin medicamentos', color: 'gray' };
    if (takenDoses === totalDoses) return { status: 'perfect', text: 'Perfecto', color: 'green' };
    if (takenDoses > 0) return { status: 'partial', text: 'Parcial', color: 'yellow' };
    return { status: 'missed', text: 'Omitidas', color: 'red' };
  };

  // Agrupar historial por medicamento
  const groupedByMedication = historial.reduce((acc, record) => {
    const medicacionId = record.medicacionId;
    if (!acc[medicacionId]) {
      acc[medicacionId] = {
        medicacionId: record.medicacionId,
        medicacionNombre: record.medicacionNombre,
        dosis: record.dosis,
        registros: []
      };
    }
    acc[medicacionId].registros.push(record);
    return acc;
  }, {});

  // Filtrar por estado si es necesario
  const filteredMedications = Object.keys(groupedByMedication).reduce((acc, medicacionId) => {
    const medicacion = groupedByMedication[medicacionId];
    
    const filteredRecords = medicacion.registros.filter(record => {
      switch (filtroEstado) {
        case 'tomadas':
          return record.tomada;
        case 'omitidas':
          return record.perdida;
        default:
          return true;
      }
    });
    
    if (filteredRecords.length > 0) {
      acc[medicacionId] = {
        ...medicacion,
        registros: filteredRecords
      };
    }
    
    return acc;
  }, {});

  // Ordenar medicaciones por nombre
  const sortedMedications = Object.keys(filteredMedications).sort((a, b) => 
    filteredMedications[a].medicacionNombre.localeCompare(filteredMedications[b].medicacionNombre)
  );
  
  sortedMedications.forEach((medId, index) => {
    const med = filteredMedications[medId];
  });

  // No mostrar spinner completo, en su lugar mostrar skeleton loader o datos en caché
  const showLoadingIndicator = loading && historial.length === 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-bold text-gray-800">
            Historial de Medicamentos
          </h2>
          {loading && historial.length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Actualizando...</span>
            </div>
          )}
        </div>
        
        {/* Controles de filtrado */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Selector de período */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Período:</label>
            <select 
              value={periodo} 
              onChange={(e) => setPeriodo(parseInt(e.target.value))}
              disabled={loading && historial.length === 0}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value={7}>Últimos 7 días</option>
              <option value={15}>Últimos 15 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
          </div>

          {/* Filtro por estado */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Filtrar:</label>
            <select 
              value={filtroEstado} 
              onChange={(e) => setFiltroEstado(e.target.value)}
              disabled={loading && historial.length === 0}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="todos">Todos</option>
              <option value="tomadas">Solo tomadas</option>
              <option value="omitidas">Solo omitidas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center space-x-6 mb-6 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
          <span>Tomada</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
          <span>Omitida</span>
        </div>
      </div>

      {showLoadingIndicator ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-600 text-sm">Cargando historial...</span>
          </div>
        </div>
      ) : sortedMedications.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-6xl mb-4">
            📅
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            No hay historial disponible
          </h3>
          <p className="text-gray-500">
            Aún no se han registrado tomas de medicamentos en el período seleccionado.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Información del período */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                Mostrando {sortedMedications.length} medicamento{sortedMedications.length !== 1 ? 's' : ''} de historial
              </span>
              <span className="text-xs text-blue-600">
                {periodo} días atrás
              </span>
            </div>
          </div>

          {/* Área de scroll para el historial */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="space-y-4 p-4">
              {sortedMedications.map((medicacionId) => {
                const medicacion = filteredMedications[medicacionId];
                const compliance = getComplianceStatus(medicacion.registros);
                const totalDoses = medicacion.registros.length;
                const takenDoses = medicacion.registros.filter(r => r.tomada).length;
                const missedDoses = medicacion.registros.filter(r => r.perdida).length;

                return (
                  <div key={medicacionId} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                    {/* Encabezado del medicamento */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full bg-${compliance.color}-500`}></div>
                          <div>
                            <h3 className="font-semibold text-gray-800 capitalize">
                              {medicacion.medicacionNombre}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Dosis: {medicacion.dosis}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-700">
                            {takenDoses}/{totalDoses}
                          </div>
                          <div className="text-xs text-gray-500">dosis tomadas</div>
                        </div>
                      </div>
                    </div>

                    {/* Lista de horarios */}
                    <div className="space-y-2">
                      {medicacion.registros.map((record, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0">
                            {record.tomada ? (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900">
                              {formatDateAndTime(record.fecha, record.horario)}
                            </div>
                            {record.fechaMarcado && (
                              <div className="text-xs text-green-600">
                                Marcado: {formatDateTime(record.fechaMarcado)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Alerta de dosis omitidas */}
                    {missedDoses > 0 && (
                      <div className="px-4 py-3 bg-red-50 border-t border-red-200">
                        <div className="flex items-center space-x-2">
                          <span className="text-red-600 text-sm">⚠️</span>
                          <span className="text-sm text-red-700 font-medium">
                            {missedDoses} dosis omitida{missedDoses > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Indicador de scroll si hay muchos medicamentos */}
          {sortedMedications.length > 3 && (
            <div className="text-center text-xs text-gray-500 mt-2">
              <span>📜 Desplázate para ver más medicamentos</span>
            </div>
          )}
        </div>
      )}

      {/* Resumen general */}
      {sortedMedications.length > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            Resumen General
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const datosMostrados = Object.values(filteredMedications);
              
              datosMostrados.forEach((medicacion, index) => {
                const tomadas = medicacion.registros.filter(r => r.tomada).length;
                const omitidas = medicacion.registros.filter(r => r.perdida).length;
              });
              
              const todasLasDosis = datosMostrados.flatMap(m => m.registros);
              const totalTaken = todasLasDosis.filter(r => r.tomada).length;
              const totalMissed = todasLasDosis.filter(r => r.perdida).length;
              const totalScheduled = todasLasDosis.length;
              const completionRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;

              return (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{totalTaken}</div>
                    <div className="text-sm text-gray-600">
                      Total dosis tomadas
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{totalMissed}</div>
                    <div className="text-sm text-gray-600">
                      Total dosis omitidas
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{completionRate}%</div>
                    <div className="text-sm text-gray-600">Cumplimiento</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{medications.filter(m => m.active).length}</div>
                    <div className="text-sm text-gray-600">Medicamentos activos</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.pacienteId === nextProps.pacienteId &&
    prevProps.medications?.length === nextProps.medications?.length &&
    JSON.stringify(prevProps.medications?.map(m => m.id)) === JSON.stringify(nextProps.medications?.map(m => m.id))
  );
});

MedicationHistoryChart.displayName = 'MedicationHistoryChart';

export default MedicationHistoryChart;
