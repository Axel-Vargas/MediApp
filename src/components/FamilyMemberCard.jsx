import React from 'react';
import { FiPhone } from 'react-icons/fi';
import { IoMailOutline } from "react-icons/io5";

import { decryptFromPacked } from '@/lib/crypto';

const FamilyMemberCard = ({ member, onRemove }) => {
  const getDecryptedValue = (value) => {
    if (value === null || value === undefined || typeof value !== 'string') {
      return value;
    }
    
    try {
      if (value.split('.').length === 3) {
        return decryptFromPacked(value);
      }
      return value;
    } catch (error) {
      console.warn('No se pudo descifrar el valor, mostrando valor original:', error.message);
      return value;
    }
  };

  const nombre = getDecryptedValue(member.nombre);
  const email = getDecryptedValue(member.email);
  const telefono = getDecryptedValue(member.telefono);
  const relacion = getDecryptedValue(member.relacion);
  const codigoVerificacion = getDecryptedValue(member.codigoVerificacion);
  return (
    <div className="bg-white border-gray-100 border rounded-xl shadow-sm overflow-hidden p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-600">{nombre?.charAt(0) || '?'}</span>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{nombre}</h3>
            <p className="text-gray-600">{relacion}</p>
          </div>
        </div>
        <button
          onClick={() => onRemove(member.id)}
          className="text-gray-400 hover:text-red-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center space-x-1.5 text-gray-600">
          <IoMailOutline className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="truncate text-sm">{email}</span>
        </div>
        <div className="flex items-center space-x-1.5 text-gray-600">
          <FiPhone className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm">{telefono}</span>
        </div>
      </div>

      <div className="mt-4 flex space-x-3">
        <a 
          href={`https://wa.me/593${telefono?.replace(/\D/g, '')}?text=Tu%20c%C3%B3digo%20de%20verificaci%C3%B3n%20es:%20${encodeURIComponent(codigoVerificacion || '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1 bg-green-100 hover:bg-green-200 rounded-lg transition-colors text-sm flex items-center"
          title={`Enviar código de verificación: ${codigoVerificacion || 'No disponible'}`}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1 text-green-600" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.703 3.536 1.078 5.46 1.078 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.088.636 4.086 1.834 5.801l-1.213 4.479 4.819-1.365zm9.061-6.75h-7.715v-1.5h7.715v1.5zm-5.5-4.5h-2.215v-1.5h2.215v1.5zm5.5 0h-4.5v-1.5h4.5v1.5z"/>
          </svg>
          Enviar código de verificación
        </a>
      </div>
    </div>
  );
};

export default FamilyMemberCard;