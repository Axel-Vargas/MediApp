import cron from 'node-cron';
import fetch from 'node-fetch';

class CronService {
  constructor() {
    this.notificacionesJob = null;
    this.desactivacionJob = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Cron job is already running');
      return;
    }

    console.log('Starting cron jobs...');
    
    // Programar verificación de notificaciones cada minuto
    this.notificacionesJob = cron.schedule('* * * * *', async () => {
      const startTime = new Date();
      
      try {
        const url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notificaciones/enviar`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        
        const result = await response.json();
        const endTime = new Date();
        const duration = endTime - startTime;
        
        console.log(`✅ Verificación de notificaciones completada en ${duration}ms`);
        console.log('Resultado:', JSON.stringify(result, null, 2));
        
      } catch (error) {
        console.error('❌ Error en verificación de notificaciones:', error);
      }
    });
    
    // Programar desactivación de medicaciones finalizadas cada hora
    this.desactivacionJob = cron.schedule('0 * * * *', async () => {
      const startTime = new Date();
      console.log(`[${startTime.toISOString()}] 🔄 Iniciando desactivación de medicaciones finalizadas...`);
      
      try {
        const url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/medicaciones/desactivar-finalizadas`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        
        const result = await response.json();
        const endTime = new Date();
        const duration = endTime - startTime;
        
        console.log(`✅ Desactivación de medicaciones completada en ${duration}ms`);
        console.log('Resultado:', JSON.stringify(result, null, 2));
        
      } catch (error) {
        console.error('❌ Error en desactivación de medicaciones:', error);
      }
    });

    this.isRunning = true;
    console.log('Cron jobs started successfully (notificaciones cada minuto, desactivación cada hora)');
  }

  stop() {
    if (this.notificacionesJob) {
      this.notificacionesJob.stop();
      console.log('Notificaciones cron job stopped');
    }
    if (this.desactivacionJob) {
      this.desactivacionJob.stop();
      console.log('Desactivación cron job stopped');
    }
    this.isRunning = false;
    console.log('All cron jobs stopped');
  }
}

const cronService = new CronService();
export { cronService };
