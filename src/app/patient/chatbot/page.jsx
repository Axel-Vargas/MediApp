"use client";

import React, { useState, useRef, useEffect } from "react";
import { useUser } from "@/context/userContext";
import { useRouter } from "next/navigation";


const MAX_MESSAGE_LENGTH = 70;

// Función para normalizar el texto del usuario
function normalizeText(text) {
  if (!text) return '';
  
  // Convertir a minúsculas para normalizar
  let normalized = text.toLowerCase().trim();
  
  // Reemplazar abreviaciones comunes (orden importante: primero las más específicas)
  // Reemplazar "q " (q seguido de espacio) por "que "
  normalized = normalized.replace(/\bq\s+/g, 'que ');
  // Reemplazar "q" (q como palabra completa) por "que"
  normalized = normalized.replace(/\bq\b/g, 'que');
  
  // Reemplazar "pq" por "porque"
  normalized = normalized.replace(/\bpq\b/g, 'porque');
  normalized = normalized.replace(/\bpq\s+/g, 'porque ');
  
  // Reemplazar "pa" por "para" (solo si no es parte de otra palabra)
  normalized = normalized.replace(/\bpa\s+/g, 'para ');
  normalized = normalized.replace(/\bpa\b/g, 'para');
  
  // Reemplazar "x" por "por"
  normalized = normalized.replace(/\bx\s+/g, 'por ');
  normalized = normalized.replace(/\bx\b/g, 'por');
  
  // Reemplazar "d" por "de" (solo si es palabra completa)
  normalized = normalized.replace(/\bd\s+/g, 'de ');
  
  // Normalizar nombres de medicamentos comunes
  normalized = normalized.replace(/\bacetaminofen\b/g, 'paracetamol');
  
  // Limpiar espacios múltiples
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Capitalizar primera letra
  if (normalized.length > 0) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  
  return normalized;
}

export default function Chatbot() {
  const { user, loading, pacienteId, patientMedications, loadPatientMedications } = useUser();
  const router = useRouter();
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Cargar medicamentos desde el contexto (con caché)
  useEffect(() => {
    if (!loading && user && user.rol === 'paciente' && pacienteId) {
      loadPatientMedications().catch(err => {
        console.error('[Chatbot] Error al cargar medicaciones:', err);
        setError('No se pudieron cargar los medicamentos');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, pacienteId]); // Solo cargar si cambia el usuario o pacienteId

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

    // Normalizar el mensaje antes de enviarlo
    const normalizedMessage = normalizeText(trimmedMessage);

    const userMessage = {
      id: Date.now(),
      text: trimmedMessage, // Mostrar el mensaje original al usuario
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
          messages: [...messages, { ...userMessage, text: normalizedMessage }], // Enviar mensaje normalizado
          pacienteId: pacienteId
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const data = await response.json();

      // Validar que la respuesta tenga contenido
      const botResponseText = data?.text?.trim() || data?.error || 'Lo siento, no pude generar una respuesta. Por favor, intenta reformular tu pregunta.';

      const botMessage = {
        id: Date.now() + 1,
        text: botResponseText,
        sender: "bot"
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        text: 'Hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
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
          {error && (!patientMedications || patientMedications.length === 0) ? (
            <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
              {error}
            </div>
          ) : patientMedications && patientMedications.length > 0 ? (
            patientMedications
              .filter(med => med.activo === true || med.activo === 1 || med.active === true)
              .map((med) => (
                <div key={med.id || med._id} className="p-3 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900">{med.nombreMedicamento || med.name || med.nombre} {med.dosis && `(${med.dosis})`}</h4>
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
