// Cargar variables de entorno
require('dotenv').config({ path: './.env' });

// Importar la configuración de la base de datos desde el proyecto
const { executeQuery } = require('../src/lib/db.js');
const bcrypt = require('bcryptjs');

// Función para cifrar datos (similar a la de tu aplicación)
async function encryptData(value) {
  if (!value) return null;
  
  const crypto = require('crypto');
  const key = Buffer.from(process.env.DATA_KEY_HEX || '', 'hex');
  
  if (key.length !== 32) {
    console.error('❌ ERROR: DATA_KEY_HEX no está configurado correctamente en el archivo .env');
    console.error('Debe ser una cadena hexadecimal de 64 caracteres (32 bytes)');
    process.exit(1);
  }
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}.${ciphertext.toString('base64')}.${authTag.toString('base64')}`;
}

// Datos del administrador
const adminData = {
  nombre: 'Administrador',
  telefono: '1234567890',
  rol: 'admin',
  usuario: 'admin2025@',
  contrasena: 'admin2025@', // Será hasheada
  correo: 'admin@gmail.com',
  notiWebPush: 1,
  notiWhatsapp: 0
};

async function createAdmin() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    
    // Verificar si ya existe un administrador con este usuario
    const existing = await executeQuery(
      'SELECT id FROM usuarios WHERE usuario = ?', 
      [adminData.usuario]
    );
    
    if (existing.length > 0) {
      console.log('ℹ️ Ya existe un administrador con este nombre de usuario');
      console.log('Usuario: admin2025@');
      console.log('Contraseña: admin2025@');
      return;
    }
    
    console.log('🔒 Cifrando datos...');
    
    // Cifrar los datos
    const [
      nombreCifrado,
      telefonoCifrado,
      correoCifrado,
      usuarioCifrado
    ] = await Promise.all([
      encryptData(adminData.nombre),
      encryptData(adminData.telefono),
      encryptData(adminData.correo),
      encryptData(adminData.usuario)
    ]);
    
    // Hashear la contraseña
    console.log('🔑 Hasheando contraseña...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.contrasena, salt);
    
    // Insertar el administrador
    console.log('📝 Insertando administrador en la base de datos...');
    const result = await executeQuery(
      `INSERT INTO usuarios (
        nombre, telefono, rol, usuario, contrasena, correo, 
        fechaRegistro, politicaAceptada, politicaFecha, 
        terminosAceptados, terminosFecha, notiWebPush, notiWhatsapp
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1, NOW(), 1, NOW(), 1, 0)`,
      [
        nombreCifrado,
        telefonoCifrado,
        adminData.rol,
        usuarioCifrado,
        hashedPassword,
        correoCifrado
      ]
    );
    
    console.log('✅ Administrador creado exitosamente');
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Usuario: admin2025@');
    console.log('   Contraseña: admin2025@\n');
    
  } catch (error) {
    console.error('❌ Error al crear el administrador:', error.message);
    if (error.sqlMessage) {
      console.error('Error de MySQL:', error.sqlMessage);
    }
  }
}

// Ejecutar la función
createAdmin().then(() => process.exit(0));
