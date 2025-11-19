// Patrones comunes de inyección SQL y XSS
const SQL_INJECTION_PATTERNS = [
  /(['";])/g,
  /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|SELECT|UPDATE|UNION( +ALL){0,1})\b)/gi,
  /(\b(OR|AND)\s+\d+=\d+\b)/gi,  
  /(--|#|\/\*[\s\S]*?\*\/|;)/g,  
  /(\b(DECLARE|EXEC(UTE){0,1}|EXECUTE\s+SP_|XP_|SHUTDOWN|TRUNCATE)\b)/gi,  
  /(\b(WAITFOR|DELAY|SLEEP|BENCHMARK)\s*\([^)]*\))/gi,
];

// Patrones de XSS y HTML peligroso
const XSS_PATTERNS = [
  /<\s*\/?\w+[^>]*>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /javascript\s*:/gi,
  /expression\s*\(/gi,
  /style\s*=\s*["'][^"']*(expression|url\s*\(|@import)[^"']*["']/gi,
];

/**
 * @param {string} input 
 * @param {Object} options
 * @param {boolean} [options.allowSpaces=true]
 * @param {boolean} [options.allowSpecialChars=false] 
 * @returns {string} 
 */
export const sanitizeInput = (input, { allowSpaces = true, allowSpecialChars = false, preserveTrailingSpaces = false } = {}) => {
  if (input === null || input === undefined) return '';
  
  let result = String(input);
  
  // Aplicar patrones de limpieza
  const patterns = [...SQL_INJECTION_PATTERNS, ...XSS_PATTERNS];
  
  patterns.forEach(pattern => {
    result = result.replace(pattern, '');
    pattern.lastIndex = 0; 
  });
  
  // Eliminar espacios en blanco si no están permitidos
  if (!allowSpaces) {
    result = result.replace(/\s+/g, '');
  }
  
  // Eliminar caracteres especiales si no están permitidos
  if (!allowSpecialChars) {
    result = result.replace(/[^\w\s@.-]/gi, '');
  }
  
  // Evitar recortar espacios finales si se requiere preservarlos
  if (preserveTrailingSpaces) {
    return result;
  }
  return result.trim();
};

/**
 * @param {string} input 
 * @returns {boolean} 
 */
export const validateInput = (input) => {
  if (input === null || input === undefined) return false;
  
  const strInput = String(input);
  
  if (strInput.trim() === '') return true;
  
  for (const pattern of SQL_INJECTION_PATTERNS) {
    const hasMatch = pattern.test(strInput);
    pattern.lastIndex = 0; 
    
    if (hasMatch) {
      console.warn('Posible intento de inyección SQL detectado:', strInput);
      return false;
    }
  }
  
  // Verificar patrones XSS
  for (const pattern of XSS_PATTERNS) {
    const hasMatch = pattern.test(strInput);
    pattern.lastIndex = 0; 
    
    if (hasMatch) {
      console.warn('Posible intento de XSS detectado:', strInput);
      return false;
    }
  }
  
  return true;
};

/**
 * @param {string} email
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  if (!email) return false;
  
  const emailStr = String(email).trim().toLowerCase();
  
  // Verificar longitud mínima y máxima
  if (emailStr.length < 5 || emailStr.length > 254) {
    return false;
  }
  
  // Verificar que no tenga espacios
  if (/\s/.test(emailStr)) {
    return false;
  }
  
  // Verificar formato básico: debe tener @ y al menos un punto después del @
  if (!emailStr.includes('@')) {
    return false;
  }
  
  const parts = emailStr.split('@');
  
  // Debe tener exactamente una @
  if (parts.length !== 2) {
    return false;
  }
  
  const [localPart, domain] = parts;
  
  // Validar parte local (antes del @)
  if (!localPart || localPart.length === 0 || localPart.length > 64) {
    return false;
  }
  
  // La parte local no puede empezar o terminar con punto
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return false;
  }
  
  // No puede tener puntos consecutivos
  if (localPart.includes('..')) {
    return false;
  }
  
  // Validar caracteres permitidos en la parte local
  // Permitir: letras, números, puntos, guiones, guiones bajos, y el símbolo +
  const localPartRegex = /^[a-z0-9._+-]+$/;
  if (!localPartRegex.test(localPart)) {
    return false;
  }
  
  // Validar dominio (después del @)
  if (!domain || domain.length === 0 || domain.length > 253) {
    return false;
  }
  
  // El dominio debe tener al menos un punto
  if (!domain.includes('.')) {
    return false;
  }
  
  // El dominio no puede empezar o terminar con punto o guión
  if (domain.startsWith('.') || domain.endsWith('.') || 
      domain.startsWith('-') || domain.endsWith('-')) {
    return false;
  }
  
  // No puede tener puntos consecutivos en el dominio
  if (domain.includes('..')) {
    return false;
  }
  
  // Validar que el dominio tenga una extensión válida (al menos 2 caracteres)
  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return false;
  }
  
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || tld.length > 63) {
    return false;
  }
  
  // La extensión (TLD) solo puede contener letras
  if (!/^[a-z]+$/.test(tld)) {
    return false;
  }
  
  // Validar cada parte del dominio
  for (const part of domainParts) {
    if (!part || part.length === 0 || part.length > 63) {
      return false;
    }
    
    // Cada parte no puede empezar o terminar con guión
    if (part.startsWith('-') || part.endsWith('-')) {
      return false;
    }
    
    // Cada parte solo puede contener letras, números y guiones
    if (!/^[a-z0-9-]+$/.test(part)) {
      return false;
    }
  }
  
  // Patrón final más estricto para validar el formato completo
  // Este regex es más estricto y valida el formato general
  const emailRegex = /^[a-z0-9]([a-z0-9._+-]*[a-z0-9])?@[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
  
  return emailRegex.test(emailStr);
};

/**
 * @param {string} phone 
 * @returns {boolean}
 */
export const validatePhone = (phone) => {
  if (!phone) return false;
  
  // Limpiar el número de espacios, guiones y paréntesis
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  
  // Verificar que solo contenga dígitos
  if (!/^\d+$/.test(cleanPhone)) {
    return false;
  }
  
  // Debe tener exactamente 10 dígitos
  if (cleanPhone.length !== 10) {
    return false;
  }
  
  // Solo validar números celulares: 09X XXXXXXX
  // Debe empezar con 09 y el tercer dígito debe ser entre 4-9 (operadoras: Movistar 098/099, Claro 097/096, CNT/Tuenti 095/094)
  const mobilePattern = /^09[4-9]\d{7}$/;
  
  // Verificar que no sea todo el mismo dígito (ej: 0000000000, 1111111111)
  if (/^(\d)\1{9}$/.test(cleanPhone)) {
    return false;
  }
  
  // Solo aceptar números celulares, no fijos
  return mobilePattern.test(cleanPhone);
};

/**
 * @param {string} phone
 * @returns {string}
 */
export const formatEcuadorianPhone = (phone) => {
  if (!phone) return '';
  
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  
  // Solo formatear números celulares: 09XX XXX XXX
  if (/^09[4-9]\d{7}$/.test(cleanPhone)) {
    return `${cleanPhone.slice(0, 4)}-${cleanPhone.slice(4, 7)}-${cleanPhone.slice(7)}`;
  }
  
  return phone;
};
