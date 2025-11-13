"use client";

import { createContext, useState, useEffect, useContext, useRef, useCallback, useMemo } from "react";
import { userService, authManager } from "@/lib/services/userService";
import { notificationService } from "@/lib/services/notificationService";
import { medicacionService } from "@/lib/services/medicacionService";
import { marcarDosisPerdidasAutomaticamente, marcarDosisPerdidasDiasAnteriores } from "@/lib/utils/marcarDosisPerdidas";

// Variable global para controlar el marcado automático
let lastMarkingTime = 0;
const MARKING_INTERVAL = 10 * 60 * 1000;

const usersCache = {
  data: null,
  timestamp: null,
  TTL: 5 * 60 * 1000,
  isValid: () => {
    if (!usersCache.data || !usersCache.timestamp) return false;
    return Date.now() - usersCache.timestamp < usersCache.TTL;
  }
};

const patientDataCache = {
  medications: {
    data: null,
    pacienteId: null,
    timestamp: null,
    TTL: 2 * 60 * 1000,
    isValid: (pacienteId) => {
      if (!patientDataCache.medications.data || !patientDataCache.medications.timestamp || patientDataCache.medications.pacienteId !== pacienteId) return false;
      return Date.now() - patientDataCache.medications.timestamp < patientDataCache.medications.TTL;
    }
  },
  familyMembers: {
    data: null,
    pacienteId: null,
    timestamp: null,
    TTL: 5 * 60 * 1000,
    isValid: (pacienteId) => {
      if (!patientDataCache.familyMembers.data || !patientDataCache.familyMembers.timestamp || patientDataCache.familyMembers.pacienteId !== pacienteId) return false;
      return Date.now() - patientDataCache.familyMembers.timestamp < patientDataCache.familyMembers.TTL;
    }
  },
  doctor: {
    data: null,
    pacienteId: null,
    timestamp: null,
    TTL: 10 * 60 * 1000,
    isValid: (pacienteId) => {
      if (!patientDataCache.doctor.data || !patientDataCache.doctor.timestamp || patientDataCache.doctor.pacienteId !== pacienteId) return false;
      return Date.now() - patientDataCache.doctor.timestamp < patientDataCache.doctor.TTL;
    }
  }
};

const doctorDataCache = {
  patientMedications: {
    data: {},
    doctorId: null,
    timestamp: null,
    TTL: 2 * 60 * 1000,
    isValid: (doctorId, patientId = null) => {
      if (!doctorDataCache.patientMedications.data || !doctorDataCache.patientMedications.timestamp || doctorDataCache.patientMedications.doctorId !== doctorId) return false;
      if (patientId !== null && doctorDataCache.patientMedications.data[patientId] === undefined) return false;
      return Date.now() - doctorDataCache.patientMedications.timestamp < doctorDataCache.patientMedications.TTL;
    }
  },
  administrationRoutes: {
    data: null,
    timestamp: null,
    TTL: 30 * 60 * 1000,
    isValid: () => {
      if (!doctorDataCache.administrationRoutes.data || !doctorDataCache.administrationRoutes.timestamp) return false;
      return Date.now() - doctorDataCache.administrationRoutes.timestamp < doctorDataCache.administrationRoutes.TTL;
    }
  }
};

const medicationHistoryCache = {
  data: {},
  TTL: 2 * 60 * 1000,
  isValid: (pacienteId, days) => {
    const cacheKey = `${pacienteId}-${days}`;
    const cached = medicationHistoryCache.data[cacheKey];
    if (!cached || !cached.data || !cached.timestamp || cached.pacienteId !== pacienteId || cached.days !== days) return false;
    return Date.now() - cached.timestamp < medicationHistoryCache.TTL;
  },
  get: (pacienteId, days) => {
    const cacheKey = `${pacienteId}-${days}`;
    return medicationHistoryCache.data[cacheKey]?.data || null;
  },
  set: (pacienteId, days, data) => {
    const cacheKey = `${pacienteId}-${days}`;
    medicationHistoryCache.data[cacheKey] = {
      data,
      pacienteId,
      days,
      timestamp: Date.now()
    };
  },
  invalidate: (pacienteId) => {
    Object.keys(medicationHistoryCache.data).forEach(key => {
      if (key.startsWith(`${pacienteId}-`)) {
        delete medicationHistoryCache.data[key];
      }
    });
  },
  clear: () => {
    medicationHistoryCache.data = {};
  }
};

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const inactivityWarningRef = useRef(null);
  const activityHandlersRef = useRef(new Set());
  const allUsersLoadingRef = useRef(false);
  const [pacienteId, setPacienteId] = useState(null);
  const pacienteIdLoadingRef = useRef(false);
  const [patientMedications, setPatientMedications] = useState([]);
  const [patientFamilyMembers, setPatientFamilyMembers] = useState([]);
  const [patientDoctor, setPatientDoctor] = useState(null);
  const medicationsLoadingRef = useRef(false);
  const familyMembersLoadingRef = useRef(false);
  const doctorLoadingRef = useRef(false);
  const [doctorPatientMedications, setDoctorPatientMedications] = useState({});
  const [administrationRoutes, setAdministrationRoutes] = useState([]);
  const doctorMedicationsLoadingRef = useRef(false);
  const administrationRoutesLoadingRef = useRef(false);
  const [medicationHistory, setMedicationHistory] = useState({});
  const medicationHistoryLoadingRef = useRef({});

  // Referencia para handleInactiveLogout (se asignará después de definirse)
  const showWarningRef = useRef(null);

  // Cerrar sesión (definir temprano para uso en otras funciones)
  const handleLogout = () => {
    try {
      authManager.clearTimers();
      setShowInactivityWarning(false);
      if (inactivityWarningRef.current) {
        clearTimeout(inactivityWarningRef.current);
        inactivityWarningRef.current = null;
      }

      activityHandlersRef.current.forEach(handler => {
        window.removeEventListener('mousemove', handler);
        window.removeEventListener('keydown', handler);
        window.removeEventListener('scroll', handler);
        window.removeEventListener('click', handler);
        window.removeEventListener('touchstart', handler);
      });
      activityHandlersRef.current.clear();

      setUser(null);
      setSelectedPatient(null);
      setPacienteId(null);
      setError(null);
      pacienteIdLoadingRef.current = false;

      setPatientMedications([]);
      setPatientFamilyMembers([]);
      setPatientDoctor(null);
      patientDataCache.medications.data = null;
      patientDataCache.medications.pacienteId = null;
      patientDataCache.medications.timestamp = null;
      patientDataCache.familyMembers.data = null;
      patientDataCache.familyMembers.pacienteId = null;
      patientDataCache.familyMembers.timestamp = null;
      patientDataCache.doctor.data = null;
      patientDataCache.doctor.pacienteId = null;
      patientDataCache.doctor.timestamp = null;

      setDoctorPatientMedications({});
      setAdministrationRoutes([]);
      doctorDataCache.patientMedications.data = {};
      doctorDataCache.patientMedications.doctorId = null;
      doctorDataCache.patientMedications.timestamp = null;
      doctorDataCache.administrationRoutes.data = null;
      doctorDataCache.administrationRoutes.timestamp = null;

      setMedicationHistory({});
      medicationHistoryCache.clear();

      userService.logout();
    } catch (error) {
      console.error('Error en handleLogout:', error);
    }
  };

  // Manejar cierre de sesión por inactividad (definir después de handleLogout)
  const handleInactiveLogout = useCallback(() => {
    if (inactivityWarningRef.current) {
      clearTimeout(inactivityWarningRef.current);
      inactivityWarningRef.current = null;
    }
    setShowInactivityWarning(false);
    handleLogout();
  }, []);

  // Mostrar advertencia de inactividad (definir después de handleInactiveLogout)
  const showWarning = useCallback(() => {
    if (!user) return;

    if (inactivityWarningRef.current) {
      clearTimeout(inactivityWarningRef.current);
      inactivityWarningRef.current = null;
    }

    if (showInactivityWarning) {
      console.log('[showWarning] Modal ya está mostrando, ignorando llamada');
      return;
    }

    console.log('[showWarning] Mostrando modal de inactividad');
    setShowInactivityWarning(true);

    inactivityWarningRef.current = setTimeout(() => {
      setShowInactivityWarning(false);
      if (showWarningRef.current) {
        showWarningRef.current();
      }
    }, 30000);
  }, [user, showInactivityWarning]);

  // Extender la sesión cuando el usuario hace clic en "Continuar" (definir después de showWarning)
  const handleContinueSession = useCallback(() => {
    if (inactivityWarningRef.current) {
      clearTimeout(inactivityWarningRef.current);
      inactivityWarningRef.current = null;
    }

    setShowInactivityWarning(false);

    authManager.isWarningActive = false;
    authManager.resetInactivityTimer(handleInactiveLogout, showWarning);
  }, [showWarning, handleInactiveLogout]);

  // Asignar handleInactiveLogout al ref usando useEffect (evita problemas de inicialización)
  useEffect(() => {
    showWarningRef.current = handleInactiveLogout;
  }, [handleInactiveLogout]);

  // Función para cargar usuarios (solo cuando sea necesario y con caché)
  const loadAllUsers = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && usersCache.isValid()) {
      setAllUsers(usersCache.data);
      return usersCache.data;
    }

    if (allUsersLoadingRef.current) {
      return usersCache.data;
    }

    try {
      allUsersLoadingRef.current = true;
      const users = await userService.getAllUsers();

      usersCache.data = users;
      usersCache.timestamp = Date.now();

      setAllUsers(users);
      return users;
    } catch (err) {
      console.warn("[UserContext] No se pudieron cargar los usuarios:", err);
      if (usersCache.data) {
        setAllUsers(usersCache.data);
        return usersCache.data;
      }
      return [];
    } finally {
      allUsersLoadingRef.current = false;
    }
  }, []);

  // Inicializar usuario desde el token (si existe)
  useEffect(() => {
    let isMounted = true;

    const checkAuthOnInit = async () => {
      try {
        if (typeof window !== 'undefined') {
          const publicRoutes = ['/admin/login', '/family/access', '/family/dashboard'];
          const currentPath = window.location.pathname;
          const isPublicRoute = publicRoutes.some(route => currentPath.startsWith(route));

          if (isPublicRoute) {
            if (isMounted) {
              setLoading(false);
            }
            return;
          }
        }

        authManager.clearTimers();

        const token = authManager.getToken();

        if (!token) {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Obtener datos del usuario y pacientes en paralelo si es doctor
        const [me] = await Promise.all([
          userService.getMe()
        ]);

        if (!isMounted) return;

        if (me) {
          if (me.rol === 'doctor' && me.id) {
            try {
              const pacientes = await userService.getPatientsByDoctorId(me.id);
              me.patients = pacientes || [];
            } catch (err) {
              console.warn('[checkAuthOnInit] No se pudieron cargar los pacientes del doctor:', err);
              me.patients = [];
            }
          } else {
            me.patients = [];
          }

          setUser(me);

          if (me.rol === 'paciente' && me.id && !pacienteIdLoadingRef.current) {
            pacienteIdLoadingRef.current = true;
            userService.getPacienteByUsuarioId(me.id)
              .then(paciente => {
                if (paciente && paciente.id && isMounted) {
                  setPacienteId(paciente.id);
                }
              })
              .catch(err => {
                console.warn('[checkAuthOnInit] No se pudo cargar pacienteId:', err);
              })
              .finally(() => {
                pacienteIdLoadingRef.current = false;
              });
          }
        } else {
          authManager.clear();
          setUser(null);
          setPacienteId(null);
        }
      } catch (err) {
        console.error('[UserContext] Error al validar la sesión:', err);
        if (err.response?.status === 401 || err.message?.includes('No autorizado')) {
          authManager.clear();
        }
        setError('La sesión ha expirado o no es válida. Por favor, inicia sesión nuevamente.');
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuthOnInit();
  }, []);

  // Temporizador y listeners de inactividad SOLO si hay usuario autenticado
  useEffect(() => {
    if (!user) {
      authManager.clearTimers();
      setShowInactivityWarning(false);
      if (inactivityWarningRef.current) {
        clearTimeout(inactivityWarningRef.current);
        inactivityWarningRef.current = null;
      }
      return;
    }

    // Configurar el temporizador de inactividad solo si no hay advertencia activa
    if (!authManager.isWarningActive) {
      authManager.resetInactivityTimer(handleInactiveLogout, showWarning);
    }

    const handleUserActivity = () => {
      if (!showInactivityWarning && !authManager.isWarningActive) {
        authManager.resetInactivityTimer(handleInactiveLogout, showWarning);

        // Marcar dosis perdidas automáticamente cuando el usuario está activo (solo cada 10 minutos)
        if (user && (user.rol === 'paciente' || user.rol === 'doctor')) {
          const now = Date.now();
          if (now - lastMarkingTime > MARKING_INTERVAL) {
            lastMarkingTime = now;

            marcarDosisPerdidasAutomaticamente().catch(error => {
              console.warn('[UserContext] Error al marcar dosis perdidas automáticamente:', error);
            });
          }
        }
      } else {
        console.log('[handleUserActivity] No reseteando timer - showInactivityWarning:', showInactivityWarning, 'isWarningActive:', authManager.isWarningActive);
      }
    };

    // Limpiar event listeners anteriores
    activityHandlersRef.current.forEach(handler => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('scroll', handler);
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
    });
    activityHandlersRef.current.clear();

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
      activityHandlersRef.current.add(handleUserActivity);
    });

    return () => {
      // Copiar el ref a una variable local para usar en cleanup
      const handlers = activityHandlersRef.current;
      handlers.forEach(handler => {
        window.removeEventListener('mousemove', handler);
        window.removeEventListener('keydown', handler);
        window.removeEventListener('scroll', handler);
        window.removeEventListener('click', handler);
        window.removeEventListener('touchstart', handler);
      });
      handlers.clear();
      authManager.clearTimers();
      setShowInactivityWarning(false);
      if (inactivityWarningRef.current) {
        clearTimeout(inactivityWarningRef.current);
        inactivityWarningRef.current = null;
      }
    };
  }, [user, handleInactiveLogout, showWarning, showInactivityWarning]);

  // Marcar dosis perdidas de días anteriores solo cuando el usuario se conecta por primera vez
  useEffect(() => {
    if (user && (user.rol === 'paciente' || user.rol === 'doctor')) {
      marcarDosisPerdidasDiasAnteriores(7).catch(error => {
        console.warn('[UserContext] Error al marcar dosis perdidas de días anteriores:', error);
      });
    }
  }, [user?.id, user?.rol]);

  // Iniciar sesión
  const handleLogin = async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      const loginResponse = await userService.login(username, password);

      let userData = loginResponse.user || loginResponse;

      if (userData.rol === 'doctor' && userData.id) {
        try {
          const pacientes = await userService.getPatientsByDoctorId(userData.id);
          userData.patients = pacientes || [];
        } catch (err) {
          console.warn('[handleLogin] No se pudieron cargar los pacientes del doctor:', err);
          userData.patients = [];
        }
      } else {
        userData.patients = [];
      }

      setUser(userData);
      setSelectedPatient(null);

      if (userData.rol === 'paciente' && userData.id && !pacienteIdLoadingRef.current) {
        pacienteIdLoadingRef.current = true;
        userService.getPacienteByUsuarioId(userData.id)
          .then(paciente => {
            if (paciente && paciente.id) {
              setPacienteId(paciente.id);
            }
          })
          .catch(err => {
            console.warn('[handleLogin] No se pudo cargar pacienteId:', err);
          })
          .finally(() => {
            pacienteIdLoadingRef.current = false;
          });
      }

      authManager.resetInactivityTimer(handleInactiveLogout, showWarning);

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          await notificationService.registerServiceWorker();

          // Activar notificaciones push para el usuario
          await notificationService.activatePushNotifications(userData.id);
        } catch (error) {
          console.warn('⚠️ No se pudo registrar el service worker:', error);
        }
      }

      return {
        user: userData,
        redirectPath: loginResponse.redirectPath || (userData.rol === 'doctor' ? '/caregiver/assign' : '/patient/medications')
      };
    } catch (error) {
      console.error('Error en handleLogin:', error);
      const errorMessage = error.message || 'Error al iniciar sesión';
      setError(errorMessage);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };


  // Agregar familiar
  const handleAddFamilyMember = async (pacienteId, familyMember) => {
    try {
      const response = await fetch(`/api/pacientes/${pacienteId}/familiares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(familyMember),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al agregar familiar');
      }

      const newFamilyMember = await response.json();

      patientDataCache.familyMembers.data = null;
      patientDataCache.familyMembers.timestamp = null;
      await loadPatientFamilyMembers(true);

      return newFamilyMember;
    } catch (error) {
      console.error('Error al agregar familiar:', error);
      throw error;
    }
  };

  // Remover familiar
  const handleRemoveFamilyMember = async (pacienteId, memberId) => {
    try {
      patientDataCache.familyMembers.data = null;
      patientDataCache.familyMembers.timestamp = null;
      await loadPatientFamilyMembers(true);

      setUser(prevUser => {
        if (!prevUser.familiares || !Array.isArray(prevUser.familiares)) {
          return prevUser;
        }

        return {
          ...prevUser,
          familiares: prevUser.familiares.filter(f => f && f.id !== memberId)
        };
      });
    } catch (error) {
      console.error('Error al remover familiar:', error);
      throw error;
    }
  };

  // Obtener cuidadores (doctores) - memoizado
  const getCaregivers = useCallback((role = "doctor") => {
    if (allUsers.length === 0) {
      loadAllUsers();
      return [];
    }
    return allUsers.filter(user => user.rol === role);
  }, [allUsers, loadAllUsers]);

  // Obtener pacientes - memoizado
  const getPatients = useCallback(() => {
    if (allUsers.length === 0) {
      loadAllUsers();
      return [];
    }
    return allUsers.filter(user => user.rol === "paciente");
  }, [allUsers, loadAllUsers]);

  // Obtener pacienteId con caché - memoizado
  const getPacienteId = useCallback(async () => {
    if (pacienteId) {
      return pacienteId;
    }

    if (!user || user.rol !== 'paciente' || !user.id) {
      return null;
    }

    if (pacienteIdLoadingRef.current) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (pacienteId && !pacienteIdLoadingRef.current) {
            clearInterval(checkInterval);
            resolve(pacienteId);
          } else if (!pacienteIdLoadingRef.current) {
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(null);
        }, 5000);
      });
    }

    // Cargar pacienteId
    try {
      pacienteIdLoadingRef.current = true;
      const paciente = await userService.getPacienteByUsuarioId(user.id);
      if (paciente && paciente.id) {
        setPacienteId(paciente.id);
        return paciente.id;
      }
      return null;
    } catch (err) {
      console.warn('[getPacienteId] Error al cargar pacienteId:', err);
      return null;
    } finally {
      pacienteIdLoadingRef.current = false;
    }
  }, [user, pacienteId]);

  // Cargar medicamentos del paciente con caché - memoizado
  const loadPatientMedications = useCallback(async (forceRefresh = false) => {
    if (!user || user.rol !== 'paciente') return [];

    const pacienteIdToUse = pacienteId || await getPacienteId();
    if (!pacienteIdToUse) return [];

    if (!forceRefresh && patientDataCache.medications.isValid(pacienteIdToUse)) {
      setPatientMedications(patientDataCache.medications.data);
      return patientDataCache.medications.data;
    }

    if (medicationsLoadingRef.current) {
      return patientDataCache.medications.data || [];
    }

    try {
      medicationsLoadingRef.current = true;
      const medications = await medicacionService.obtenerMedicacionesPorPaciente(pacienteIdToUse);

      patientDataCache.medications.data = Array.isArray(medications) ? medications : [];
      patientDataCache.medications.pacienteId = pacienteIdToUse;
      patientDataCache.medications.timestamp = Date.now();

      setPatientMedications(patientDataCache.medications.data);
      return patientDataCache.medications.data;
    } catch (err) {
      console.warn('[loadPatientMedications] Error al cargar medicamentos:', err);
      if (patientDataCache.medications.data) {
        setPatientMedications(patientDataCache.medications.data);
        return patientDataCache.medications.data;
      }
      return [];
    } finally {
      medicationsLoadingRef.current = false;
    }
  }, [user, pacienteId, getPacienteId]);

  // Cargar familiares del paciente con caché - memoizado
  const loadPatientFamilyMembers = useCallback(async (forceRefresh = false) => {
    if (!user || user.rol !== 'paciente') return [];

    const pacienteIdToUse = pacienteId || await getPacienteId();
    if (!pacienteIdToUse) return [];

    if (!forceRefresh && patientDataCache.familyMembers.isValid(pacienteIdToUse)) {
      setPatientFamilyMembers(patientDataCache.familyMembers.data);
      return patientDataCache.familyMembers.data;
    }

    if (familyMembersLoadingRef.current) {
      return patientDataCache.familyMembers.data || [];
    }

    try {
      familyMembersLoadingRef.current = true;
      const response = await fetch(`/api/pacientes/${pacienteIdToUse}/familiares`);
      if (!response.ok) throw new Error('Error al cargar los familiares');

      const data = await response.json();

      patientDataCache.familyMembers.data = Array.isArray(data) ? data : [];
      patientDataCache.familyMembers.pacienteId = pacienteIdToUse;
      patientDataCache.familyMembers.timestamp = Date.now();

      setPatientFamilyMembers(patientDataCache.familyMembers.data);
      return patientDataCache.familyMembers.data;
    } catch (err) {
      console.warn('[loadPatientFamilyMembers] Error al cargar familiares:', err);
      if (patientDataCache.familyMembers.data) {
        setPatientFamilyMembers(patientDataCache.familyMembers.data);
        return patientDataCache.familyMembers.data;
      }
      return [];
    } finally {
      familyMembersLoadingRef.current = false;
    }
  }, [user, pacienteId, getPacienteId]);

  // Cargar doctor del paciente con caché - memoizado
  const loadPatientDoctor = useCallback(async (forceRefresh = false) => {
    if (!user || user.rol !== 'paciente') return null;

    const pacienteIdToUse = pacienteId || await getPacienteId();
    if (!pacienteIdToUse) return null;

    if (!forceRefresh && patientDataCache.doctor.isValid(pacienteIdToUse)) {
      setPatientDoctor(patientDataCache.doctor.data);
      return patientDataCache.doctor.data;
    }

    if (doctorLoadingRef.current) {
      return patientDataCache.doctor.data || null;
    }

    try {
      doctorLoadingRef.current = true;
      const response = await fetch(`/api/pacientes/${pacienteIdToUse}/doctor`).catch(() => ({ ok: false, status: 404 }));

      if (response.ok) {
        const doctorData = await response.json();

        patientDataCache.doctor.data = doctorData;
        patientDataCache.doctor.pacienteId = pacienteIdToUse;
        patientDataCache.doctor.timestamp = Date.now();

        setPatientDoctor(doctorData);
        return doctorData;
      } else if (response.status === 404) {
        patientDataCache.doctor.data = null;
        patientDataCache.doctor.pacienteId = pacienteIdToUse;
        patientDataCache.doctor.timestamp = Date.now();
        setPatientDoctor(null);
        return null;
      } else {
        throw new Error('Error al cargar la información del doctor');
      }
    } catch (err) {
      console.warn('[loadPatientDoctor] Error al cargar doctor:', err);
      if (patientDataCache.doctor.data !== undefined) {
        setPatientDoctor(patientDataCache.doctor.data);
        return patientDataCache.doctor.data;
      }
      return null;
    } finally {
      doctorLoadingRef.current = false;
    }
  }, [user, pacienteId, getPacienteId]);

  // Cargar medicaciones de pacientes del doctor con caché - memoizado
  const loadDoctorPatientMedications = useCallback(async (forceRefresh = false, patientIds = null) => {
    if (!user || user.rol !== 'doctor' || !user.id) return {};

    const doctorId = user.id;
    const patientsToLoad = patientIds || (user.patients || []).map(p => p.id);

    if (patientsToLoad.length === 0) return {};

    const cachedData = {};
    let needsRefresh = false;

    if (!forceRefresh && doctorDataCache.patientMedications.isValid(doctorId, null)) {
      const allCached = patientsToLoad.every(patientId =>
        doctorDataCache.patientMedications.data[patientId] !== undefined
      );

      if (allCached && patientsToLoad.length > 0) {
        patientsToLoad.forEach(patientId => {
          if (doctorDataCache.patientMedications.data[patientId]) {
            cachedData[patientId] = doctorDataCache.patientMedications.data[patientId];
          } else {
            cachedData[patientId] = [];
          }
        });
        setDoctorPatientMedications({ ...doctorDataCache.patientMedications.data });
        return cachedData;
      } else {
        patientsToLoad.forEach(patientId => {
          if (doctorDataCache.patientMedications.data[patientId] !== undefined) {
            cachedData[patientId] = doctorDataCache.patientMedications.data[patientId];
          } else {
            needsRefresh = true;
          }
        });
        if (Object.keys(cachedData).length > 0) {
          setDoctorPatientMedications({ ...doctorDataCache.patientMedications.data });
        }
      }
    } else {
      needsRefresh = true;
    }

    if (!forceRefresh && doctorMedicationsLoadingRef.current) {
      if (Object.keys(cachedData).length > 0) {
        return cachedData;
      }
      return doctorDataCache.patientMedications.data || {};
    }

    if (!needsRefresh && Object.keys(cachedData).length === patientsToLoad.length) {
      return cachedData;
    }

    try {
      doctorMedicationsLoadingRef.current = true;

      const medicationPromises = patientsToLoad.map(async (patientId) => {
        if (cachedData[patientId] && !forceRefresh) {
          return { patientId, data: cachedData[patientId] };
        }

        try {
          const response = await fetch(`/api/pacientes/${patientId}/medicaciones`);
          if (response.ok) {
            const data = await response.json();
            return { patientId, data: Array.isArray(data) ? data : [] };
          } else {
            console.warn(`Error al cargar medicaciones para paciente ${patientId}:`, response.statusText);
            return { patientId, data: cachedData[patientId] || [] };
          }
        } catch (err) {
          console.warn(`Error al cargar medicaciones para paciente ${patientId}:`, err);
          return { patientId, data: cachedData[patientId] || [] };
        }
      });

      const results = await Promise.all(medicationPromises);

      const updatedData = { ...doctorDataCache.patientMedications.data };
      results.forEach(({ patientId, data }) => {
        updatedData[patientId] = data;
      });

      doctorDataCache.patientMedications.data = updatedData;
      doctorDataCache.patientMedications.doctorId = doctorId;
      doctorDataCache.patientMedications.timestamp = Date.now();

      setDoctorPatientMedications(updatedData);
      return updatedData;
    } catch (err) {
      console.warn('[loadDoctorPatientMedications] Error al cargar medicaciones:', err);
      if (Object.keys(cachedData).length > 0 || Object.keys(doctorDataCache.patientMedications.data || {}).length > 0) {
        const fallbackData = Object.keys(cachedData).length > 0
          ? { ...doctorDataCache.patientMedications.data, ...cachedData }
          : doctorDataCache.patientMedications.data || {};
        setDoctorPatientMedications(fallbackData);
        return fallbackData;
      }
      return {};
    } finally {
      doctorMedicationsLoadingRef.current = false;
    }
  }, [user]);

  // Cargar vías de administración con caché - memoizado
  const loadAdministrationRoutes = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && doctorDataCache.administrationRoutes.isValid()) {
      setAdministrationRoutes(doctorDataCache.administrationRoutes.data);
      return doctorDataCache.administrationRoutes.data;
    }

    if (administrationRoutesLoadingRef.current) {
      return doctorDataCache.administrationRoutes.data || [];
    }

    try {
      administrationRoutesLoadingRef.current = true;
      const response = await fetch('/api/vias-administracion?activas=true');

      if (response.ok) {
        const data = await response.json();
        const routes = Array.isArray(data) ? data : [];

        doctorDataCache.administrationRoutes.data = routes;
        doctorDataCache.administrationRoutes.timestamp = Date.now();

        setAdministrationRoutes(routes);
        return routes;
      } else {
        throw new Error('Error al cargar las vías de administración');
      }
    } catch (err) {
      console.warn('[loadAdministrationRoutes] Error al cargar vías de administración:', err);
      if (doctorDataCache.administrationRoutes.data) {
        setAdministrationRoutes(doctorDataCache.administrationRoutes.data);
        return doctorDataCache.administrationRoutes.data;
      }
      return [];
    } finally {
      administrationRoutesLoadingRef.current = false;
    }
  }, []);

  // Cargar historial de medicaciones con caché global - memoizado
  const loadMedicationHistory = useCallback(async (pacienteId, days = 7, forceRefresh = false) => {
    if (!pacienteId) return [];

    const cacheKey = `${pacienteId}-${days}`;

    if (!forceRefresh && medicationHistoryCache.isValid(pacienteId, days)) {
      const cachedData = medicationHistoryCache.get(pacienteId, days);
      if (cachedData) {
        setMedicationHistory(prev => ({
          ...prev,
          [cacheKey]: cachedData
        }));
        return cachedData;
      }
    }

    if (medicationHistoryLoadingRef.current[cacheKey]) {
      const cachedData = medicationHistoryCache.get(pacienteId, days);
      if (cachedData) {
        return cachedData;
      }
      return medicationHistory[cacheKey] || [];
    }

    try {
      medicationHistoryLoadingRef.current[cacheKey] = true;

      const response = await fetch(`/api/pacientes/${pacienteId}/medicaciones/historial?days=${days}`);

      if (response.ok) {
        const data = await response.json();
        const historyData = Array.isArray(data) ? data : [];

        medicationHistoryCache.set(pacienteId, days, historyData);

        setMedicationHistory(prev => ({
          ...prev,
          [cacheKey]: historyData
        }));

        return historyData;
      } else {
        throw new Error('Error al cargar el historial de medicaciones');
      }
    } catch (err) {
      console.warn('[loadMedicationHistory] Error al cargar historial:', err);
      const cachedData = medicationHistoryCache.get(pacienteId, days);
      if (cachedData) {
        setMedicationHistory(prev => ({
          ...prev,
          [cacheKey]: cachedData
        }));
        return cachedData;
      }
      if (medicationHistory[cacheKey]) {
        return medicationHistory[cacheKey];
      }
      return [];
    } finally {
      medicationHistoryLoadingRef.current[cacheKey] = false;
    }
  }, [medicationHistory]);

  // Invalidar caché de historial para un paciente (cuando se toma una medicación, etc.)
  const invalidateMedicationHistory = useCallback((pacienteId) => {
    if (!pacienteId) return;

    medicationHistoryCache.invalidate(pacienteId);

    setMedicationHistory(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`${pacienteId}-`)) {
          delete updated[key];
        }
      });
      return updated;
    });
  }, []);

  // Actualizar perfil de usuario
  const updateUserProfile = async (updatedUserData) => {
    try {
      const updatedUser = await userService.updateUser(user.id, updatedUserData);
      setUser(prevUser => ({
        ...prevUser,
        ...updatedUser
      }));
      return updatedUser;
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      throw error;
    }
  };

  // Registrar usuario
  const handleRegister = async (userData) => {
    try {
      const apiData = {
        nombre: userData.name,
        email: userData.email,
        telefono: userData.phone,
        usuario: userData.username,
        contrasena: userData.password,
        rol: userData.rol,
        doctorIds: userData.doctorIds || []
      };

      if (userData.rol === 'doctor' && userData.especialidad) {
        apiData.especialidad = parseInt(userData.especialidad, 10);
      }

      const newUser = await userService.createUser(apiData);

      usersCache.data = null;
      usersCache.timestamp = null;
      await loadAllUsers(true);

      return newUser;
    } catch (error) {
      console.error('Error en handleRegister:', error);
      throw error;
    }
  };

  const contextValue = useMemo(() => ({
    user,
    allUsers,
    selectedPatient,
    pacienteId,
    loading,
    error,
    setUser,
    setSelectedPatient,
    handleLogin,
    handleLogout,
    handleRegister,
    handleAddFamilyMember,
    handleRemoveFamilyMember,
    updateUser: updateUserProfile,
    getCaregivers,
    getPatients,
    getPacienteId,
    loadAllUsers,
    patientMedications,
    patientFamilyMembers,
    patientDoctor,
    loadPatientMedications,
    loadPatientFamilyMembers,
    loadPatientDoctor,
    doctorPatientMedications,
    administrationRoutes,
    loadDoctorPatientMedications,
    loadAdministrationRoutes,
    medicationHistory,
    loadMedicationHistory,
    invalidateMedicationHistory
  }), [user, allUsers, selectedPatient, pacienteId, loading, error, getCaregivers, getPatients, getPacienteId, loadAllUsers, patientMedications, patientFamilyMembers, patientDoctor, loadPatientMedications, loadPatientFamilyMembers, loadPatientDoctor, doctorPatientMedications, administrationRoutes, loadDoctorPatientMedications, loadAdministrationRoutes, medicationHistory, loadMedicationHistory, invalidateMedicationHistory, handleAddFamilyMember, handleLogin, handleRegister, handleRemoveFamilyMember, updateUserProfile]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}

      {/* Modal de advertencia de inactividad */}
      {showInactivityWarning && user && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">¡Atención!</h3>
            <p className="mb-4">
              Su sesión está a punto de cerrarse por inactividad.
              ¿Desea continuar en el sistema?
            </p>
            <p className="text-sm text-gray-600 mb-4">
              La sesión se cerrará automáticamente por inactividad...
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  handleLogout();
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition-colors"
              >
                Cerrar sesión
              </button>
              <button
                onClick={handleContinueSession}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                autoFocus
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser debe usarse dentro de un UserProvider");
  }
  return context;
};