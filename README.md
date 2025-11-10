# MediApp - Plataforma de Gestión Médica

MediApp es una aplicación web moderna desarrollada con Next.js que facilita el monitoreo de medicamentos, historiales de pacientes y seguimiento de tratamientos.

## 🚀 Características Principales

- **Historial Clínico** - Acceso rápido al historial médico de los pacientes
- **Panel de Control** - Visualización de métricas y estadísticas en tiempo real
- **Interfaz Intuitiva** - Diseño moderno y fácil de usar
- **Responsive** - Funciona perfectamente en dispositivos móviles y de escritorio
- **Push Notifications** - Notificaciones push para recordatorios de medicación
- **Autenticación** - Sistema de autenticación para usuarios y profesionales
- **Asistente Virtual** - Chatbot para ayudar a los usuarios con sus consultas
- **Asignacion de medicamentos** - Sistema de asignacion de medicamentos

## 🛠️ Tecnologías Utilizadas

- **Framework**: Next.js 15 (App Router)
- **UI/Estilos**: Tailwind CSS 4, Heroicons, React Icons
- **Estado/Formularios**: React 19, React Hook Form, React Select
- **Base de Datos**: MySQL (mysql2/promise, pool de conexiones optimizado)
- **Tareas programadas**: node-cron (verificaciones y desactivaciones)
- **Notificaciones Push**: web-push (VAPID)
- **Utilidades**: dotenv, uuid, node-fetch
- **Asistente/Chat**: OpenRouter API (via endpoint `/api/chat`)
- **Email**: EmailJS (envío de correos desde el cliente)

## 📦 Requisitos Previos

- Node.js 18.0 o superior
- npm 9.0 o superior / yarn / pnpm
- MySQL 8.0 o superior

## 🚀 Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/medi-app.git
   cd medi-app
   ```

2. Instala las dependencias:
   ```bash
   npm install
   # o
   yarn
   # o
   pnpm install
   ```

3. Crea el archivo de entorno `.env` (recomendado: usa el script para generar claves VAPID):
   ```bash
   npm run generate-vapid
   # Esto creará/actualizará .env con VAPID y variables base de DB
   ```
   Luego, valida/ajusta valores en `.env` según tu entorno.

4. Crea la base de datos en MySQL (si no existe):
   ```sql
   CREATE DATABASE mediapp CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   ```
   Configura usuario/clave en `.env` y en `src/lib/db.js` si es necesario.

5. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   # o
   yarn dev
   # o
   pnpm dev
   ```

6. Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

## ⚙️ Variables de Entorno

Define en `.env` (valores de ejemplo):

```bash
# Asistente (OpenRouter API)
OPENAI_API_KEY=sk-...

# Notificaciones push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=TU_CLAVE_PUBLICA
VAPID_PRIVATE_KEY=TU_CLAVE_PRIVADA

# EmailJS (envío de correos)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=tu_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=tu_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=tu_public_key

# Cifrado de datos
DATA_KEY_HEX=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff

# (Opcional según tu entorno) Base de datos y URL base
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=mediapp
NEXTAUTH_URL=http://localhost:3000
```

Notas:
- El script `npm run generate-vapid` genera y escribe `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` automáticamente.
- `NEXTAUTH_URL` se usa como base para cron aunque no se use NextAuth.
- `DATA_KEY_HEX` debe ser una cadena hexadecimal de 64 caracteres (32 bytes) para AES-256-GCM.

## 📧 Envío de correos (EmailJS)

Este proyecto utiliza **EmailJS** para enviar correos desde el front-end sin servidor propio de correo.

- Variables requeridas:
  - `NEXT_PUBLIC_EMAILJS_SERVICE_ID`
  - `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`
  - `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`
- Flujo típico:
  1. Configura tu servicio y plantilla en https://www.emailjs.com.
  2. Copia los IDs y claves en el archivo `.env` (variables públicas con prefijo `NEXT_PUBLIC_`).
  3. Desde la UI, se invoca EmailJS para enviar correos según la plantilla configurada.

## 🧰 Scripts Disponibles

- `npm run dev` — Inicia el servidor de desarrollo.
- `npm run dev:with-cron` — Inicia dev con `ENABLE_CRON=true` (opcional).
- `npm run build` — Compila la app.
- `npm run start` — Inicia el servidor en producción.
- `npm run lint` — Linter.
- `npm run generate-vapid` — Genera claves VAPID y rellena `.env`.
- `npm run monitor-connections` — Diagnóstico del pool MySQL (CLI).
- `npm run health-check` — Consulta `/api/system/health` local.
- `node scripts/createAdmin.js` — Crea el usuario administrador por defecto.

## 🔁 Tareas Programadas (cron)

El servicio `src/lib/services/cronService.mjs` se inicializa desde `next.config.mjs` y ejecuta:
- Verificación de notificaciones cada minuto: `POST /api/notificaciones/enviar`.
- Desactivación de medicaciones finalizadas cada hora: `GET /api/medicaciones/desactivar-finalizadas`.

Logs de estado se imprimen en consola para diagnóstico.

## 🔔 Notificaciones Push

1) Genera claves VAPID: `npm run generate-vapid`.
2) Inicia la app y suscríbete a notificaciones desde la UI.
3) El cron llamará a `/api/notificaciones/enviar` para disparar recordatorios.

Endpoint de suscripción (desde el cliente): `POST /api/notificaciones/suscripcion`.

## 🧪 Endpoints Clave (API)

Algunos endpoints disponibles en `src/app/api`:
- `GET /api/system/health` — Estado del sistema y pool MySQL.
- `POST /api/notificaciones/enviar` — Enviar recordatorios push.
- `GET /api/medicaciones` y `POST /api/medicaciones` — Gestión de medicaciones.
- `POST /api/medicaciones/marcar-perdidas` — Marcar tomas perdidas.
- `GET /api/medicaciones/desactivar-finalizadas` — Desactivar tratamientos finalizados.
- `POST /api/chat` — Asistente/Chat (usa DB y OpenRouter según el mensaje).
- `POST /api/login` — Autenticación de usuarios.
- `GET /api/pacientes`, `GET /api/doctores`, `GET /api/especialidades`, etc.
- `POST /api/notificaciones/suscripcion` — Registra la suscripción Web Push del usuario.

Explora la carpeta `src/app/api` para ver todos los endpoints y sus parámetros.

## 🛡️ Base de Datos y Pool de Conexiones

- Configuración en `src/lib/db.js` con `mysql2/promise` y pool optimizado.
- Limpieza automática de conexiones inactivas y métricas de uso por consola.
- Herramienta CLI: `npm run monitor-connections` para diagnóstico rápido.

## 🧰 Pruebas Rápidas

- Ver salud del sistema: `npm run health-check`.
- Probar cron: observa logs al iniciar; puede invocar manualmente
  - `POST http://localhost:3000/api/notificaciones/enviar`
  - `GET  http://localhost:3000/api/medicaciones/desactivar-finalizadas`

## 👤 Creación de Administrador

Para crear un usuario administrador inicial (requiere `DATA_KEY_HEX` válido):

```bash
node scripts/createAdmin.js
```

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT.
