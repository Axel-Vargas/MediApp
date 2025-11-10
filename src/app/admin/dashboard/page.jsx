"use client";

import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, UserIcon, UsersIcon, ClockIcon, ArrowLeftOnRectangleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useRouter } from "next/navigation";
import { useAdmin } from "@/context/adminContext";
import Toast from '@/components/Toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { decryptFromPacked } from '@/lib/crypto';

const UserManagement = () => {
  const [doctores, setDoctores] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(true);
  const [selectedSection, setSelectedSection] = useState('doctors');
  const [sidebarWidth, setSidebarWidth] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [doctorToReject, setDoctorToReject] = useState(null);
  const [pacienteToAction, setPacienteToAction] = useState(null);
  const [actionType, setActionType] = useState(''); 
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  
  // Estados para configuración del sistema
  const [especialidades, setEspecialidades] = useState([]);
  const [viasAdministracion, setViasAdministracion] = useState([]);
  const [showEspecialidadModal, setShowEspecialidadModal] = useState(false);
  const [showViaModal, setShowViaModal] = useState(false);
  const [especialidadEditando, setEspecialidadEditando] = useState(null);
  const [viaEditando, setViaEditando] = useState(null);
  const [nombreEspecialidad, setNombreEspecialidad] = useState('');
  const [nombreVia, setNombreVia] = useState('');
  const [configTab, setConfigTab] = useState('especialidades'); 
  
  // Estados para paginación de especialidades
  const [paginaEspecialidades, setPaginaEspecialidades] = useState(1);
  const especialidadesPorPagina = 10;
  
  const { admin, loading: adminLoading, handleLogout, mobileMenuOpen, closeMobileMenu } = useAdmin();
  const router = useRouter();
  const sidebarRef = useRef(null);

  // Verificar autenticación del administrador
  useEffect(() => {
    if (!adminLoading && !admin) {
      setTimeout(() => {
        router.push("/");
      }, 0);
    }
  }, [admin, adminLoading, router]);

  // Cargar doctores al montar el componente
  useEffect(() => {
    if (admin) {
      cargarDoctores();
      cargarPacientes();
    }
  }, [admin]);

  // Cargar doctores desde la API
  const cargarDoctores = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/doctores');
      
      if (response.ok) {
        const data = await response.json();
        
        setDoctores(data || []);
      } else {
        const errorText = await response.text();
        console.error('Error al cargar doctores:', {
          status: response.status,
          error: errorText
        });
      }
    } catch (error) {
      console.error('Error en cargarDoctores:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar pacientes desde la API
  const cargarPacientes = async () => {
    try {
      const response = await fetch('/api/admin/pacientes');
      if (response.ok) {
        const data = await response.json();
        setPacientes(data);
      } else {
        console.error('Error al cargar pacientes');
      }
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
    }
  };

  // Cargar especialidades
  const cargarEspecialidades = async () => {
    try {
      const response = await fetch('/api/especialidades');
      if (response.ok) {
        const data = await response.json();
        setEspecialidades(data);
      } else {
        console.error('Error al cargar especialidades');
      }
    } catch (error) {
      console.error('Error al cargar especialidades:', error);
    }
  };

  // Cargar vías de administración
  const cargarViasAdministracion = async () => {
    try {
      const response = await fetch('/api/vias-administracion');
      if (response.ok) {
        const data = await response.json();
        setViasAdministracion(data);
      } else {
        console.error('Error al cargar vías de administración');
      }
    } catch (error) {
      console.error('Error al cargar vías de administración:', error);
    }
  };

  // Agregar o editar especialidad
  const guardarEspecialidad = async () => {
    if (!nombreEspecialidad.trim()) {
      setToast({ show: true, message: 'El nombre de la especialidad es requerido', type: 'error' });
      return;
    }

    try {
      const url = '/api/especialidades';
      const method = especialidadEditando ? 'PUT' : 'POST';
      
      const body = especialidadEditando
        ? { id: especialidadEditando.id, nombre: nombreEspecialidad }
        : { nombre: nombreEspecialidad };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await cargarEspecialidades();
        
        if (!especialidadEditando) {
          const nuevasTotalPaginas = Math.ceil((especialidades.length + 1) / especialidadesPorPagina);
          setPaginaEspecialidades(nuevasTotalPaginas);
        }
        
        setShowEspecialidadModal(false);
        setEspecialidadEditando(null);
        setNombreEspecialidad('');
        setToast({ 
          show: true, 
          message: especialidadEditando ? 'Especialidad actualizada exitosamente' : 'Especialidad agregada exitosamente', 
          type: 'success' 
        });
      } else {
        const error = await response.json();
        setToast({ show: true, message: error.error || 'Error al guardar especialidad', type: 'error' });
      }
    } catch (error) {
      console.error('Error al guardar especialidad:', error);
      setToast({ show: true, message: 'Error al guardar especialidad', type: 'error' });
    }
  };

  // Activar/Desactivar especialidad
  const toggleEspecialidad = async (especialidad) => {
    try {
      const nuevoEstado = !especialidad.activo;
      const response = await fetch(`/api/especialidades?id=${especialidad.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleEstado: true, activo: nuevoEstado }),
      });

      if (response.ok) {
        await cargarEspecialidades();
        setToast({ 
          show: true, 
          message: `Especialidad ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente`, 
          type: 'success' 
        });
      } else {
        const error = await response.json();
        setToast({ show: true, message: error.error || 'Error al cambiar estado de especialidad', type: 'error' });
      }
    } catch (error) {
      console.error('Error al cambiar estado de especialidad:', error);
      setToast({ show: true, message: 'Error al cambiar estado de especialidad', type: 'error' });
    }
  };

  // Agregar o editar vía de administración
  const guardarViaAdministracion = async () => {
    if (!nombreVia.trim()) {
      setToast({ show: true, message: 'El nombre de la vía de administración es requerido', type: 'error' });
      return;
    }

    try {
      const url = '/api/vias-administracion';
      const method = viaEditando ? 'PUT' : 'POST';
      
      const body = viaEditando
        ? { id: viaEditando.id, nombre: nombreVia }
        : { nombre: nombreVia };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await cargarViasAdministracion();
        setShowViaModal(false);
        setViaEditando(null);
        setNombreVia('');
        setToast({ 
          show: true, 
          message: viaEditando ? 'Vía de administración actualizada exitosamente' : 'Vía de administración agregada exitosamente', 
          type: 'success' 
        });
      } else {
        const error = await response.json();
        setToast({ show: true, message: error.error || 'Error al guardar vía de administración', type: 'error' });
      }
    } catch (error) {
      console.error('Error al guardar vía de administración:', error);
      setToast({ show: true, message: 'Error al guardar vía de administración', type: 'error' });
    }
  };

  // Activar/Desactivar vía de administración
  const toggleViaAdministracion = async (via) => {
    try {
      const nuevoEstado = !via.activo;
      const response = await fetch(`/api/vias-administracion?id=${via.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleEstado: true, activo: nuevoEstado }),
      });

      if (response.ok) {
        await cargarViasAdministracion();
        setToast({ 
          show: true, 
          message: `Vía de administración ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente`, 
          type: 'success' 
        });
      } else {
        const error = await response.json();
        setToast({ show: true, message: error.error || 'Error al cambiar estado de vía de administración', type: 'error' });
      }
    } catch (error) {
      console.error('Error al cambiar estado de vía de administración:', error);
      setToast({ show: true, message: 'Error al cambiar estado de vía de administración', type: 'error' });
    }
  };

  useEffect(() => {
    const updateSidebarWidth = () => {
      if (sidebarRef.current) {
        const width = sidebarRef.current.offsetWidth;
        requestAnimationFrame(() => setSidebarWidth(width));
      }
    };

    updateSidebarWidth();
    window.addEventListener('resize', updateSidebarWidth);
    return () => window.removeEventListener('resize', updateSidebarWidth);
  }, [menuOpen]);

  // Aprobar doctor
  const aprobarDoctor = async (doctorId) => {
    try {
      const response = await fetch('/api/admin/doctores', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ doctorId, autorizado: true, activo: true }),
      });
      if (response.ok) {
        await cargarDoctores();
        setToast({ show: true, message: 'Doctor aprobado exitosamente', type: 'success' });
      } else {
        setToast({ show: true, message: 'Error al aprobar doctor', type: 'error' });
      }
    } catch (error) {
      console.error('Error al aprobar doctor:', error);
      setToast({ show: true, message: 'Error al aprobar doctor', type: 'error' });
    }
  };

  // Dar de baja doctor (para doctores autorizados)
  const darDeBajaDoctor = async (doctorId) => {
    try {
      const doctor = doctores.find(d => d.id === doctorId);
      if (!doctor) {
        setToast({ show: true, message: 'Doctor no encontrado', type: 'error' });
        return;
      }

      const response = await fetch('/api/admin/doctores', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          doctorId, 
          autorizado: doctor.autorizado,
          activo: false 
        }),
      });
      if (response.ok) {
        await cargarDoctores();
        setToast({ show: true, message: 'Doctor dado de baja exitosamente', type: 'success' });
      } else {
        setToast({ show: true, message: 'Error al dar de baja doctor', type: 'error' });
      }
    } catch (error) {
      console.error('Error al dar de baja doctor:', error);
      setToast({ show: true, message: 'Error al dar de baja doctor', type: 'error' });
    }
  };

  // Rechazar doctor (para doctores pendientes)
  const rechazarDoctor = async (doctorId) => {
    try {
      const response = await fetch(`/api/admin/doctores?id=${doctorId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await cargarDoctores();
        setToast({ show: true, message: 'Doctor rechazado exitosamente', type: 'success' });
      } else {
        setToast({ show: true, message: 'Error al rechazar doctor', type: 'error' });
      }
    } catch (error) {
      console.error('Error al rechazar doctor:', error);
      setToast({ show: true, message: 'Error al rechazar doctor', type: 'error' });
    }
  };

  // Dar de baja paciente
  const darDeBajaPaciente = async (pacienteId) => {
    try {
      const paciente = pacientes.find(p => p.id === pacienteId);
      if (!paciente) {
        setToast({ show: true, message: 'Paciente no encontrado', type: 'error' });
        return;
      }

      const response = await fetch('/api/admin/pacientes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pacienteId, 
          activo: false 
        }),
      });
      if (response.ok) {
        await cargarPacientes();
        setToast({ show: true, message: 'Paciente dado de baja exitosamente', type: 'success' });
      } else {
        setToast({ show: true, message: 'Error al dar de baja paciente', type: 'error' });
      }
    } catch (error) {
      console.error('Error al dar de baja paciente:', error);
      setToast({ show: true, message: 'Error al dar de baja paciente', type: 'error' });
    }
  };





  const doctoresAutorizados = doctores.filter(doctor => (doctor.autorizado === true || doctor.autorizado === 1) && (doctor.activo === true || doctor.activo === 1));
  const doctoresPendientes = doctores.filter(doctor => doctor.autorizado === false || doctor.autorizado === 0);
  const pacientesActivos = pacientes.filter(paciente => paciente.activo === true || paciente.activo === 1);

  useEffect(() => {
    const updateSidebarWidth = () => {
      if (sidebarRef.current) {
        const width = sidebarRef.current.offsetWidth;
        requestAnimationFrame(() => setSidebarWidth(width));
      }
    };

    updateSidebarWidth();
    window.addEventListener('resize', updateSidebarWidth);
    return () => window.removeEventListener('resize', updateSidebarWidth);
  }, [menuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      setCollapsed(false);
    }
  }, [mobileMenuOpen]);

  // Cerrar el menú móvil cuando se redimensiona a desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileMenuOpen) {
        closeMobileMenu();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen, closeMobileMenu]);

  useEffect(() => {
    setPaginaEspecialidades(1);
  }, [configTab]);

  const openKeyModal = (doctor) => {
    setSelectedDoctor(doctor);
    setNewKey('');
    setShowModal(true);
  };

  const handleKeySubmit = () => {
    if (newKey.trim() === '') return;
    setToast({ show: true, message: `Clave asignada a ${selectedDoctor?.name || selectedDoctor?.nombre}: ${newKey}`, type: 'success' });
    setShowModal(false);
  };

  const doctoresAutorizadosFiltrados = doctoresAutorizados.filter(doctor =>
    doctor.nombre.toLowerCase().includes(search.toLowerCase()) ||
    doctor.usuario.toLowerCase().includes(search.toLowerCase()) ||
    (doctor.especialidadNombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (doctor.telefono || '').toLowerCase().includes(search.toLowerCase())
  );
  const doctoresPendientesFiltrados = doctoresPendientes.filter(doctor =>
    doctor.nombre.toLowerCase().includes(search.toLowerCase()) ||
    doctor.usuario.toLowerCase().includes(search.toLowerCase()) ||
    (doctor.especialidadNombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (doctor.telefono || '').toLowerCase().includes(search.toLowerCase())
  );
  const pacientesFiltrados = pacientesActivos.filter(paciente =>
    paciente.nombre.toLowerCase().includes(search.toLowerCase()) ||
    paciente.usuario.toLowerCase().includes(search.toLowerCase()) ||
    (paciente.telefono || '').toLowerCase().includes(search.toLowerCase())
  );

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    if (typeof window !== 'undefined') {
      router.push("/");
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2 md:px-4">
      {/* Overlay para cerrar el menú en móvil */}
      {mobileMenuOpen && (
        <div 
          className="fixed top-16 left-0 right-0 bottom-0 bg-black/50 z-30 md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
      <div className="w-full flex flex-col md:flex-row gap-3">
        <aside
          className={`bg-white shadow md:p-4 p-0 md:mb-0 ${collapsed ? 'w-16' : 'w-60'} min-w-fit max-w-xs flex-shrink-0 md:h-[calc(100dvh-22px)] flex flex-col transition-all duration-200
            ${mobileMenuOpen ? 'fixed top-16 left-0 z-40 w-64 max-w-full h-[calc(100vh-4rem)] md:static md:block' : 'hidden md:flex'}
            ${mobileMenuOpen ? 'block' : ''}
          `}
        >
          <div className="hidden md:flex items-center mb-4 justify-between">
            <div className={`flex items-center w-full ${collapsed ? 'justify-center' : 'justify-between'}`}>
              {!collapsed && <span className="font-bold text-blue-600 text-xl whitespace-nowrap">MediApp</span>}
              <button
                className="bg-gray-100 hover:bg-gray-200 rounded-full p-1 border border-gray-200"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              >
                {collapsed ? (
                  <FiChevronRight className="h-5 w-5 text-blue-600" />
                ) : (
                  <FiChevronLeft className="h-5 w-5 text-gray-700" />
                )}
              </button>
            </div>
          </div>
          <nav className="flex-1 pt-4 md:pt-0">
            <ul className="flex flex-col gap-1 px-4 md:px-0">
              <li>
                <button
                  className={`w-full text-left px-4 py-2 font-semibold flex items-center gap-2 rounded-lg transition-colors ${selectedSection === 'doctors' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => { setSelectedSection('doctors'); closeMobileMenu(); }}
                >
                  <UserIcon className="w-5 h-5" />
                  {!collapsed && 'Gestionar Doctores'}
                </button>
              </li>
              <li>
                <button
                  className={`w-full text-left px-4 py-2 font-semibold flex items-center gap-2 rounded-lg transition-colors ${selectedSection === 'patients' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => { setSelectedSection('patients'); closeMobileMenu(); }}
                >
                  <UsersIcon className="w-5 h-5" />
                  {!collapsed && 'Gestionar Pacientes'}
                </button>
              </li>
              <li>
                <button
                  className={`w-full text-left px-4 py-2 font-semibold flex items-center gap-2 rounded-lg transition-colors ${selectedSection === 'pending' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => { setSelectedSection('pending'); closeMobileMenu(); }}
                >
                  <ClockIcon className="w-5 h-5" />
                  {!collapsed && 'Pendientes por aprobar'}
                </button>
              </li>
              <li>
                <button
                  className={`w-full text-left px-4 py-2 font-semibold flex items-center gap-2 rounded-lg transition-colors ${selectedSection === 'config' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => { 
                    setSelectedSection('config'); 
                    closeMobileMenu();
                    if (especialidades.length === 0) cargarEspecialidades();
                    if (viasAdministracion.length === 0) cargarViasAdministracion();
                  }}
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  {!collapsed && 'Configuración'}
                </button>
              </li>
            </ul>
          </nav>
          <div className="border-t border-gray-200 pt-4 mt-2 pb-4 md:pb-0">
            <div className="px-4 md:px-0">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 font-semibold flex items-center gap-2 rounded-lg transition-colors text-red-600 hover:bg-red-100"
              >
                <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                {!collapsed && 'Cerrar sesión'}
              </button>
            </div>
          </div>
        </aside>
        <main className="flex-1">
          <div className="bg-white rounded-lg shadow-lg p-4 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {selectedSection === 'doctors'
                  ? 'Doctores Autorizados'
                  : selectedSection === 'patients'
                    ? 'Gestión de Pacientes'
                    : selectedSection === 'config'
                      ? 'Configuración'
                      : 'Doctores Pendientes'}
              </h2>
              {selectedSection !== 'config' && (
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full sm:w-72 px-4 py-2 border border-gray-300 rounded-3xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition placeholder:text-gray-400"
                />
              )}
            </div>
            {selectedSection === 'doctors' && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Especialidad</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Teléfono</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha Registro</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">Cargando doctores...</td>
                      </tr>
                    ) : doctoresAutorizadosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">No hay doctores autorizados.</td>
                      </tr>
                    ) : (
                      doctoresAutorizadosFiltrados.map((doctor) => (
                        <tr key={doctor.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doctor.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doctor.usuario}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doctor.especialidadNombre || 'Sin especialidad'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doctor.telefono || 'No especificado'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doctor.fechaRegistro).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                            <button onClick={() => { setDoctorToReject(doctor.id); setActionType('deactivate'); setShowConfirmModal(true); }} className="px-3 py-1 rounded-md text-sm bg-red-100 text-red-800 hover:bg-red-200">Dar de baja</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedSection === 'pending' && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Especialidad</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Teléfono</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha Registro</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">Cargando doctores pendientes...</td>
                      </tr>
                    ) : doctoresPendientesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">No hay doctores pendientes de aprobación.</td>
                      </tr>
                    ) : (
                      doctoresPendientesFiltrados.map((doctor) => (
                        <tr key={doctor.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doctor.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doctor.usuario}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doctor.especialidadNombre || 'Sin especialidad'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doctor.telefono || 'No especificado'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doctor.fechaRegistro).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                            <button onClick={() => aprobarDoctor(doctor.id)} className="px-3 py-1 rounded-md text-sm bg-green-100 text-green-800 hover:bg-green-200">Aprobar</button>
                            <button onClick={() => { setDoctorToReject(doctor.id); setActionType('reject'); setShowConfirmModal(true); }} className="px-3 py-1 rounded-md text-sm bg-red-100 text-red-800 hover:bg-red-200">Rechazar</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedSection === 'patients' && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Teléfono</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha Registro</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">Cargando pacientes...</td>
                      </tr>
                    ) : pacientesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">No hay pacientes registrados.</td>
                      </tr>
                    ) : (
                      pacientesFiltrados.map((paciente) => (
                        <tr key={paciente.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {paciente.nombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{paciente.usuario}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{paciente.telefono || 'No especificado'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(paciente.fechaRegistro).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                            <button 
                              onClick={() => { 
                                setPacienteToAction(paciente.id); 
                                setActionType('deactivatePatient'); 
                                setShowConfirmModal(true); 
                              }} 
                              className="px-3 py-1 rounded-md text-sm bg-red-100 text-red-800 hover:bg-red-200"
                            >
                              Dar de baja
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedSection === 'config' && (
              <div>
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setConfigTab('especialidades')}
                    className={`px-3 py-1.5 md:px-6 md:py-2 text-sm md:text-base font-semibold rounded-lg transition-colors ${
                      configTab === 'especialidades'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Especialidades
                  </button>
                  <button
                    onClick={() => setConfigTab('vias')}
                    className={`px-3 py-1.5 md:px-6 md:py-2 text-sm md:text-base font-semibold rounded-lg transition-colors ${
                      configTab === 'vias'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Vías de Administración
                  </button>
                </div>

                {configTab === 'especialidades' && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                      <h3 className="text-base md:text-lg font-semibold text-gray-700">
                        Lista de Especialidades 
                        <span className="text-sm text-gray-500 ml-2">({especialidades.length} total{especialidades.length !== 1 ? 'es' : ''})</span>
                      </h3>
                      <button
                        onClick={() => {
                          setEspecialidadEditando(null);
                          setNombreEspecialidad('');
                          setShowEspecialidadModal(true);
                        }}
                        className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Agregar Especialidad
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full bg-white">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {especialidades.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center py-8 text-gray-400">No hay especialidades registradas.</td>
                            </tr>
                          ) : (
                            especialidades
                              .slice((paginaEspecialidades - 1) * especialidadesPorPagina, paginaEspecialidades * especialidadesPorPagina)
                              .map((especialidad) => (
                                <tr key={especialidad.id} className="hover:bg-gray-50 transition">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{especialidad.nombre}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      especialidad.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {especialidad.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                                    <button
                                      onClick={() => {
                                        setEspecialidadEditando(especialidad);
                                        setNombreEspecialidad(especialidad.nombre);
                                        setShowEspecialidadModal(true);
                                      }}
                                      className="px-3 py-1 rounded-md text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActionType('deleteEspecialidad');
                                        setEspecialidadEditando(especialidad);
                                        setShowConfirmModal(true);
                                      }}
                                      className={`px-3 py-1 rounded-md text-sm ${
                                        especialidad.activo 
                                          ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                                      }`}
                                    >
                                      {especialidad.activo ? 'Desactivar' : 'Activar'}
                                    </button>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    {especialidades.length > especialidadesPorPagina && (
                      <div className="flex flex-col sm:flex-row items-center justify-between mt-4 px-4 gap-4">
                        <div className="text-sm text-gray-700">
                          Mostrando {Math.min((paginaEspecialidades - 1) * especialidadesPorPagina + 1, especialidades.length)} a {Math.min(paginaEspecialidades * especialidadesPorPagina, especialidades.length)} de {especialidades.length} especialidades
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPaginaEspecialidades(prev => Math.max(prev - 1, 1))}
                            disabled={paginaEspecialidades === 1}
                            className={`px-3 py-1 rounded-md text-sm ${
                              paginaEspecialidades === 1
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            Anterior
                          </button>
                          <div className="flex items-center gap-1">
                            {(() => {
                              const totalPaginas = Math.ceil(especialidades.length / especialidadesPorPagina);
                              const maxBotones = 5;
                              let inicio = Math.max(1, paginaEspecialidades - Math.floor(maxBotones / 2));
                              let fin = Math.min(totalPaginas, inicio + maxBotones - 1);
                              
                              if (fin - inicio < maxBotones - 1) {
                                inicio = Math.max(1, fin - maxBotones + 1);
                              }
                              
                              return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i).map((pagina) => (
                                <button
                                  key={pagina}
                                  onClick={() => setPaginaEspecialidades(pagina)}
                                  className={`px-3 py-1 rounded-md text-sm ${
                                    paginaEspecialidades === pagina
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  {pagina}
                                </button>
                              ));
                            })()}
                          </div>
                          <button
                            onClick={() => setPaginaEspecialidades(prev => Math.min(prev + 1, Math.ceil(especialidades.length / especialidadesPorPagina)))}
                            disabled={paginaEspecialidades === Math.ceil(especialidades.length / especialidadesPorPagina)}
                            className={`px-3 py-1 rounded-md text-sm ${
                              paginaEspecialidades === Math.ceil(especialidades.length / especialidadesPorPagina)
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {configTab === 'vias' && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                      <h3 className="text-base md:text-lg font-semibold text-gray-700">Lista de Vías de Administración</h3>
                      <button
                        onClick={() => {
                          setViaEditando(null);
                          setNombreVia('');
                          setShowViaModal(true);
                        }}
                        className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Agregar Vía
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full bg-white">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {viasAdministracion.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center py-8 text-gray-400">No hay vías de administración registradas.</td>
                            </tr>
                          ) : (
                            viasAdministracion.map((via) => (
                              <tr key={via.id} className="hover:bg-gray-50 transition">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{via.nombre}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    via.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {via.activo ? 'Activo' : 'Inactivo'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                                  <button
                                    onClick={() => {
                                      setViaEditando(via);
                                      setNombreVia(via.nombre);
                                      setShowViaModal(true);
                                    }}
                                    className="px-3 py-1 rounded-md text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActionType('deleteVia');
                                      setViaEditando(via);
                                      setShowConfirmModal(true);
                                    }}
                                    className={`px-3 py-1 rounded-md text-sm ${
                                      via.activo 
                                        ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                                    }`}
                                  >
                                    {via.activo ? 'Desactivar' : 'Activar'}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 z-50">
          <div className="bg-white p-6 rounded-md shadow-md w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Asignar Clave a {selectedDoctor?.name}</h2>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 rounded-md mb-4 focus:outline-none focus:ring focus:ring-blue-300"
              placeholder="Ingrese la clave manualmente"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleKeySubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Guardar Clave
              </button>
            </div>
          </div>
        </div>
      )}
      {showConfirmModal && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={async () => {
            if (actionType === 'reject') {
              await rechazarDoctor(doctorToReject);
            } else if (actionType === 'deactivate') {
              await darDeBajaDoctor(doctorToReject);
            } else if (actionType === 'deactivatePatient') {
              await darDeBajaPaciente(pacienteToAction);
            } else if (actionType === 'deleteEspecialidad') {
              await toggleEspecialidad(especialidadEditando);
            } else if (actionType === 'deleteVia') {
              await toggleViaAdministracion(viaEditando);
            }
            setShowConfirmModal(false);
            setDoctorToReject(null);
            setPacienteToAction(null);
            setEspecialidadEditando(null);
            setViaEditando(null);
            setActionType('');
          }}
          title={
            actionType === 'reject' ? "Confirmar rechazo" :
            actionType === 'deactivate' ? "Confirmar baja" :
            actionType === 'deactivatePatient' ? "Confirmar baja de paciente" :
            actionType === 'deleteEspecialidad' ? `Confirmar ${especialidadEditando?.activo ? 'desactivación' : 'activación'}` :
            actionType === 'deleteVia' ? `Confirmar ${viaEditando?.activo ? 'desactivación' : 'activación'}` : ""
          }
          message={
            actionType === 'reject' ? "¿Está seguro de que desea rechazar este doctor? Esta acción no se puede deshacer." :
            actionType === 'deactivate' ? "¿Está seguro de que desea dar de baja este doctor? Esta acción cambiará su estado a inactivo." :
            actionType === 'deactivatePatient' ? "¿Está seguro de que desea dar de baja este paciente? Esta acción cambiará su estado a inactivo." :
            actionType === 'deleteEspecialidad' ? `¿Está seguro de que desea ${especialidadEditando?.activo ? 'desactivar' : 'activar'} esta especialidad?` :
            actionType === 'deleteVia' ? `¿Está seguro de que desea ${viaEditando?.activo ? 'desactivar' : 'activar'} esta vía de administración?` : ""
          }
          confirmText={
            actionType === 'reject' ? "Rechazar" :
            actionType === 'deactivate' ? "Dar de baja" :
            actionType === 'deactivatePatient' ? "Dar de baja" :
            actionType === 'deleteEspecialidad' ? (especialidadEditando?.activo ? 'Desactivar' : 'Activar') :
            actionType === 'deleteVia' ? (viaEditando?.activo ? 'Desactivar' : 'Activar') : ""
          }
          cancelText="Cancelar"
        />
      )}
      
      {showEspecialidadModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {especialidadEditando ? 'Editar Especialidad' : 'Agregar Especialidad'}
            </h2>
            <input
              type="text"
              value={nombreEspecialidad}
              onChange={(e) => setNombreEspecialidad(e.target.value)}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg mb-4  focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Nombre de la especialidad"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEspecialidadModal(false);
                  setEspecialidadEditando(null);
                  setNombreEspecialidad('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEspecialidad}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {especialidadEditando ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViaModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {viaEditando ? 'Editar Vía de Administración' : 'Agregar Vía de Administración'}
            </h2>
            <input
              type="text"
              value={nombreVia}
              onChange={(e) => setNombreVia(e.target.value)}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre de la vía de administración"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowViaModal(false);
                  setViaEditando(null);
                  setNombreVia('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={guardarViaAdministracion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {viaEditando ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
};

export default UserManagement;
