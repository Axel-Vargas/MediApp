/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    },
    webpack: (config, { isServer }) => {
        // Configuración para ignorar módulos específicos del lado del servidor
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                child_process: false,
                fs: false,
                net: false,
                tls: false,
                dns: false,
            };
        }
        return config;
    },
}

// Importar dinámicamente el servicio de cron
import('./src/lib/services/cronService.mjs').then(({ cronService }) => {
  console.log('🔄 Inicializando servicio de cron...');
  cronService.start();
}).catch(err => {
  console.error('Error al iniciar el servicio de cron:', err);
});

// Configuración de Next.js

export default nextConfig;
