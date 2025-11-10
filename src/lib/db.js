import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',  
  password: '',
  database: 'mediapp',
  connectionLimit: 50,          
  waitForConnections: true,      
  queueLimit: 500,               
  // Configuraciones adicionales para estabilidad y escalabilidad
  charset: 'utf8mb4',
  timezone: 'local',             
  dateStrings: true,             
  // Configuraciones para múltiples conexiones simultáneas
  multipleStatements: false,     
  supportBigNumbers: true,       
  bigNumberStrings: true,        
  // Configuración de comportamiento de conexiones
  enableKeepAlive: true,         
  keepAliveInitialDelay: 10000, 
  // Configuraciones de SSL
  // ssl: false,
};

const pool = mysql.createPool(dbConfig);

// Función helper para obtener conexión con manejo de errores mejorado
export const getConnection = async () => {
  try {
    // Verificar el estado del pool antes de obtener conexión
    const stats = getPoolStats();
    if (stats.activeConnections >= stats.maxConnections * 0.9) {
      console.warn('🚨 ADVERTENCIA: Pool de conexiones al 90% de capacidad');
    }
    
    const connection = await pool.getConnection();
    
    // Configurar la conexión
    await connection.query('SET SESSION sql_mode = "NO_ENGINE_SUBSTITUTION"');
    // Usar la zona horaria local del servidor en lugar de forzar UTC
    // await connection.query('SET SESSION time_zone = "+00:00"');
    
    return connection;
  } catch (error) {
    console.error('❌ Error al obtener conexión de la base de datos:', error);
    
    if (error.code === 'ER_CON_COUNT_ERROR' || error.message.includes('too many connections')) {
      console.log('🧹 Intentando limpiar conexiones inactivas...');
      try {
        await pool.end();
        const newPool = mysql.createPool(dbConfig);
        Object.assign(pool, newPool);
        console.log('✅ Pool recreado exitosamente');
      } catch (cleanupError) {
        console.error('❌ Error al limpiar pool:', cleanupError);
      }
    }
    
    throw error;
  }
};

// Función helper para liberar conexión de forma segura
export const releaseConnection = (connection) => {
  if (connection && typeof connection.release === 'function') {
    try {
      connection.release();
      console.log('🔓 Conexión liberada correctamente');
    } catch (error) {
      console.error('❌ Error al liberar conexión:', error);
    }
  } else if (connection) {
    console.warn('⚠️ Conexión no válida para liberar:', typeof connection);
  }
};

// Función para limpiar conexiones inactivas
export const cleanupInactiveConnections = async () => {
  try {
    const stats = getPoolStats();
    console.log('🧹 Limpiando conexiones inactivas...', stats);
    
    if (!pool || !pool.pool) {
      console.log('⚠️ Pool no disponible para limpieza');
      return;
    }
    
    // Verificar que _freeConnections exista y sea iterable
    if (!pool.pool._freeConnections || typeof pool.pool._freeConnections !== 'object') {
      console.log('⚠️ _freeConnections no disponible, saltando limpieza manual');
      return;
    }
    
    // Intentar limpiar conexiones inactivas de forma segura
    try {
      const now = Date.now();
      const inactiveThreshold = 5 * 60 * 1000;
      
      // Verificar si _freeConnections tiene propiedades que podamos iterar
      const freeConnections = pool.pool._freeConnections;
      let cleanedCount = 0;
      
      // Si es un array, usar filter
      if (Array.isArray(freeConnections)) {
        const originalLength = freeConnections.length;
        pool.pool._freeConnections = freeConnections.filter(conn => {
          if (conn && conn._lastUsed && (now - conn._lastUsed) > inactiveThreshold) {
            try {
              conn.destroy();
              cleanedCount++;
              return false;
            } catch (e) {
              console.error('Error al destruir conexión inactiva:', e);
              return true;
            }
          }
          return true;
        });
      } else {   
        // Intentar acceder a las conexiones de otra manera
        if (freeConnections.length !== undefined) {
          // Si tiene propiedad length, intentar iterar
          for (let i = freeConnections.length - 1; i >= 0; i--) {
            const conn = freeConnections[i];
            if (conn && conn._lastUsed && (now - conn._lastUsed) > inactiveThreshold) {
              try {
                conn.destroy();
                cleanedCount++;
                if (freeConnections.splice) {
                  freeConnections.splice(i, 1);
                }
              } catch (e) {
                console.error('Error al destruir conexión inactiva:', e);
              }
            }
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`✅ Limpieza completada: ${cleanedCount} conexiones inactivas eliminadas`);
      } else {
        console.log('✅ Limpieza completada: no se encontraron conexiones inactivas');
      }
      
    } catch (cleanupError) {
      console.warn('⚠️ Error durante limpieza manual, continuando...', cleanupError.message);
    }
    
  } catch (error) {
    console.error('❌ Error durante limpieza de conexiones:', error);
  }
};

// Función helper para ejecutar consultas con manejo automático de conexiones
export const executeQuery = async (query, params = []) => {
  let connection;
  try {
    connection = await getConnection();
    const [results] = await connection.query(query, params);
    return results;
  } finally {
    releaseConnection(connection);
  }
};

// Función helper para ejecutar transacciones
export const executeTransaction = async (callback) => {
  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();
    
    const result = await callback(connection);
    
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al hacer rollback:', rollbackError);
      }
    }
    throw error;
  } finally {
    releaseConnection(connection);
  }
};

// Eventos del pool para monitoreo mejorado
pool.on('connection', (connection) => {
  console.log('🔄 Nueva conexión establecida. Conexiones activas:', pool.pool.length);
});

pool.on('acquire', (connection) => {
  const stats = getPoolStats();
  console.log('📥 Conexión adquirida. En uso:', stats.activeConnections, '/', stats.maxConnections);
  
  // Advertir si se acerca al límite
  if (stats.activeConnections >= stats.maxConnections * 0.8) {
    console.warn('⚠️ Pool de conexiones al 80% de capacidad');
  }
});

pool.on('release', (connection) => {
  const stats = getPoolStats();
  console.log('📤 Conexión liberada. Disponibles:', stats.freeConnections, '/', stats.maxConnections);
});

pool.on('enqueue', () => {
  const stats = getPoolStats();
  console.log('⏳ Conexión en cola. En cola:', stats.waitingConnections);
});

// Limpieza automática cada 5 minutos
setInterval(async () => {
  await cleanupInactiveConnections();
}, 5 * 60 * 1000); 

// Limpieza al iniciar la aplicación
setTimeout(async () => {
  await cleanupInactiveConnections();
}, 30000); 

// Función para obtener estadísticas del pool
export const getPoolStats = () => {
  try {
    const defaultStats = {
      totalConnections: 0,
      activeConnections: 0,
      freeConnections: 0,
      waitingConnections: 0,
      maxConnections: 20,
      queueLimit: 50
    };
    
    if (!pool || !pool.pool) {
      console.warn('Pool no disponible, usando valores por defecto');
      return defaultStats;
    }
    
    const totalConnections = pool.pool.length || 0;
    const freeConnections = pool.pool._freeConnections ? pool.pool._freeConnections.length : 0;
    const activeConnections = Math.max(0, totalConnections - freeConnections);
    const waitingConnections = pool.pool._connectionQueue ? pool.pool._connectionQueue.length : 0;
    
    return {
      totalConnections: totalConnections,
      activeConnections: activeConnections,
      freeConnections: freeConnections,
      waitingConnections: waitingConnections,
      maxConnections: pool.config ? pool.config.connectionLimit : 30,
      queueLimit: pool.config ? pool.config.queueLimit : 100
    };
  } catch (error) {
    console.error('Error al obtener estadísticas del pool:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      freeConnections: 0,
      waitingConnections: 0,
      maxConnections: 30,
      queueLimit: 100
    };
  }
};

// Función para verificar la salud del pool
export const checkPoolHealth = () => {
  const stats = getPoolStats();
  const usagePercentage = (stats.activeConnections / stats.maxConnections) * 100;
  
  if (usagePercentage > 90) {
    console.warn('🚨 ADVERTENCIA: Pool de conexiones al 90% de capacidad');
  } else if (usagePercentage > 70) {
    console.warn('🟡 ATENCIÓN: Pool de conexiones al 70% de capacidad');
  } else {
    console.log('✅ Pool de conexiones funcionando normalmente');
  }
  
  return stats;
};

export default pool;