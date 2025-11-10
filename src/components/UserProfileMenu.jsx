import React, { useState, useEffect, useRef } from 'react';
import EditProfileForm from './EditProfileForm';
import { Cog6ToothIcon, ArrowLeftOnRectangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const UserProfileMenu = ({ user, onLogout, onUpdateProfile, availableDoctors = [], hideLogout = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const menuRef = useRef(null);

  const handleSaveProfile = (updatedData) => {
    onUpdateProfile(updatedData);
    setIsEditModalOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="relative mr-0" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="flex items-center space-x-2 focus:outline-none"
        >
          <div className="relative">
            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center">
              <span className="text-gray-600">{(user.nombre || user.username || 'U').charAt(0)}</span>
            </div>
          </div>
          <span className="text-white font-bold text-lg">{user.nombre || user.username || 'Usuario'}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-5 w-43 bg-white shadow-lg z-10">
            <div className="flex flex-col items-center py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setIsEditModalOpen(true);
                }}
                className="flex items-center w-full px-4 py-2 text-base text-gray-700 hover:bg-gray-100"
              >
                <Cog6ToothIcon className="h-4 w-4 mr-2" />
                Editar perfil
              </button>
              {!hideLogout && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogout();
                  }}
                  className="flex items-center w-full px-4 py-2 text-base text-gray-700 hover:bg-gray-100"
                >
                  <ArrowLeftOnRectangleIcon className="h-4 w-4 mr-2" />
                  Cerrar sesión
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

            <div className="p-6">
              <EditProfileForm
                user={user}
                availableDoctors={availableDoctors}
                onSave={(data) => {
                  handleSaveProfile(data);
                  setIsEditModalOpen(false);
                }}
                onCancel={() => setIsEditModalOpen(false)}
              />
            </div>
        </div>
      )}
    </>
  );
};

export default UserProfileMenu;