import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';
import { validatePhone, validateEmail } from '@/lib/utils/validators';

const EditProfileForm = ({ user, onSave, onCancel, availableDoctors = [] }) => {
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [especialidades, setEspecialidades] = useState([]);
  const [loadingEspecialidades, setLoadingEspecialidades] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [formData, setFormData] = useState({
    nombre: user.nombre || user.name || '',
    email: user.correo || user.email || '',
    telefono: (user.telefono !== null && user.telefono !== undefined) ? user.telefono : (user.phone || ''),
    usuario: '',
    contrasena: '',
    rol: user.rol || 'paciente',
    doctorInfo: {
      especialidad: user.especialidadId || user.doctorInfo?.especialidad || user.especialidad || ''
    },
    caregiverId: user.caregiverId || '',
    doctorIds: user.doctorIds || (user.doctorId ? [user.doctorId] : [])
  });
  
  // Cargar especialidades desde la API
  useEffect(() => {
    const cargarEspecialidades = async () => {
      try {
        setLoadingEspecialidades(true);
        const response = await fetch('/api/especialidades?activas=true');
        if (response.ok) {
          const data = await response.json();
          setEspecialidades(Array.isArray(data) ? data : []);
        } else {
          console.error('Error al cargar especialidades');
          setEspecialidades([]);
        }
      } catch (error) {
        console.error('Error al cargar especialidades:', error);
        setEspecialidades([]);
      } finally {
        setLoadingEspecialidades(false);
      }
    };
    
    if (user.rol === 'doctor') {
      cargarEspecialidades();
    }
  }, [user.rol]);

  // Actualizar formData cuando se carguen las especialidades y el usuario tenga una especialidad
  useEffect(() => {
    if (user.rol === 'doctor' && especialidades.length > 0) {
      const especialidadId = user.especialidadId || user.doctorInfo?.especialidad || user.especialidad;
      if (especialidadId && formData.doctorInfo.especialidad !== especialidadId.toString()) {
        setFormData(prev => ({
          ...prev,
          doctorInfo: {
            ...prev.doctorInfo,
            especialidad: especialidadId.toString()
          }
        }));
      }
    }
  }, [especialidades, user.rol, user.especialidadId, user.doctorInfo?.especialidad, user.especialidad]);

  // Actualizar formData cuando cambie el usuario
  useEffect(() => {
    const newFormData = {
      nombre: user.nombre || user.name || '',
      email: user.correo || user.email || '',
      telefono: (user.telefono !== null && user.telefono !== undefined) ? user.telefono : (user.phone || ''),
      usuario: '',
      contrasena: '',
      rol: user.rol || 'paciente',
      doctorInfo: {
        especialidad: user.especialidadId || user.doctorInfo?.especialidad || user.especialidad || ''
      },
      caregiverId: user.caregiverId || '',
      doctorIds: user.doctorIds || (user.doctorId ? [user.doctorId] : []) 
    };
    
    setFormData(newFormData);
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let finalValue = value;
    if (name === 'telefono') {
      finalValue = value.replace(/[^0-9]/g, '');
    } else if (name === 'nombre') {
      finalValue = value.replace(/[0-9]/g, '');
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };



  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.telefono && !validatePhone(formData.telefono)) {
      setToast({
        show: true,
        message: 'Por favor ingresa un número de teléfono ecuatoriano válido.',
        type: 'error'
      });
      return;
    }
    
    if (formData.email && !validateEmail(formData.email)) {
      setToast({
        show: true,
        message: 'Por favor ingresa un correo electrónico válido.',
        type: 'error'
      });
      return;
    }
    
    const apiFormData = {
      nombre: formData.nombre,
      telefono: formData.telefono,
      ...(formData.email && { correo: formData.email }),
      ...(formData.usuario && { usuario: formData.usuario }),
      ...(formData.contrasena && { contrasena: formData.contrasena }),
      ...(user.rol === 'paciente' && formData.doctorIds && formData.doctorIds.length > 0 && { doctorIds: formData.doctorIds }),
      ...(user.rol === 'doctor' && formData.doctorInfo.especialidad && { especialidad: parseInt(formData.doctorInfo.especialidad, 10) })
    };
    
    setPendingFormData(apiFormData);
    setShowConfirm(true);
  };

  const handleConfirmSave = () => {
    setShowConfirm(false);
    onSave(pendingFormData);
  };

  const handleCancelSave = () => {
    setShowConfirm(false);
    setPendingFormData(null);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-2xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Editar Perfil</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          <div className="border-t border-gray-200"></div>
          <div className="absolute inset-x-0 top-[-12px] flex justify-center">
            <span className="bg-white px-3 text-sm font-medium text-gray-900">Datos Personales</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                required
                maxLength={24}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="Ingrese su teléfono"
                maxLength="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                inputMode="numeric"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Correo</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                placeholder="correo@ejemplo.com"
                maxLength={40}
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="border-t border-gray-200"></div>
          <div className="absolute inset-x-0 top-[-12px] flex justify-center">
            <span className="bg-white px-3 text-sm font-medium text-gray-900">Credenciales (Opcionales)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Usuario</label>
              <input
                type="text"
                name="usuario"
                value={formData.usuario}
                placeholder="Nuevo Usuario"
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                type="password"
                name="contrasena"
                value={formData.contrasena}
                placeholder="Nueva contraseña"
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                maxLength={20}
              />
            </div>
          </div>
        </div>

        {user.rol === 'doctor' && (
          <div className="relative">
            <div className="border-t border-gray-200"></div>
            <div className="absolute inset-x-0 top-[-12px] flex justify-center">
              <span className="bg-white px-3 text-sm font-medium text-gray-900">Información Médica</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Especialidad</label>
                <Select
                  id="especialidad"
                  name="especialidad"
                  value={especialidades.find(esp => {
                    const currentEspecialidadId = formData.doctorInfo.especialidad?.toString() || 
                                                  user.especialidadId?.toString() || 
                                                  user.doctorInfo?.especialidad?.toString() || 
                                                  user.especialidad?.toString();
                    return esp.id.toString() === currentEspecialidadId;
                  })}
                  onChange={(selectedOption) => {
                    setFormData(prev => ({
                      ...prev,
                      doctorInfo: {
                        ...prev.doctorInfo,
                        especialidad: selectedOption ? selectedOption.id : ''
                      }
                    }));
                  }}
                  options={especialidades}
                  getOptionLabel={(option) => option.nombre}
                  getOptionValue={(option) => option.id.toString()}
                  placeholder="Buscar especialidad..."
                  isSearchable={true}
                  isClearable={true}
                  isLoading={loadingEspecialidades}
                  noOptionsMessage={({ inputValue }) => 
                    inputValue 
                      ? `No se encontraron especialidades que coincidan con "${inputValue}"`
                      : 'No hay especialidades disponibles'
                  }
                  loadingMessage={() => 'Cargando especialidades...'}
                  className="text-sm"
                  classNamePrefix="select"
                  menuPlacement="auto"
                  menuPosition="absolute"
                  menuShouldScrollIntoView={true}
                  styles={{
                    container: (provided) => ({
                      ...provided,
                      width: '100%',
                    }),
                    control: (provided) => ({
                      ...provided,
                      minHeight: '38px',
                    }),
                    menuPortal: (base) => ({
                      ...base,
                      zIndex: 9999,
                    })
                  }}
                />
              </div>
            </div>
          </div>
        )}

{/*
        {user.rol === 'paciente' && (
          <div className="relative">
            <div className="border-t border-gray-200"></div>
            <div className="absolute inset-x-0 top-[-12px] flex justify-center">
              <span className="bg-white px-3 text-sm font-medium text-gray-900">Doctores Asignados</span>
            </div>
            <div className="pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Doctores Encargados</label>
              <Select
                isMulti
                closeMenuOnSelect={false}
                value={availableDoctors
                  .filter(doctor => formData.doctorIds.includes(doctor.id))
                  .map(doctor => ({
                    value: doctor.id,
                    label: `${doctor.nombre} - ${doctor.especialidad || 'Sin especialidad'}`
                  }))}
                onChange={(selectedOptions) => {
                  const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
                  setFormData(prev => ({
                    ...prev,
                    doctorIds: selectedIds
                  }));
                }}
                options={availableDoctors.map(doctor => ({
                  value: doctor.id,
                  label: `${doctor.nombre} - ${doctor.especialidad || 'Sin especialidad'}`
                }))}
                placeholder="Seleccionar doctores..."
                className="text-sm"
                classNamePrefix="select"
                
              />
              {formData.doctorIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Seleccionados: {formData.doctorIds.length} doctor{formData.doctorIds.length !== 1 ? 'es' : ''}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Puedes cambiar tus doctores encargados en cualquier momento
              </p>
            </div>
          </div>
        )}
*/}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Guardar Cambios
          </button>
        </div>
      </form>
      
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={handleCancelSave}
        onConfirm={handleConfirmSave}
        title="Confirmar cambios"
        message="¿Estás seguro de que deseas guardar los cambios en tu perfil?"
        confirmText="Sí, guardar cambios"
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
};

export default EditProfileForm;