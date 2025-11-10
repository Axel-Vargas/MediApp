"use client";

import React, { useState, useRef, useEffect } from "react";
import { useUser } from "@/context/userContext";
import { userService } from "@/lib/services/userService";
import { useRouter } from "next/navigation";


const MAX_MESSAGE_LENGTH = 70;

export default function Chatbot() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [medications, setMedications] = useState([]);
  const [isLoadingMedications, setIsLoadingMedications] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "¡Hola! Soy tu asistente de salud. ¿En qué puedo ayudarte hoy?",
      sender: "bot"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const messagesEndRef = useRef(null);
  const [pacienteId, setPacienteId] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Cargar pacienteId al montar el componente
  useEffect(() => {
    let isMounted = true;
    const cargarPaciente = async () => {
      if (!user?.id) return;
      try {
        const paciente = await userService.getPacienteByUsuarioId(user.id);
        if (isMounted && paciente && paciente.id) {
          setPacienteId(paciente.id);
        }
      } catch (err) {
        if (isMounted) setPacienteId(null);
      }
    };
    cargarPaciente();
    return () => { isMounted = false; };
  }, [user?.id]);

  // Cargar medicamentos del paciente al montar el componente
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    
    const loadMedications = async () => {
      if (!pacienteId) {
        setIsLoadingMedications(false);
        return;
      }
      try {
        const data = await userService.getPacienteMedicaciones
          ? await userService.getPacienteMedicaciones(pacienteId)
          : [];
        if (isMounted) {
          setMedications(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError('No se pudieron cargar los medicamentos');
          setMedications([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingMedications(false);
        }
      }
    };
    loadMedications();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [pacienteId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!loading && (!user || user.rol !== 'paciente')) {
      router.push('/');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!user || user.rol !== 'paciente') {
    return null;
  }

  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setInputValue(value);
      setCharacterCount(value.length);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isLoading || trimmedMessage.length > MAX_MESSAGE_LENGTH) return;

    const userMessage = {
      id: Date.now(),
      text: trimmedMessage,
      sender: "user"
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setCharacterCount(0);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          pacienteId: pacienteId
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        text: data.text,
        sender: "bot"
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        text: 'Hubo un error al procesar tu mensaje.',
        sender: "bot"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3  gap-4">
      {/* Chat principal */}
      <div className="lg:col-span-2 flex flex-col gap-4 bg-gray-50">
        <div className="bg-white rounded-xl shadow-md">
          <div className="bg-white p-4 rounded-t-lg shadow-sm flex-shrink-0">
            <h1 className="text-xl font-semibold text-gray-900">Asistente de Salud</h1>
          </div>

          {/* Mensajes */}
          <div className="flex-1 h-70 overflow-y-auto px-2 py-2 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${message.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-400 border border-gray-200 text-gray-50"
                    }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Entrada */}
          <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
              <div className="flex items-end space-x-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Escribe tu mensaje..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
                    disabled={isLoading}
                    maxLength={MAX_MESSAGE_LENGTH}
                  />
                  <div className={`absolute right-3 bottom-2.5 text-xs ${characterCount > MAX_MESSAGE_LENGTH * 0.8
                    ? 'text-red-500 font-medium'
                    : 'text-gray-400'
                    }`}>
                    {characterCount}/{MAX_MESSAGE_LENGTH}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    !inputValue.trim() ||
                    inputValue.length > MAX_MESSAGE_LENGTH
                  }
                  className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Enviar
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500 text-center">
                Máx. {MAX_MESSAGE_LENGTH} caracteres por mensaje.
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tus Medicamentos</h3>
        <div className="space-y-3">
          {isLoadingMedications ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
              {error}
            </div>
          ) : medications && medications.length > 0 ? (
            medications
              .filter(med => med.activo === true || med.activo === 1 || med.active === true)
              .map((med) => (
                <div key={med.id || med._id} className="p-3 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900">{med.name || med.nombre} {med.dosage && `(${med.dosage})`}</h4>
                </div>
              ))
          ) : (
            <p className="text-gray-500 text-sm">No hay medicamentos registrados.</p>
          )}
        </div>
      </div>
    </div>
  );
}
