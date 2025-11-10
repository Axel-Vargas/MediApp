import React, { useState } from 'react';

const AddFamilyMemberForm = ({ onAdd }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    relacion: '',
    telefono: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    console.log('Submitting family member:', formData);
    
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
              required
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