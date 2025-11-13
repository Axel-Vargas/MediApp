/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    },
    // Configuración de producción
    productionBrowserSourceMaps: false,
    webpack: (config, { isServer }) => {
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


export default nextConfig;
