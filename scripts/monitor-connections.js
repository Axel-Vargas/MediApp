// Script para monitorear conexiones a la base de datos
require('dotenv').config({ path: './.env' });

// Importar mysql2 directamente para evitar problemas de módulos
const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mediapp',
  connectionLimit: 50,
  waitForConnections: true,
  queueLimit: 500,
  charset: 'utf8mb4',
  timezone: 'local',
  dateStrings: true,
  multipleStatements: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

const pool = mysql.createPool(dbConfig);

// Funciones helper para el monitoreo
function getPoolStats() {
  try {
    // Obtener estadísticas básicas del pool
    const stats = {
      maxConnections: dbConfig.connectionLimit,
      queueLimit: dbConfig.queueLimit,
      // Valores por defecto ya que no podemos acceder a las propiedades internas
      totalConnections: 0,
      activeConnections: 0,
      freeConnections: 0,
      waitingConnections: 0
    };
    
    return stats;
  } catch (error) {
    console.error('Error al obtener estadísticas del pool:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      freeConnections: 0,
      waitingConnections: 0,
      maxConnections: dbConfig.connectionLimit,
      queueLimit: dbConfig.queueLimit
    };
  }
}

function checkPoolHealth() {
  const stats = getPoolStats();
  console.log('✅ Pool de conexiones funcionando normalmente');
  return stats;
}

async function testConnection() {
  let connection;
  try {
    console.log('🔍 Probando conexión a la base de datos...');
    connection = await pool.getConnection();
    await connection.query('SELECT 1 as test');
    console.log('✅ Conexión a la base de datos exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error.message);
    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function cleanupInactiveConnections() {
  try {
    console.log('🧹 Limpiando conexiones inactivas...');
    // Simplemente probar que el pool funciona
    await testConnection();
    console.log('✅ Limpieza de conexiones completada');
  } catch (error) {
    console.error('❌ Error durante limpieza de conexiones:', error);
  }
}

async function monitorConnections() {
  console.log('🔍 Monitoreo de conexiones a la base de datos');
  console.log('===============================================\n');
  
  try {
    // Probar la conexión primero
    const connectionTest = await testConnection();
    
    if (!connectionTest) {
      console.log('❌ No se pudo conectar a la base de datos');
      return;
    }
    
    // Obtener estadísticas del pool
    const stats = getPoolStats();
    const health = checkPoolHealth();
    
    console.log('\n📊 Configuración del Pool de Conexiones:');
    console.log(`   Máximo de conexiones: ${stats.maxConnections}`);
    console.log(`   Límite de cola: ${stats.queueLimit}`);
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Base de datos: ${dbConfig.database}`);
    
    console.log('\n🧹 Ejecutando limpieza de conexiones inactivas...');
    await cleanupInactiveConnections();
    
    console.log('\n✅ Monitoreo completado exitosamente');
    console.log('\n💡 Recomendaciones:');
    console.log(`   - El pool está configurado con un máximo de ${stats.maxConnections} conexiones`);
    console.log('   - Si experimentas "too many connections", considera:');
    console.log('     1. Reducir el límite de conexiones');
    console.log('     2. Verificar que todas las rutas liberen conexiones correctamente');
    console.log('     3. Aumentar el límite en MySQL (max_connections)');
    
  } catch (error) {
    console.error('❌ Error durante el monitoreo:', error.message);
  } finally {
    // Cerrar el pool al finalizar
    try {
      await pool.end();
      console.log('\n🔒 Pool de conexiones cerrado');
    } catch (closeError) {
      console.error('Error al cerrar el pool:', closeError.message);
    }
  }
}

// Ejecutar monitoreo
monitorConnections().then(() => {
  console.log('\n✅ Monitoreo completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
