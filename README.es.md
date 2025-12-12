# Ascencio Tax Inc. — API

API REST backend para el sistema de gestión de citas, clientes y servicios de Ascencio Tax Inc. Construida con **NestJS**, **PostgreSQL** y múltiples integraciones de terceros.

> **Nota:** Este es parte del monorepo de Ascencio Tax Inc. Para instrucciones generales de configuración, consulta el [README principal](../../README.md) en la raíz del repositorio.

## Descripción General

La API proporciona funcionalidad integral para:

- **Autenticación y Autorización** — Auth basado en JWT con control de acceso por roles
- **Gestión de Usuarios** — Perfiles de clientes y personal
- **Programación de Citas** — Reserva, reprogramación y cancelación
- **Integración de Calendario** — Sincronización con Google Calendar
- **Reuniones Virtuales** — Creación y gestión de reuniones Zoom
- **Almacenamiento de Archivos** — Integración con Cloudinary para documentos
- **Notificaciones por Email** — Emails automatizados para citas y verificaciones
- **Funciones de IA** — Integración con OpenAI para asistencia inteligente

## Stack Tecnológico

- **Framework:** NestJS (Node.js)
- **Base de Datos:** PostgreSQL con TypeORM
- **Autenticación:** JWT (JSON Web Tokens)
- **Validación:** class-validator, class-transformer
- **Versionado de API:** Basado en URI (v1)

## Inicio Rápido

### Requisitos Previos

Consulta el [README principal](../../README.md#prerequisites) para los requisitos del sistema.

### Ejecutar la API

Desde la **raíz del monorepo**:

```bash
# Ejecutar solo la API
npx turbo run dev --filter=@ascencio/api

# Ejecutar todas las apps (incluyendo API)
npm run dev
```

La API estará disponible en `http://localhost:3000` (configurable vía `API_PORT` en `.env`).

## Estructura del Proyecto

```
apps/api/
├── src/
│   ├── auth/              # Autenticación y autorización
│   ├── users/             # Gestión de usuarios
│   ├── appointments/      # Programación de citas
│   ├── services/          # Catálogo de servicios
│   ├── availability/      # Gestión de disponibilidad del personal
│   ├── calendar/          # Integración con Google Calendar
│   ├── zoom/              # Integración con Zoom API
│   ├── email/             # Servicio de email (Nodemailer/MailerSend)
│   ├── cloudinary/        # Servicio de almacenamiento de archivos
│   ├── openai/            # Integración con OpenAI
│   ├── common/            # Utilidades compartidas, guards, decoradores
│   ├── config/            # Módulos de configuración
│   ├── app.module.ts      # Módulo raíz de la aplicación
│   └── main.ts            # Punto de entrada de la aplicación
├── .env.example           # Plantilla de variables de entorno
├── package.json           # Dependencias y scripts
└── README.es.md           # Este archivo
```

## Variables de Entorno

La API requiere varias variables de entorno. Consulta [`.env.example`](./.env.example) para la lista completa.

### Configuración Principal

```env
# Servidor
API_PORT=3000
STAGE=dev

# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_NAME=ascencio_tax

# JWT
JWT_SECRET=tu_secreto_seguro_minimo_32_caracteres
JWT_EXPIRY=60m

# Configuración de Negocio
SLOT_STEP_MINUTES_DEFAULT=15
BUSINESS_TZ=America/Toronto
VERIFICATION_CODE_TTL=15
```

### Integraciones de Terceros

<details>
<summary><strong>Google Calendar API</strong></summary>

1. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilitar Google Calendar API
3. Crear una Service Account
4. Descargar el archivo JSON de credenciales
5. Compartir tu Google Calendar con el email de la service account (con permisos de edición)

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=calendar_id@group.calendar.google.com
```
</details>

<details>
<summary><strong>Zoom API</strong></summary>

1. Ir a [Zoom Marketplace](https://marketplace.zoom.us/)
2. Crear una app "Server-to-Server OAuth"
3. Obtener tus credenciales

```env
ZOOM_ACCOUNT_ID=tu_account_id
ZOOM_CLIENT_ID=tu_client_id
ZOOM_CLIENT_SECRET=tu_client_secret
```
</details>

<details>
<summary><strong>Cloudinary (Almacenamiento de Archivos)</strong></summary>

1. Crear cuenta en [Cloudinary](https://cloudinary.com/)
2. Obtener credenciales del dashboard

```env
CLOUDINARY_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```
</details>

<details>
<summary><strong>OpenAI API</strong></summary>

1. Crear cuenta en [OpenAI Platform](https://platform.openai.com/)
2. Generar una API key

```env
OPENAI_API_KEY=sk-proj-TU_API_KEY
```
</details>

<details>
<summary><strong>Servicio de Email</strong></summary>

**Opción 1: Gmail (Desarrollo)**
```env
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password
SENDER_NAME="Ascencio Tax Inc."
```

**Opción 2: MailerSend (Producción)**
```env
MAILERSEND_API_KEY=mlsn.TU_API_KEY
MAILERSEND_SENDER_EMAIL=noreply@tudominio.com
MAILERSEND_SENDER_NAME="Ascencio Tax Inc."
```
</details>

## Documentación de la API

### URL Base

```
http://localhost:3000/api
```

> **Nota:** La API usa versionado por URI. La versión actual es `v1`, por lo que los endpoints tienen el prefijo `/api/v1/`.

### Autenticación

La API usa autenticación JWT Bearer token:

```http
Authorization: Bearer <tu_jwt_token>
```

### Endpoints Principales

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/auth/sign-in` | POST | Inicio de sesión |
| `/auth/sign-up` | POST | Registro de usuario |
| `/users/me` | GET | Obtener perfil del usuario actual |
| `/appointments` | GET | Listar citas |
| `/appointments` | POST | Crear cita |
| `/services` | GET | Listar servicios disponibles |
| `/availability` | GET | Obtener disponibilidad del personal |

> **Tip:** Para documentación completa de la API, habilita Swagger en modo desarrollo (si está configurado).

## Base de Datos

### Datos de Prueba (Seed)

Para poblar la base de datos con datos de prueba:

```bash
# Vía curl
curl http://localhost:3000/api/seed

# O abrir en el navegador
http://localhost:3000/api/seed
```

### Migraciones

```bash
# Generar migración
npm run migration:generate --name=NombreMigracion

# Ejecutar migraciones
npm run migration:run

# Revertir migración
npm run migration:revert
```

## Desarrollo

### Scripts Disponibles

Desde el **directorio de la API** (`apps/api`):

```bash
# Desarrollo
npm run start:dev      # Iniciar con hot-reload
npm run start:debug    # Iniciar con debugger

# Build
npm run build          # Compilar TypeScript

# Testing
npm run test           # Tests unitarios
npm run test:watch     # Tests en modo watch
npm run test:cov       # Tests con cobertura
npm run test:e2e       # Tests end-to-end

# Linting
npm run lint           # Verificar código
npm run format         # Formatear con Prettier
```

### Usando Turborepo (Recomendado)

Desde la **raíz del monorepo**:

```bash
# Ejecutar API en desarrollo
npx turbo run dev --filter=@ascencio/api

# Build de la API
npx turbo run build --filter=@ascencio/api

# Ejecutar tests
npx turbo run test --filter=@ascencio/api
```

## Solución de Problemas

### Problemas de Conexión a la Base de Datos

```bash
# Verificar si PostgreSQL está corriendo
docker ps

# Ver logs de la base de datos
docker-compose logs postgres

# Verificar configuración de conexión en .env
```

### Puerto Ya en Uso

Cambiar `API_PORT` en `.env` o matar el proceso:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/macOS
lsof -ti:3000 | xargs kill
```

### Autenticación de Google Calendar

- Asegurar que la Service Account tenga acceso al calendario
- Mantener los caracteres `\n` en `GOOGLE_PRIVATE_KEY`
- Verificar que Google Calendar API esté habilitada en tu proyecto

## Mejores Prácticas de Seguridad

1. **Nunca commitear `.env`** — Siempre usa `.env.example` como plantilla
2. **Usar secretos fuertes** — Generar JWT_SECRET con:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Rotar credenciales** — Especialmente en producción
4. **Usar App Passwords** — Para Gmail, nunca usar tu contraseña principal
5. **Mantener dependencias actualizadas** — Ejecutar `npm audit` regularmente

## Despliegue en Producción

1. **Configurar variables de entorno de producción** en tu plataforma de hosting
2. **Construir la aplicación:**
   ```bash
   npm run build
   ```
3. **Ejecutar en modo producción:**
   ```bash
   npm run start:prod
   ```

### Plataformas Recomendadas

- **Railway** — Despliegue fácil con PostgreSQL
- **Heroku** — Opción PaaS clásica
- **AWS/GCP/Azure** — Control completo con servicios administrados
- **DigitalOcean App Platform** — Simple y asequible

### Checklist de Producción

- [ ] Configurar variables de entorno de forma segura (usar gestor de secretos)
- [ ] Habilitar HTTPS/SSL
- [ ] Configurar CORS apropiadamente
- [ ] Implementar rate limiting
- [ ] Configurar logging estructurado
- [ ] Configurar monitoreo y alertas
- [ ] Usar un gestor de procesos (PM2, systemd)
- [ ] Configurar backups de la base de datos

---

**Para configuración general del monorepo y guías de contribución, consulta el [README principal](../../README.md).**

## 📋 Tabla de Contenidos

- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Ejecución en Desarrollo](#-ejecución-en-desarrollo)
- [Base de Datos](#-base-de-datos)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Scripts Disponibles](#-scripts-disponibles)
- [Integraciones](#-integraciones)
- [Seguridad](#-seguridad)
- [Producción](#-producción)

## 🔧 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **[Node.js 20.x o superior](https://nodejs.org/)** - Runtime de JavaScript
- **[Yarn](https://yarnpkg.com/)** - Gestor de paquetes
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** - Para ejecutar PostgreSQL en contenedor
- **[NestJS CLI](https://docs.nestjs.com/cli/overview)** - Herramienta de línea de comandos

### Instalación de NestJS CLI

```bash
# Windows (ejecutar como administrador)
npm install -g @nestjs/cli

# Linux / macOS
sudo npm install -g @nestjs/cli
```

> **Nota:** En Windows es necesario ejecutar la terminal como administrador. En Linux/Mac usar `sudo`.

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/ayunierto/ascenciotaxincapi.git
cd ascenciotaxincapi
```

### 2. Instalar dependencias

```bash
yarn install
```

## ⚙️ Configuración

### 1. Configurar Variables de Entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
copy .env.example .env

# Windows (CMD)
copy .env.example .env
```

### 2. Configurar Variables Requeridas

Edita el archivo `.env` y configura al menos las siguientes variables:

#### **Configuración del Servidor**

```env
PORT=3000
STAGE=development
```

#### **Base de Datos**

```env
DB_URL=postgresql://postgres:tu_password_seguro@localhost:5432/ascencio_tax_db
DB_PASSWORD=tu_password_seguro
DB_NAME=ascencio_tax_db
```

#### **JWT (Authentication)**

```env
# Genera una clave segura con:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=tu_secreto_jwt_de_minimo_32_caracteres
JWT_EXPIRY=60m
```

#### **Email (Gmail con App Password)**

```env
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_de_gmail
SENDER_NAME="Ascencio Tax Inc."
```

> **Importante:** Usa un App Password de Gmail, no tu contraseña normal.
> [Crear App Password](https://support.google.com/accounts/answer/185833)

#### **Configuración de Negocio**

```env
SLOT_STEP_MINUTES_DEFAULT=15
BUSINESS_TZ=America/Toronto
VERIFICATION_CODE_TTL=15
```

### 3. Configurar Servicios Externos (Opcional)

#### **Cloudinary** (almacenamiento de archivos)

1. Crear cuenta en [Cloudinary](https://console.cloudinary.com/)
2. Obtener credenciales en el dashboard
3. Configurar en `.env`:

```env
CLOUDINARY_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

#### **Google Calendar API**

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un nuevo proyecto
3. Habilitar Google Calendar API
4. Crear Service Account en "IAM y Administración > Cuentas de servicio"
5. Descargar el archivo JSON de credenciales
6. Compartir tu calendario de Google con el email del Service Account (dar permisos de edición)
7. Configurar en `.env`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=tu_calendar_id@group.calendar.google.com
```

#### **Zoom API**

1. Ir a [Zoom Marketplace](https://marketplace.zoom.us/)
2. Crear una app "Server-to-Server OAuth"
3. Obtener credenciales
4. Configurar en `.env`:

```env
ZOOM_ACCOUNT_ID=tu_account_id
ZOOM_CLIENT_ID=tu_client_id
ZOOM_CLIENT_SECRET=tu_client_secret
```

#### **OpenAI API**

1. Crear cuenta en [OpenAI Platform](https://platform.openai.com/)
2. Generar API Key
3. Configurar en `.env`:

```env
OPENAI_API_KEY=sk-proj-TU_API_KEY_AQUI
```

## 💾 Base de Datos

### Iniciar PostgreSQL con Docker

```bash
# Iniciar contenedor en segundo plano
docker-compose up -d

# Ver logs del contenedor
docker-compose logs -f

# Detener contenedor
docker-compose down

# Detener y eliminar datos
docker-compose down -v
```

### Ejecutar Seed (Datos de Prueba)

Una vez que la aplicación esté corriendo:

```bash
# Opción 1: Mediante endpoint
curl http://localhost:3000/api/seed

# Opción 2: Abrir en navegador
http://localhost:3000/api/seed
```

## 🏃 Ejecución en Desarrollo

### Modo de Desarrollo (con hot-reload)

```bash
# Iniciar en modo watch (recomendado para desarrollo)
yarn start:dev

# La API estará disponible en:
# http://localhost:3000
```

### Otros Modos de Ejecución

```bash
# Modo desarrollo (sin watch)
yarn start

# Modo debug (con inspector de Node.js)
yarn start:debug

# Modo producción
yarn build
yarn start:prod
```

## 📁 Estructura del Proyecto

```
ascencio-tax-inc-api/
├── src/
│   ├── auth/              # Módulo de autenticación
│   ├── users/             # Módulo de usuarios
│   ├── appointments/      # Módulo de citas
│   ├── calendar/          # Integración Google Calendar
│   ├── zoom/              # Integración Zoom
│   ├── email/             # Servicio de emails
│   ├── cloudinary/        # Servicio de almacenamiento
│   ├── common/            # Utilidades comunes
│   ├── config/            # Configuración de la app
│   └── main.ts            # Punto de entrada
├── .env                   # Variables de entorno (NO COMMITEAR)
├── .env.example           # Plantilla de variables
├── docker-compose.yml     # Configuración de Docker
├── package.json           # Dependencias del proyecto
└── README.md              # Este archivo
```

## 📜 Scripts Disponibles

```bash
# Desarrollo
yarn start:dev          # Iniciar con hot-reload
yarn start:debug        # Iniciar con debugger

# Testing
yarn test               # Ejecutar tests unitarios
yarn test:watch         # Tests en modo watch
yarn test:cov           # Tests con cobertura
yarn test:e2e           # Tests end-to-end

# Build
yarn build              # Compilar para producción
yarn start:prod         # Ejecutar build de producción

# Linting
yarn lint               # Verificar código
yarn format             # Formatear código con Prettier
```

## 🔗 Integraciones

Este proyecto integra los siguientes servicios:

| Servicio                | Propósito                       | Documentación                                           |
| ----------------------- | ------------------------------- | ------------------------------------------------------- |
| **PostgreSQL**          | Base de datos relacional        | [Docs](https://www.postgresql.org/docs/)                |
| **Google Calendar API** | Gestión de citas y eventos      | [Docs](https://developers.google.com/calendar)          |
| **Zoom API**            | Creación de reuniones virtuales | [Docs](https://marketplace.zoom.us/docs/api-reference/) |
| **Cloudinary**          | Almacenamiento de archivos      | [Docs](https://cloudinary.com/documentation)            |
| **OpenAI API**          | Inteligencia artificial         | [Docs](https://platform.openai.com/docs)                |
| **Nodemailer**          | Envío de emails                 | [Docs](https://nodemailer.com/)                         |

## 🔒 Seguridad

### Mejores Prácticas

1. **NUNCA** commites el archivo `.env` al repositorio
2. Usa contraseñas fuertes y únicas para cada servicio
3. Rota las credenciales regularmente, especialmente en producción
4. Usa App Passwords para Gmail, no tu contraseña principal
5. Genera un JWT_SECRET aleatorio de al menos 32 caracteres
6. Mantén actualizadas las dependencias:
   ```bash
   yarn upgrade-interactive --latest
   ```

### Generar Secreto JWT Seguro

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variables de Entorno por Ambiente

Para diferentes ambientes, crea archivos separados:

```
.env.development
.env.production
.env.test
```

Y carga el apropiado según el ambiente.

## 🚀 Producción

### Preparar para Producción

1. **Configurar variables de producción** en `.env` o usar un gestor de secretos
2. **Compilar el proyecto:**
   ```bash
   yarn build
   ```
3. **Ejecutar en modo producción:**
   ```bash
   yarn start:prod
   ```

### Recomendaciones para Deploy

- Usa servicios como **AWS Secrets Manager**, **Azure Key Vault**, o **Google Secret Manager** para gestionar secretos
- Configura variables de entorno en tu plataforma de hosting (Railway, Heroku, AWS, etc.)
- Usa **PM2** o similar para process management
- Implementa rate limiting y CORS apropiadamente
- Configura logs estructurados
- Habilita HTTPS/SSL

## 📝 Notas Adicionales

- La API usa autenticación JWT via Bearer Token
- Los endpoints están documentados con Swagger (si está habilitado)
- El timezone por defecto es `America/Toronto` pero se puede cambiar en `.env`
- Los slots de citas por defecto son de 15 minutos

## 🆘 Troubleshooting

### Error al conectar con la base de datos

- Verifica que Docker esté corriendo: `docker ps`
- Revisa los logs: `docker-compose logs`
- Verifica las credenciales en `.env`

### Error de autenticación con Google Calendar

- Verifica que el Service Account tenga acceso al calendario
- Asegúrate de mantener los `\n` en la GOOGLE_PRIVATE_KEY
- Verifica que la API de Google Calendar esté habilitada en tu proyecto

### Puerto ya en uso

- Cambia el `PORT` en `.env`
- O mata el proceso que usa el puerto:

  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F

  # Linux/Mac
  lsof -ti:3000 | xargs kill
  ```

---

**Desarrollado con ❤️ para Ascencio Tax Inc.**
