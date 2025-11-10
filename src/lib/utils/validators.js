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
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
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
  
  const mobilePattern = /^09\d{8}$/;
  const landlinePattern = /^0[2-7]\d{7}$/;
  
  return mobilePattern.test(cleanPhone) || landlinePattern.test(cleanPhone);
};

/**
 * @param {string} phone
 * @returns {string}
 */
export const formatEcuadorianPhone = (phone) => {
  if (!phone) return '';
  
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  
  if (/^09\d{8}$/.test(cleanPhone)) {
    return `${cleanPhone.slice(0, 4)}-${cleanPhone.slice(4, 7)}-${cleanPhone.slice(7)}`;
  }
  
  if (/^0[2-7]\d{7}$/.test(cleanPhone)) {
    return `${cleanPhone.slice(0, 2)}-${cleanPhone.slice(2, 5)}-${cleanPhone.slice(5)}`;
  }
  
  return phone;
};
