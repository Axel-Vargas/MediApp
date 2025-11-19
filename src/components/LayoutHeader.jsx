import React from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import UserProfileMenu from './UserProfileMenu';

const LayoutHeader = ({ user, onLogout, onUpdateProfile, availableDoctors = [], hideLogout = false, onMobileMenuToggle, showMobileMenuButton = false }) => {
  return (
    <header className="bg-blue-300 shadow-sm sticky top-0 z-50 h-16">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center">
          {showMobileMenuButton && (
            <button
              onClick={onMobileMenuToggle}
              aria-label="Abrir menú"
              className="md:hidden flex items-center justify-center w-10 h-10 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-xl font-bold text-white">MediApp</h1>
        </div>
        
        <div className="flex items-center justify-end space-x-4 min-w-0 flex-1">
          <UserProfileMenu 
            user={user} 
            onLogout={onLogout} 
            onUpdateProfile={onUpdateProfile}
            availableDoctors={availableDoctors}
            hideLogout={hideLogout}
          />
        </div>
      </div>
    </header>
  );
};

export default LayoutHeader;