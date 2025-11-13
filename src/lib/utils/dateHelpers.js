/**
 * Utilidades para manejo de fechas en la zona horaria local del servidor
 */

/**
 * Obtiene la fecha local del servidor en formato YYYY-MM-DD
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function obtenerFechaLocal() {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

/**
 * Convierte una fecha Date a formato YYYY-MM-DD usando la zona horaria local
 * @param {Date} fecha - Objeto Date a convertir
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function fechaLocalToString(fecha) {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

