"use client";

import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import PolicyModal from '@/components/PolicyModal';
import Toast from '@/components/Toast';
import RegistrationConfirmationModal from '@/components/RegistrationConfirmationModal';
import { useRouter } from 'next/navigation';
import { notificationService } from '@/lib/services/notificationService';
import { validateInput, validateEmail, validatePhone, sanitizeInput } from '@/lib/utils/validators';

const Register = ({ onRegister, caregivers = [] }) => {
  const [formData, setFormData] = useState({
    acceptedTerms: false,
    name: '',
    email: '',
    password: '',
    phone: '',
    username: '',
    rol: 'paciente', 
    doctorIds: [], 
    especialidad: ''
  });
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [especialidades, setEspecialidades] = useState([]);
  const [loadingEspecialidades, setLoadingEspecialidades] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const router = useRouter();

  // Función para cargar especialidades con búsqueda
  const cargarEspecialidades = async (searchQuery = '') => {
    try {
      setIsSearching(true);
      
      const url = searchQuery 
        ? `/api/especialidades?activas=true&search=${encodeURIComponent(searchQuery)}`
        : '/api/especialidades?activas=true';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error en la respuesta de la API:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.message || 'Error al cargar las especialidades');
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('La respuesta no es un array:', data);
        throw new Error('Formato de respuesta inválido');
      }
      
      setEspecialidades(data);
    } catch (error) {
      console.error('Error al cargar especialidades:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      setToast({
        show: true,
        message: `Error al cargar las especialidades: ${error.message}`,
        type: 'error',
        duration: 5000
      });
      
      // Establecer un array vacío para evitar errores en la interfaz
      setEspecialidades([
        { id: 1, nombre: 'Medicina General' },
        { id: 2, nombre: 'Cardiología' },
        { id: 3, nombre: 'Pediatría' }
      ]);
    } finally {
      setLoadingEspecialidades(false);
      setIsSearching(false);
    }
  };

  // Cargar especialidades al montar el componente
  useEffect(() => {
    cargarEspecialidades();
  }, []);
  
  // Manejador de búsqueda con debounce
  useEffect(() => {
    // Crear un temporizador para evitar hacer muchas peticiones mientras se escribe
    const timer = setTimeout(() => {
      if (searchTerm.trim() !== '' || searchTerm === '') {
        cargarEspecialidades(searchTerm);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // Función para sanitizar los valores según el tipo de campo
  const sanitizeField = (name, value) => {
    switch (name) {
      case 'email':
        return value;
      case 'phone':
        return value.replace(/[^0-9]/g, '');
      case 'password':
      case 'username':
        return sanitizeInput(value, { allowSpaces: false });
      default:
        return sanitizeInput(value, { allowSpaces: true, preserveTrailingSpaces: true });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let sanitizedValue;
    if (type === 'checkbox') {
      sanitizedValue = checked;
    } else if (name === 'name') {
      // No permitir números en el campo nombre
      sanitizedValue = sanitizeField(name, value).replace(/[0-9]/g, '');
    } else {
      sanitizedValue = sanitizeField(name, value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
  };

  // Función para activar notificaciones push automáticamente
  const activatePushNotifications = async (userId = null) => {
    try {
      console.log('🔔 Activando notificaciones push automáticamente...');
      
      const success = await notificationService.activatePushNotifications(userId);
      
      if (success) {
        console.log('✅ Notificaciones push activadas automáticamente');
      } else {
        console.log('⚠️ No se pudieron activar las notificaciones push');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Error activando notificaciones push:', error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar términos y condiciones
    if (!formData.acceptedTerms) {
      setToast({
        show: true,
        message: 'Debe aceptar los términos y condiciones para continuar.',
        type: 'error',
        duration: 3000
      });
      return;
    }
    
    const fieldsToValidate = [
      { 
        name: 'nombre', 
        value: formData.name, 
        required: true,
        validate: (val) => validateInput(val, { allowSpaces: true }),
        error: 'El nombre contiene caracteres no permitidos'
      },
      { 
        name: 'correo', 
        value: formData.email, 
        required: true, 
        validate: validateEmail,
        error: 'Por favor ingresa un correo electrónico válido.'
      },
      { 
        name: 'teléfono', 
        value: formData.phone, 
        required: true, 
        validate: validatePhone,
        error: 'Ingresa un número de teléfono válido.'
      },
      { 
        name: 'usuario', 
        value: formData.username, 
        required: true,
        validate: (val) => validateInput(val, { allowSpaces: false }),
        error: 'El nombre de usuario contiene caracteres no permitidos.'
      },
      { 
        name: 'contraseña', 
        value: formData.password, 
        required: true,
        validate: (val) => val.length >= 8,
        error: 'La contraseña debe tener al menos 8 caracteres.'
      },
    ];
    
    for (const field of fieldsToValidate) {
      if (field.required && !field.value) {
        setToast({ 
          show: true, 
          message: `El campo ${field.name} es obligatorio.`,
          type: 'error',
          duration: 3000
        });
        return;
      }
      
      if (field.value && field.validate && !field.validate(field.value)) {
        setToast({ 
          show: true, 
          message: field.error || 'Formato no válido',
          type: 'error',
          duration: 3000
        });
        return;
      }
    }

    // Validar que los pacientes seleccionen al menos un doctor
    if (formData.rol === 'paciente' && (!formData.doctorIds || formData.doctorIds.length === 0)) {
      setToast({
        show: true,
        message: 'Debe seleccionar al menos un doctor encargado',
        type: 'error'
      });
      return;
    }

    // Validar que los doctores ingresen su especialidad
    if (formData.rol === 'doctor' && (!formData.especialidad || (typeof formData.especialidad === 'string' && !formData.especialidad.trim()))) {
      setToast({
        show: true,
        message: 'Debe ingresar su especialidad',
        type: 'error'
      });
      return;
    }

    // Mostrar modal de confirmación solo para pacientes
    if (formData.rol === 'paciente') {
      setShowConfirmationModal(true);
    } else {
      await handleConfirmRegistration();
    }
  };

  const handleConfirmRegistration = async () => {
    setShowConfirmationModal(false);
    setLoading(true);

    try {
      const newUser = await onRegister(formData);
      
      // Activar notificaciones push automáticamente si el usuario aceptó los términos
      if (formData.acceptedTerms && newUser?.id) {
        await activatePushNotifications(newUser.id);
      }

      setToast({
        show: true,
        message: '¡Usuario registrado exitosamente!',
        type: 'success'
      });
      
      // Limpiar todos los campos del formulario
      setFormData({
        acceptedTerms: false,
        name: '',
        email: '',
        password: '',
        phone: '',
        username: '',
        rol: 'paciente',
        doctorIds: [],
        especialidad: ''
      });
      
    } catch (err) {
      setToast({
        show: true,
        message: err.message || 'Error al registrar el usuario',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRegistration = () => {
    setShowConfirmationModal(false);
  };

  const handleCancelRegistration = () => {
    setShowConfirmationModal(false);
  };

  const handleAcceptTerms = async () => {
    setFormData(prev => ({
      ...prev,
      acceptedTerms: true
    }));
    setShowPolicyModal(false);
  };

  const handleRejectTerms = () => {
    setFormData(prev => ({
      ...prev,
      acceptedTerms: false
    }));
    setShowPolicyModal(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-8 mt-10">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Registro</h2>
      
      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="relative">
          <div className="border-t border-gray-200"></div>
          <div className="absolute inset-x-0 top-[-12px] flex justify-center">
            <span className="bg-white px-3 text-sm font-medium text-gray-900">Datos Personales</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <input
                name="name"
                value={formData.name}
                placeholder="Ingrese su nombre"
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}  
                onChange={handleChange}
                required
                placeholder="Ingrese su teléfono"
                maxLength="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="tel"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Correo</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                autoComplete="email"
                maxLength={50}
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="border-t border-gray-200"></div>
          <div className="absolute inset-x-0 top-[-12px] flex justify-center">
            <span className="bg-white px-3 text-sm font-medium text-gray-900">Credenciales</span>
          </div>
          <div className="grid grid-cols-2 gap-6 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Usuario</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                maxLength={30}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                maxLength={30}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select
            name="rol"
            value={formData.rol}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          >
            <option value="paciente">Paciente</option>
            <option value="doctor">Doctor</option>
          </select>
          {formData.rol === 'doctor' && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Los doctores requieren autorización del administrador antes de poder acceder al sistema.
            </p>
          )}
        </div>
        {/* Campo para seleccionar doctores (solo visible para pacientes) */}
        {formData.rol === 'paciente' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Doctores Encargados
            </label>
            {caregivers.length > 0 ? (
              <Select
                isMulti
                closeMenuOnSelect={false}
                value={formData.doctorIds.map(id => caregivers.find(doctor => doctor.id === id)).filter(doctor => doctor !== undefined).map(doctor => ({
                  value: doctor.id,
                  label: `${doctor.nombre}`
                }))}
                onChange={(selectedOptions) => {
                  setFormData({
                    ...formData,
                    doctorIds: selectedOptions ? selectedOptions.map(option => option.value) : []
                  });
                }}
                options={caregivers.map(doctor => ({
                  value: doctor.id,
                  label: `${doctor.nombre}`
                }))}
                placeholder="Seleccionar doctores..."
                className="text-sm"
                classNamePrefix="select"
                noOptionsMessage={() => 'No hay más doctores disponibles'}
                loadingMessage={() => 'Cargando...'}
              />
            ) : (
              <div className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-md">
                No hay doctores disponibles para asignar. Por favor, contacta al administrador.
              </div>
            )}
            {formData.doctorIds.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Seleccionados: {formData.doctorIds.length} doctor{formData.doctorIds.length !== 1 ? 'es' : ''}
              </p>
            )}
          </div>
        )}
        {formData.rol === 'doctor' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Especialidad <span className="text-red-500">*</span>
            </label>
            {loadingEspecialidades ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100">
                Cargando especialidades...
              </div>
            ) : (
              <div className="relative">
                <Select
                  id="especialidad"
                  name="especialidad"
                  value={especialidades.find(esp => esp.id.toString() === formData.especialidad)}
                  onChange={(selectedOption) => {
                    setFormData(prev => ({
                      ...prev,
                      especialidad: selectedOption ? selectedOption.id : ''
                    }));
                  }}
                  onInputChange={(inputValue) => {
                    setSearchTerm(inputValue);
                  }}
                  options={especialidades}
                  getOptionLabel={(option) => option.nombre}
                  getOptionValue={(option) => option.id.toString()}
                  placeholder="Buscar especialidad..."
                  isSearchable={true}
                  isClearable={true}
                  noOptionsMessage={({ inputValue }) => 
                    inputValue 
                      ? `No se encontraron especialidades que coincidan con "${inputValue}"`
                      : 'No hay especialidades disponibles'
                  }
                  loadingMessage={() => 'Buscando...'}
                  className="text-sm"
                  classNamePrefix="select"
                  menuPlacement="auto"
                  menuPosition="absolute"
                  menuShouldScrollIntoView={true}
                  menuPortalTarget={document.body}
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
                  required
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center">
          <input
            id="terms"
            name="acceptedTerms"
            type="checkbox"
            checked={formData.acceptedTerms}
            onChange={(e) => {
              if (!formData.acceptedTerms) {
                setShowPolicyModal(true);
              } else {
                setFormData(prev => ({
                  ...prev,
                  acceptedTerms: false
                }));
              }
            }}
            className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
          />
          <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
            Acepto los términos y condiciones
          </label>
        </div>

        <PolicyModal 
          isOpen={showPolicyModal}
          onAccept={handleAcceptTerms}
          onReject={handleRejectTerms}
        />

        <RegistrationConfirmationModal
          isOpen={showConfirmationModal}
          formData={formData}
          selectedDoctors={caregivers.filter(d => formData.doctorIds.includes(d.id))}
          onConfirm={handleConfirmRegistration}
          onCancel={handleCancelRegistration}
          onEdit={handleEditRegistration}
        />

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Register;
