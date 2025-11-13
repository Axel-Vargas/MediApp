"use client";

import { createContext, useState, useContext, useEffect } from "react";

const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cargar administrador desde localStorage al inicializar 
  useEffect(() => {
    const loadAdmin = () => {
      try {
        const savedAdmin = localStorage.getItem("admin");
        if (savedAdmin) {
          try {
            const parsedAdmin = JSON.parse(savedAdmin);
            setAdmin(parsedAdmin);
          } catch (error) {
            console.error("Error al cargar admin desde localStorage:", error);
            localStorage.removeItem("admin");
          }
        }
      } catch (error) {
        console.error("Error al acceder a localStorage:", error);
      } finally {
        setLoading(false);
      }
    };
    
    // Ejecutar de forma asíncrona para no bloquear el render
    if (typeof window !== 'undefined') {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(loadAdmin, { timeout: 100 });
      } else {
        setTimeout(loadAdmin, 0);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (adminData) => {
    setAdmin(adminData);
    localStorage.setItem("admin", JSON.stringify(adminData));
  };

  const handleLogout = () => {
    setAdmin(null);
    localStorage.removeItem("admin");
  };

  const updateAdmin = (updatedData) => {
    const updatedAdmin = { ...admin, ...updatedData };
    setAdmin(updatedAdmin);
    localStorage.setItem("admin", JSON.stringify(updatedAdmin));
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <AdminContext.Provider
      value={{
        admin,
        loading,
        setAdmin,
        handleLogin,
        handleLogout,
        updateAdmin,
        mobileMenuOpen,
        setMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => useContext(AdminContext);