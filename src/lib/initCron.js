import { cronService } from './services/cronService';

// Iniciar el servicio de cron cuando se importe este módulo
console.log('🔄 Inicializando servicio de cron...');
cronService.start();

export default cronService;
