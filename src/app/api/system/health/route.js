import { NextResponse } from 'next/server';
import { getPoolStats, checkPoolHealth } from '@/lib/db';
import db from '@/lib/db';

// GET /api/system/health - Monitoreo de salud del sistema
export async function GET() {
  try {
    // Obtener estadísticas del pool de conexiones
    const poolStats = getPoolStats();
    const poolHealth = checkPoolHealth();
    
    // Verificar conexión a la base de datos
    let dbConnection = null;
    let dbStatus = 'unknown';
    
    try {
      dbConnection = await db.getConnection();
      await dbConnection.query('SELECT 1 as test');
      dbStatus = 'healthy';
    } catch (error) {
      dbStatus = 'unhealthy';
      console.error('Error al verificar conexión a la base de datos:', error);
    } finally {
      if (dbConnection) {
        try {
          dbConnection.release();
        } catch (releaseError) {
          console.error('Error al liberar conexión de prueba:', releaseError);
        }
      }
    }
    
    // Información del sistema
    const systemInfo = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    // Estado general del sistema
    const activeConnections = poolStats.activeConnections || 0;
    const maxConnections = poolStats.maxConnections || 20;
    const overallStatus = dbStatus === 'healthy' && 
                         activeConnections < maxConnections * 0.9 
                         ? 'healthy' : 'degraded';
    
    const response = {
      status: overallStatus,
      timestamp: systemInfo.timestamp,
      database: {
        status: dbStatus,
        pool: poolStats,
        health: poolHealth
      },
      system: systemInfo,
      recommendations: []
    };
    
    // Agregar recomendaciones basadas en el estado
    if (activeConnections > maxConnections * 0.8) {
      response.recommendations.push({
        level: 'warning',
        message: 'El pool de conexiones está cerca de su capacidad máxima',
        action: 'Considerar aumentar connectionLimit o revisar conexiones colgadas'
      });
    }
    
    if (poolStats.waitingConnections > 0) {
      response.recommendations.push({
        level: 'info',
        message: `Hay ${poolStats.waitingConnections} conexiones esperando`,
        action: 'Las conexiones están en cola, el sistema está funcionando normalmente'
      });
    }
    
    if (dbStatus === 'unhealthy') {
      response.recommendations.push({
        level: 'critical',
        message: 'La base de datos no responde correctamente',
        action: 'Verificar el estado del servidor MySQL y la conectividad'
      });
    }
    
    // Agregar métricas de rendimiento
    response.metrics = {
      poolUsage: ((poolStats.activeConnections / poolStats.maxConnections) * 100).toFixed(2) + '%',
      queueUsage: poolStats.waitingConnections > 0 ? 'active' : 'idle',
      connectionEfficiency: poolStats.freeConnections > 0 ? 'good' : 'limited'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[API] Error al obtener estado de salud del sistema:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      message: 'Error al verificar el estado del sistema'
    }, { status: 500 });
  }
}
