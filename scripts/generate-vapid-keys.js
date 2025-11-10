#!/usr/bin/env node

/**
 * Script para generar claves VAPID automáticamente
 * 
 * Uso:
 * node scripts/generate-vapid-keys.js
 */

const webPush = require('web-push');
const fs = require('fs');
const path = require('path');

async function generateVapidKeys() {
  try {
    console.log('🔑 Generando claves VAPID para notificaciones push...\n');
    
    // Generar claves VAPID
    const vapidKeys = webPush.generateVAPIDKeys();
    
    console.log('✅ Claves VAPID generadas exitosamente!');
    console.log('');
    console.log('📋 CLAVES GENERADAS:');
    console.log('=' .repeat(50));
    console.log(`Clave Pública:  ${vapidKeys.publicKey}`);
    console.log(`Clave Privada:  ${vapidKeys.privateKey}`);
    console.log('');
    
    // Crear o actualizar archivo .env
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = `# Claves VAPID para notificaciones push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}

# Configuración de la base de datos (ajusta según tu configuración)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=mediapp
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Archivo .env actualizado con las claves VAPID');
    console.log('');
    
    console.log('🎉 Configuración completada!');
    console.log('');
    console.log('📋 PRÓXIMOS PASOS:');
    console.log('1. Reinicia el servidor de desarrollo: npm run dev');
    console.log('2. Abre la aplicación en el navegador');
    console.log('3. Activa las notificaciones push');
    console.log('4. Ejecuta el diagnóstico: node scripts/diagnostico-notificaciones.js');
    console.log('');
    console.log('💡 Para probar las notificaciones:');
    console.log('   - Asigna una medicación a un paciente');
    console.log('   - Ejecuta: node scripts/enviarNotificaciones.js');
    
  } catch (error) {
    console.error('❌ Error generando claves VAPID:', error);
    process.exit(1);
  }
}

// Ejecutar el script
if (require.main === module) {
  generateVapidKeys()
    .then(() => {
      console.log('\n✅ Proceso completado exitosamente!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en el proceso:', error);
      process.exit(1);
    });
}

module.exports = { generateVapidKeys };
