"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Login from "@/app/Auth/Login";
import Register from "@/app/Auth/Register";
import "@/globals.css";

const NavigationTabs = ({ isPatient, caregivers, onLogin, onRegister }) => {
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const patientTabs = [
    { id: "medications", label: "Medicamentos", route: "/patient/medications" },
    { id: "family", label: "Familia", route: "/patient/family" },
    { id: "chatbot", label: "Chatbot", route: "/patient/chatbot" },
  ];

  const caregiverTabs = [
    { id: "assign", label: "Asignar Medicación", route: "/caregiver/assign" },
    { id: "patients", label: "Mis Pacientes", route: "/caregiver/patients" },
  ];

  // Seleccionar las pestañas según el rol
  const tabs = isPatient ? patientTabs : caregiverTabs;

  useEffect(() => {
    if (tabs && tabs.length > 0) {
      tabs.forEach(tab => {
        router.prefetch(tab.route);
      });
    }
  }, [tabs, router]);

  return (
    <div>
      {caregivers && onLogin && onRegister ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="flex mb-8">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-4 font-medium ${
                  isLogin ? "border-b-2 border-blue-600 text-black" : "text-gray-500"
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-4 font-medium ${
                  !isLogin ? "border-b-2 border-blue-600 text-black" : "text-gray-500"
                }`}
              >
                Registrarse
              </button>
            </div>

            {isLogin ? (
              <Login onLogin={onLogin} />
            ) : (
              <Register caregivers={caregivers} onRegister={onRegister} />
            )}
          </div>
        </div>
      ) : (
        <div className="flex border-b border-gray-200 mb-6 text-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                router.prefetch(tab.route);
                router.push(tab.route);
              }}
              onMouseEnter={() => {
                router.prefetch(tab.route);
              }}
              className={`py-2 px-5 font-medium transition-colors ${
                pathname === tab.route
                  ? "border-b-2 border-blue-500 text-white bg-blue-300 rounded-t-lg"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NavigationTabs;