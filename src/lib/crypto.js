import crypto from 'crypto';

// Claves desde variables de entorno.
const DATA_KEY_HEX = process.env.DATA_KEY_HEX || '';
let DATA_KEY = null;
try {
  if (DATA_KEY_HEX) {
    const keyBuf = Buffer.from(DATA_KEY_HEX, 'hex');
    if (keyBuf.length === 32) DATA_KEY = keyBuf;
  }
} catch (_) {}

export function isDataKeyConfigured() {
  return Boolean(DATA_KEY);
}

export function encryptAesGcm(value) {
  if (value == null || value === '') return { ct: null, iv: null, tag: null };
  if (!DATA_KEY) throw new Error('DATA_KEY_HEX no configurado o inválido');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DATA_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ct: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64')
  };
}

export function decryptAesGcm(ct, iv, tag) {
  if (!ct) return null;
  if (!DATA_KEY) throw new Error('DATA_KEY_HEX no configurado o inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', DATA_KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ct, 'base64')),
    decipher.final()
  ]);
  return plain.toString('utf8');
}

// Helper para mapear triple columna a valor plano
export function decryptTriple(row, baseName) {
  const ct = row?.[`${baseName}_ct`];
  const iv = row?.[`${baseName}_iv`];
  const tag = row?.[`${baseName}_tag`];
  if (!ct || !iv || !tag) return null;
  return decryptAesGcm(ct, iv, tag);
}

// Empaquetar a un único campo de texto: base64(iv).base64(ct).base64(tag)
export function encryptToPacked(value) {
  const { ct, iv, tag } = encryptAesGcm(value);
  if (!ct) return null;
  return `${iv}.${ct}.${tag}`;
}

export function decryptFromPacked(packed) {
  if (!packed) return null;
  const parts = String(packed).split('.');
  if (parts.length !== 3) return null;
  const [iv, ct, tag] = parts;
  return decryptAesGcm(ct, iv, tag);
}


