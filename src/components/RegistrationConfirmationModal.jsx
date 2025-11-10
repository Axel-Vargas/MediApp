import React from 'react';

const RegistrationConfirmationModal = ({ 
  isOpen, 
  formData, 
  selectedDoctors = [], 
  onConfirm, 
  onCancel, 
  onEdit 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center m-0 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Confirmar Registro
        </h3>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            ¿Está seguro de que desea proceder con el registro?
          </p>
          
          {formData.rol === 'paciente' && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <span className="font-medium text-green-700 block mb-2">Información del Paciente:</span>
              <div className="text-green-900 text-sm">
                <div className="mb-1">• Nombre: {formData.name}</div>
                <div className="mb-1">• Email: {formData.email}</div>
                <div className="mb-1">• Teléfono: {formData.phone}</div>
                {selectedDoctors.length > 0 && (
                  <div className="mt-2">
                    <span className="font-medium text-green-700 block mb-1">Médicos seleccionados:</span>
                    {selectedDoctors.map((doctor, index) => (
                      <div key={doctor.id} className="text-sm mb-1">
                        • {doctor.nombre} 
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {formData.rol === 'doctor' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <span className="font-medium text-blue-700 block mb-2">Información del Doctor:</span>
              <div className="text-blue-900 text-sm">
                <div className="mb-1">• Nombre: {formData.name}</div>
                <div className="mb-1">• Especialidad: {formData.especialidad}</div>
                <div className="mb-1">• Email: {formData.email}</div>
                <div className="text-xs text-blue-600 mt-2">
                  ⚠️ Su cuenta requerirá autorización del administrador antes de poder acceder al sistema.
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationConfirmationModal; 