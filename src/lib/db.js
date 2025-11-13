import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',  
  password: '',
  database: 'mediapp',
  connectionLimit: 10,          
  waitForConnections: true,      
  queueLimit: 0,                
  charset: 'utf8mb4',
  timezone: 'local',             
  dateStrings: true,             
  multipleStatements: false,     
  supportBigNumbers: true,       
  bigNumberStrings: true,        
  enableKeepAlive: true,         
  keepAliveInitialDelay: 10000,
  // Configuraciones de SSL
  // ssl: false,
};

const pool = mysql.createPool(dbConfig);

// Función helper para obtener conexión con manejo de errores mejorado
export const getConnection = async () => {
  try {
    const stats = getPoolStats();
    if (stats.activeConnections >= stats.maxConnections * 0.9) {
      console.warn('🚨 ADVERTENCIA: Pool de conexiones al 90% de capacidad', stats);
      await cleanupInactiveConnections();
    }
    
    const connection = await Promise.race([
      pool.getConnection(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout al obtener conexión')), 30000)
      )
    ]);
    
    await connection.query('SET SESSION sql_mode = "NO_ENGINE_SUBSTITUTION"');
    
    return connection;
  } catch (error) {
    console.error('❌ Error al obtener conexión de la base de datos:', error);
    
    if (error.code === 'ER_CON_COUNT_ERROR' || error.message?.includes('too many connections')) {
      console.log('🧹 Error: Too many connections. Intentando limpiar...');
      try {
        await cleanupInactiveConnections();
        await new Promise(resolve => setTimeout(resolve, 1000));
        const connection = await pool.getConnection();
        await connection.query('SET SESSION sql_mode = "NO_ENGINE_SUBSTITUTION"');
        return connection;
      } catch (retryError) {
        console.error('❌ Error al reintentar obtener conexión:', retryError);
        throw new Error('No se pudo obtener conexión después de limpiar. Por favor, intente más tarde.');
      }
    }
    
    throw error;
  }
};

// Función helper para liberar conexión de forma segura
export const releaseConnection = (connection) => {
  if (!connection) {
    return;
  }
  
  try {
    if (typeof connection.release === 'function') {
      connection.release();
    } else if (typeof connection.destroy === 'function') {
      connection.destroy();
    } else {
      console.warn('⚠️ Conexión no tiene método release ni destroy:', typeof connection);
    }
  } catch (error) {
    console.error('❌ Error al liberar conexión:', error);
    try {
      if (connection && typeof connection.destroy === 'function') {
        connection.destroy();
      }
    } catch (destroyError) {
      console.error('❌ Error al destruir conexión:', destroyError);
    }
  }
};

// Función para limpiar conexiones inactivas
export const cleanupInactiveConnections = async () => {
  try {
    const stats = getPoolStats();
    console.log('🧹 Limpiando conexiones inactivas...', stats);
    
    if (!pool) {
      console.log('⚠️ Pool no disponible para limpieza');
      return;
    }
    
    try {
      const poolInternal = pool.pool || pool;
      
      if (!poolInternal._freeConnections) {
        console.log('⚠️ No se pueden acceder a las conexiones libres, saltando limpieza manual');
        return;
      }
      
      const freeConnections = poolInternal._freeConnections;
      let cleanedCount = 0;
      
      if (Array.isArray(freeConnections)) {
        const now = Date.now();
        const inactiveThreshold = 5 * 60 * 1000; 
        
        for (let i = freeConnections.length - 1; i >= 0; i--) {
          const conn = freeConnections[i];
          if (conn) {
            try {
              const lastUsed = conn._lastUsed || conn.lastUsed;
              const isInactive = lastUsed && (now - lastUsed) > inactiveThreshold;
              
              if (isInactive || !conn.stream || conn.stream.destroyed) {
                try {
                  if (typeof conn.destroy === 'function') {
                    conn.destroy();
                  }
                  freeConnections.splice(i, 1);
                  cleanedCount++;
                } catch (e) {
                  console.warn('⚠️ Error al destruir conexión inactiva:', e.message);
                }
              }
            } catch (e) {
              console.warn('⚠️ Error al verificar conexión:', e.message);
            }
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`✅ Limpieza completada: ${cleanedCount} conexiones inactivas eliminadas`);
      } else {
        console.log('✅ Limpieza completada: no se encontraron conexiones inactivas para limpiar');
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

// Eventos del pool para monitoreo mejorado (solo en desarrollo para evitar logs excesivos)
if (process.env.NODE_ENV === 'development') {
  pool.on('connection', (connection) => {
    const stats = getPoolStats();
    if (stats.activeConnections >= stats.maxConnections * 0.8) {
      console.log('🔄 Nueva conexión establecida. Conexiones activas:', stats.activeConnections, '/', stats.maxConnections);
    }
  });

  pool.on('acquire', (connection) => {
    const stats = getPoolStats();
    if (stats.activeConnections >= stats.maxConnections * 0.7) {
      console.log('📥 Conexión adquirida. En uso:', stats.activeConnections, '/', stats.maxConnections);
      if (stats.activeConnections >= stats.maxConnections * 0.8) {
        console.warn('⚠️ Pool de conexiones al 80% de capacidad');
      }
    }
  });

  pool.on('release', (connection) => {
    const stats = getPoolStats();
    if (stats.activeConnections >= stats.maxConnections * 0.7) {
      console.log('📤 Conexión liberada. Disponibles:', stats.freeConnections, '/', stats.maxConnections);
    }
  });

  pool.on('enqueue', () => {
    const stats = getPoolStats();
    console.warn('⏳ Conexión en cola. En cola:', stats.waitingConnections, '- Esto indica que el pool está saturado');
  });
}

// Manejar errores de conexión del pool
pool.on('error', (error) => {
  console.error('❌ Error en el pool de conexiones:', error);
  if (error.code === 'ER_CON_COUNT_ERROR' || error.message?.includes('too many connections')) {
    console.error('🚨 ERROR CRÍTICO: Demasiadas conexiones. Limpiando...');
    cleanupInactiveConnections().catch(err => {
      console.error('❌ Error al limpiar conexiones:', err);
    });
  }
});

// Limpieza automática cada 5 minutos
setInterval(async () => {
  await cleanupInactiveConnections();
}, 5 * 60 * 1000); 

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
      maxConnections: dbConfig.connectionLimit || 10,
      queueLimit: dbConfig.queueLimit || 0
    };
    
    if (!pool) {
      return defaultStats;
    }
    
    try {
      const poolInternal = pool.pool || pool;
      
      let totalConnections = 0;
      let freeConnections = 0;
      let activeConnections = 0;
      let waitingConnections = 0;
      
      if (poolInternal._allConnections && Array.isArray(poolInternal._allConnections)) {
        totalConnections = poolInternal._allConnections.length;
      }
      
      if (poolInternal._freeConnections && Array.isArray(poolInternal._freeConnections)) {
        freeConnections = poolInternal._freeConnections.length;
      }
      
      activeConnections = Math.max(0, totalConnections - freeConnections);
      
      if (poolInternal._connectionQueue && Array.isArray(poolInternal._connectionQueue)) {
        waitingConnections = poolInternal._connectionQueue.length;
      }
      
      return {
        totalConnections,
        activeConnections,
        freeConnections,
        waitingConnections,
        maxConnections: dbConfig.connectionLimit || 10,
        queueLimit: dbConfig.queueLimit || 0
      };
    } catch (accessError) {
      console.warn('⚠️ No se pudieron obtener estadísticas detalladas del pool:', accessError.message);
      return defaultStats;
    }
  } catch (error) {
    console.error('❌ Error al obtener estadísticas del pool:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      freeConnections: 0,
      waitingConnections: 0,
      maxConnections: dbConfig.connectionLimit || 10,
      queueLimit: dbConfig.queueLimit || 0
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