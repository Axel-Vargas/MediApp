import React, { useState } from 'react';
import { validatePhone, validateEmail } from '@/lib/utils/validators';

const AddFamilyMemberForm = ({ onAdd, onError }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    relacion: '',
    telefono: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let finalValue = value;
    if (name === 'telefono') {
      // Solo permitir números
      finalValue = value.replace(/[^0-9]/g, '');
    }
    
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar todos los campos - NO permitir enviar si falta alguno
    const validationErrors = [];
    const camposFaltantes = [];
    
    // Validar nombre
    if (!formData.nombre || formData.nombre.trim() === '') {
      camposFaltantes.push('nombre');
      validationErrors.push('El nombre es requerido');
    }
    
    // Validar relación
    if (!formData.relacion || formData.relacion.trim() === '') {
      camposFaltantes.push('relación');
      validationErrors.push('La relación es requerida');
    }
    
    // Validar email
    if (!formData.email || formData.email.trim() === '') {
      camposFaltantes.push('email');
      validationErrors.push('El email es requerido');
    } else if (!validateEmail(formData.email)) {
      validationErrors.push('El email no es válido');
    }
    
    // Validar teléfono
    if (!formData.telefono || formData.telefono.trim() === '') {
      camposFaltantes.push('teléfono');
      validationErrors.push('El teléfono es requerido');
    } else if (!validatePhone(formData.telefono)) {
      validationErrors.push('El teléfono debe ser un número ecuatoriano válido.');
    }
    
    // Si hay errores, mostrarlos en un toast y NO permitir agregar el familiar
    if (validationErrors.length > 0) {
      if (onError) {
        let mensaje = '';
        if (camposFaltantes.length > 0) {
          mensaje = `Por favor completa todos los campos requeridos: ${camposFaltantes.join(', ')}.`;
          if (validationErrors.length > camposFaltantes.length) {
            mensaje += ' ' + validationErrors.filter((err, idx) => !err.includes('es requerido')).join('. ');
          }
        } else {
          mensaje = validationErrors.join('. ');
        }
        onError(mensaje);
      }
      return;
    }
    
    // Solo si TODOS los campos están completos y válidos, proceder
    onAdd({ ...formData });
    
    setFormData({
      nombre: '',
      email: '',
      relacion: '',
      telefono: ''
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Agregar Familiar</h3>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Nombre</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
              required
              maxLength={45}
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Relación</label>
            <select
              name="relacion"
              value={formData.relacion}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
              required
            >
              <option value="">Selecciona una relación</option>
              <option value="Hijo/a">Hijo/a</option>
              <option value="Padre">Padre</option>
              <option value="Madre">Madre</option>
              <option value="Tío/a">Tío/a</option>
              <option value="Sobrino/a">Sobrino/a</option>
              <option value="Abuelo/a">Abuelo/a</option>
              <option value="Hermano/a">Hermano/a</option>
              <option value="Novio/a">Novio/a</option>
              <option value="Esposo/a">Esposo/a</option>
              <option value="Primo/a">Primo/a</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
              required
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Teléfono</label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="0987654321 o 022345678"
              required
              maxLength={10}
              inputMode="numeric"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
        >
          Agregar Familiar
        </button>
      </form>
    </div>
  );
};

export default AddFamilyMemberForm;