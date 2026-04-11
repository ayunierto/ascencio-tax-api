# API de Ascencio Tax

API Backend para Ascencio Tax Inc - Una plataforma integral de gestión fiscal y reservas de citas.

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 20.x
- PostgreSQL 14+
- Docker (opcional, para despliegue en contenedores)

### Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar desarrollo
npm run dev
```

La API estará disponible en `http://localhost:3000`

## 🐳 Despliegue con Docker

### Construir y Ejecutar

```bash
# Construir imagen
docker build -t ascencio-api .

# Ejecutar contenedor
docker run -p 3000:3000 --env-file .env ascencio-api
```

### Usando Docker Compose

```bash
docker-compose up -d
```

## 📦 Estructura del Proyecto

```
src/
├── accounting/       # Seguimiento de gastos, reportes
├── appointments/     # Sistema de reservas
├── auth/            # Autenticación y autorización
├── bookings/        # Servicios, horarios, personal
├── calendar/        # Integración con Google Calendar
├── files/           # Carga de archivos (Cloudinary)
├── mail/            # Servicio de correo (Mailersend)
├── notification/    # Notificaciones de citas
├── openai/          # Funciones potenciadas por IA
├── seed/            # Datos iniciales de BD
└── zoom/            # Integración de videollamadas
```

## 🔑 Variables de Entorno

Crea un archivo `.env` con estas variables:

```env
# Servidor
PORT=3000
STAGE=prod

# Base de Datos (proporcionada automáticamente por Railway)
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=tu-secreto
JWT_EXPIRY=60m

# Email (Mailersend)
MAILERSEND_API_KEY=mlsn...
MAILERSEND_SENDER_EMAIL=support@ascenciotax.com

# Google OAuth (Login + Calendar)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
GOOGLE_CALENDAR_CALLBACK_URL=http://localhost:3000/calendar/oauth/callback

# Calendar OAuth y Webhooks
ENCRYPTION_KEY=...       # 64 caracteres hex
WEBHOOK_BASE_URL=...
API_URL=http://localhost:3000

# Cloudinary (Almacenamiento de Archivos)
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Zoom
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...

# OpenAI
OPENAI_API_KEY=sk-proj-...
```

## 📚 Documentación de la API

Una vez en ejecución, accede a la documentación Swagger en:

```
http://localhost:3000/api/docs
```

## 🛠️ Scripts Disponibles

```bash
npm run dev          # Iniciar servidor de desarrollo
npm run build        # Construir para producción
npm start            # Iniciar servidor de producción
npm run lint         # Ejecutar ESLint
npm run format       # Formatear código con Prettier
```

## 🗄️ Base de Datos

### Inicialización

La API usa TypeORM con `synchronize: true` en modo desarrollo para crear tablas automáticamente.

### Datos Iniciales

Poblar datos iniciales:

```bash
# Vía endpoint de la API
curl http://localhost:3000/api/seed

# O acceder desde el navegador
http://localhost:3000/api/seed
```

## 🚢 Despliegue

### Railway

1. Conectar repositorio de GitHub
2. Agregar servicio PostgreSQL
3. Configurar variables de entorno
4. Despliegue automático al hacer push

### Lista de Verificación para Producción

- ✅ `STAGE=prod` en entorno
- ✅ `DATABASE_URL` configurado
- ✅ Todas las API keys configuradas
- ✅ SSL habilitado (automático con Railway)
- ✅ `synchronize: false` (seguridad en producción)

## 🔗 Dependencias

### Core

- NestJS 10
- TypeORM 0.3.20
- PostgreSQL (pg)

### Integraciones

- API de Google Calendar
- API de Zoom
- API de OpenAI
- Mailersend
- Cloudinary

### Paquete Compartido

- `@ascencio/shared` - Tipos, esquemas, utilidades (desde GitHub)

## 📄 Licencia

Propietario - Ascencio Tax Inc © 2025
