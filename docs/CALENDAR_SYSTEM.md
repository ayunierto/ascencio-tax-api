# Sistema de Citas y Calendario — Documentación Técnica

> Base URL: `https://api.ascenciotax.com/api/v1` (prod) | `http://localhost:3000/api/v1` (dev)
> Autenticación: `Authorization: Bearer <JWT>` en todos los endpoints marcados con 🔐

---

## Tabla de Contenidos

1. [Arquitectura General](#arquitectura-general)
2. [Flujo de Disponibilidad y Citas](#flujo-de-disponibilidad-y-citas)
3. [Sistema de Calendarios](#sistema-de-calendarios)
4. [Lineamientos de Integración Frontend](#lineamientos-de-integración-frontend)
   - [App Móvil (React Native / Expo) — Clientes](#app-móvil---clientes)
   - [App Móvil — Staff Members](#app-móvil---staff-members)
   - [Panel de Administración (Web)](#panel-de-administración-web)
5. [Referencia de Endpoints](#referencia-de-endpoints)
6. [Gestión de Errores](#gestión-de-errores)
7. [Variables de Entorno](#variables-de-entorno)

---

## Arquitectura General

```
┌──────────────────────────────────────────────────────────────────┐
│                        ASCENCIO TAX API                          │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │ Appointments │   │  Availability    │   │ CalendarModule   │  │
│  │   Service    │──▶│    Service       │   │                  │  │
│  └──────────────┘   └──────────────────┘   │  ┌────────────┐  │  │
│         │                  │               │  │ Connection │  │  │
│         │          ┌───────▼──────────┐    │  │  Service   │  │  │
│         │          │  calendar_events │◀───┤  └────────────┘  │  │
│         │          │  (tabla local)   │    │  ┌────────────┐  │  │
│         └─────────▶│                  │    │  │ Provider   │  │  │
│                    └──────────────────┘    │  │  Factory   │  │  │
│                                            │  └────────────┘  │  │
│                                            └──────────────────┘  │
│                                                    │             │
│                              ┌─────────────────────▼────────┐    │
│                              │   ICalendarProvider (adapter)│    │
│                              ├──────────────────────────────┤    │
│                              │  GoogleCalendarAdapter       │    │
│                              │  (future: OutlookAdapter)    │    │
│                              └──────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
         │ Webhooks (tiempo real)
         ▼
   Google Calendar API
```

### Modelo de Fuentes de Calendario

| `ownerType` | `ownerId`       | Uso                                              |
| ----------- | --------------- | ------------------------------------------------ |
| `company`   | `'company'`     | Calendario principal del negocio (Wix + sistema) |
| `staff`     | `staffMemberId` | Calendarios personales de cada miembro del staff |
| `client`    | `userId`        | Calendarios de clientes (solo add-to-calendar)   |

### Flujo de Sincronización (Tiempo Real)

```
Google Calendar ──webhook PUSH──▶ POST /calendar/webhook/company
                                          │
                                          ▼
                                  getEventsSinceToken()
                                          │
                                          ▼
                               Upsert en calendar_events
                                  (con staffMemberId si "Staff: Nombre")
                                          │
                              ┌───────────▼────────────┐
                              │  staffMemberId = null   │ ← Evento empresa
                              │  bloquea TODOS los staff│
                              └─────────────────────────┘
```

---

## Flujo de Disponibilidad y Citas

### 1. Buscar disponibilidad

```
POST /api/v1/availability
Body: { serviceId, date, timeZone, staffId? }

Response: AvailableSlot[]
{
  startTimeUTC: "2026-04-10T14:00:00.000Z",
  endTimeUTC:   "2026-04-10T15:00:00.000Z",
  availableStaff: [ { id, firstName, lastName, ... } ]
}
```

**Cómo se calcula la disponibilidad:**

1. Para cada staff activo que ofrece el servicio ese día:
   - Genera intervalos base a partir de sus schedules (`dayOfWeek`, `startTime`, `endTime`)
   - Resta citas confirmadas y pendientes del día
   - Resta eventos de su calendario personal (si tiene conexión activa)
   - Resta eventos del calendario de empresa (incluyendo eventos sin staff = company-wide)
2. Genera slots del tamaño del servicio con paso de `slot_step_minutes` (configurable)
3. Consolida: un slot por inicio UTC con la lista de staff disponibles

**Importante para el frontend:** Los slots que devuelve el API ya están confirmados como
disponibles. NO hacer validación adicional en el cliente.

### 2. Crear cita

```
POST /api/v1/appointments   🔐 (cualquier rol)
Body: {
  serviceId, staffId, startTimeUTC, endTimeUTC,
  timeZone,   ← IANA, ej. "America/Toronto"
  comments?
}

startTimeUTC / endTimeUTC: ISO 8601 UTC  → "2026-04-10T14:00:00.000Z"
```

**El API valida:**

- Que `startTimeUTC`/`endTimeUTC` estén dentro del horario de trabajo del staff
- Que no haya solapamiento con otra cita (`pending` o `confirmed`)
- Que no haya evento en el calendario que solape

### 3. Ciclo de vida de una cita

```
pending ──(admin/staff confirma)──▶ confirmed ──(pasa la hora)──▶ completed
                                        │
                                        └──(cancelación ≥24h antes)──▶ cancelled
```

- `pending` → estado inicial si se crea desde la app
- `confirmed` → default si se crea desde admin o se confirma manualmente
- `completed` → asignado automáticamente por un Cron cada hora
- `cancelled` → vía `POST /appointments/:id/cancel` con `cancellationReason`

---

## Sistema de Calendarios

### Modelo `CalendarConnection`

```jsonc
{
  "id": "uuid",
  "ownerType": "company" | "staff" | "client",
  "ownerId": "company" | staffMemberId | userId,
  "provider": "google",        // extensible a "outlook", etc.
  "calendarId": "primary",     // ID del calendario elegido
  "calendarName": "My Calendar",
  "autoSync": true,
  "isActive": true,
  "webhookExpiry": "2026-04-15T00:00:00.000Z"
  // refreshToken es cifrado y no se expone en la API
}
```

### Endpoints de Conexión (resumen)

| Actor   | Acción             | Endpoint                                 |
| ------- | ------------------ | ---------------------------------------- |
| Admin   | Conectar empresa   | `GET /calendar/company/connect`          |
| Admin   | Ver conexiones     | `GET /calendar/company/connections`      |
| Admin   | Desconectar        | `DELETE /calendar/company/disconnect`    |
| Staff   | Conectar personal  | `GET /calendar/staff/connect`            |
| Staff   | Listar calendarios | `GET /calendar/staff/calendars`          |
| Staff   | Elegir calendario  | `PATCH /calendar/staff/:id/select`       |
| Staff   | Toggle auto-sync   | `PATCH /calendar/staff/:id/toggle`       |
| Staff   | Desconectar        | `DELETE /calendar/staff/:id`             |
| Cliente | Conectar personal  | `GET /calendar/client/connect`           |
| Cliente | Agregar cita       | `POST /appointments/:id/add-to-calendar` |
| Cliente | Desconectar        | `DELETE /calendar/client/:id`            |

---

## Lineamientos de Integración Frontend

---

### App Móvil — Clientes

#### Flujo de Booking (paso a paso)

```typescript
// 1. Obtener servicios disponibles
const services = await api.get('/services');

// 2. Obtener disponibilidad
const slots = await api.post('/availability', {
  serviceId: 'uuid',
  date: '2026-04-10', // YYYY-MM-DD
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  staffId: undefined, // omitir para "cualquier staff"
});
// Response: AvailableSlot[]

// 3. El usuario elige slot → mostrar availableStaff[]
//    Si hay varios staff → mostrar selector o elegir aleatoriamente
//    La app guarda: selectedSlot.startTimeUTC, selectedSlot.endTimeUTC, selectedStaff.id

// 4. Crear cita
const appointment = await api.post('/appointments', {
  serviceId: 'uuid',
  staffId: selectedStaff.id,
  start: selectedSlot.startTimeUTC,
  end: selectedSlot.endTimeUTC,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  comments: 'Opcional',
});
```

#### Mostrar Disponibilidad en UI

```typescript
// Agrupar slots por período del día (usar hora local del usuario)
const groupByPeriod = (slots: AvailableSlot[], tz: string) => {
  return slots.reduce(
    (acc, slot) => {
      const hour = DateTime.fromISO(slot.startTimeUTC).setZone(tz).hour;
      const period =
        hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      acc[period] = [...(acc[period] ?? []), slot];
      return acc;
    },
    {} as Record<string, AvailableSlot[]>,
  );
};

// Convertir UTC a hora local del usuario para mostrar
const displayTime = DateTime.fromISO(slot.startTimeUTC)
  .setZone(userTimeZone)
  .toFormat('h:mm a'); // "2:00 PM"
```

#### Conectar Google Calendar del Cliente (post-cita)

```typescript
// Después de crear la cita, preguntar si quiere agregarla a su calendario
// 1. Verificar si ya tiene calendario conectado
const connections = await api.get('/calendar/client/connections');

if (connections.length === 0) {
  // 2a. Conectar — abrir URL en WebBrowser (Expo)
  const { connectUrl } = await api.get('/calendar/client/connect');
  await WebBrowser.openAuthSessionAsync(connectUrl, callbackUrl);
  // El backend guarda el token y redirige; no necesitas hacer nada más
} else {
  // 2b. Ya tiene cuenta → agregar evento directamente
  await api.post(`/appointments/${appointmentId}/add-to-calendar`);
}
```

**Consideraciones de seguridad:**

- Usar `expo-auth-session` o `expo-web-browser` para el flujo OAuth
- Guardar el `appointmentId` antes de iniciar el flujo OAuth para retomarlo post-callback
- El token del cliente nunca se expone al frontend; el backend maneja toda la lógica

#### Verificación Futura de Conflictos (feature pendiente)

```typescript
// FUTURE: Check si el slot seleccionado está ocupado en el calendario del cliente
// Este endpoint estará disponible cuando se implemente la Fase 6.3
const conflict = await api.get('/calendar/client/check-slot', {
  params: { start: slot.startTimeUTC, end: slot.endTimeUTC },
});

if (conflict.hasConflict) {
  showModal('Tienes un evento en tu calendario en este horario. ¿Continuar?');
}
```

---

### App Móvil — Staff Members

#### Conectar Calendario Personal

El staff conecta su Google Calendar desde el perfil para que sus eventos personales
bloqueen automáticamente su disponibilidad.

```typescript
// 1. Ver estado de conexión
const connections = await api.get('/calendar/staff/connections');
// Response: CalendarConnection[]

// 2. Iniciar conexión OAuth
const { connectUrl } = await api.get('/calendar/staff/connect');
// Abrir en WebBrowser/AuthSession (scope: calendar.readonly)
await WebBrowser.openAuthSessionAsync(connectUrl, callbackRedirect);

// 3. Una vez conectado, listar calendarios disponibles en su cuenta
const calendars = await api.get('/calendar/staff/calendars');
// Response: [{ calendarId, name, primary, color }, ...]

// 4. Elegir cuál calendario usar para bloqueos de disponibilidad
await api.patch(`/calendar/staff/${connectionId}/select`, {
  calendarId: 'primary', // o el ID específico elegido
  calendarName: 'Mi agenda',
});

// 5. Activar/desactivar sync automático
await api.patch(`/calendar/staff/${connectionId}/toggle`, {
  autoSync: false,
});

// 6. Desconectar
await api.delete(`/calendar/staff/${connectionId}`);
```

#### Ver Mis Citas (staff)

```typescript
// Citas pendientes/confirmadas asignadas al staff
const upcoming = await api.get('/appointments/my-upcoming');
// Response: Appointment[] con status: 'pending' | 'confirmed'

// Historial
const history = await api.get('/appointments/my-history');
```

---

### Panel de Administración (Web)

#### Conectar Calendario de la Empresa

```typescript
// 1. Verificar si hay conexión activa de empresa
const connections = await api.get('/calendar/company/connections');

// 2. Conectar (redirige al flujo OAuth de Google)
// El admin es redirigido a la URL OAuth; al volver se guarda automáticamente
window.location.href = '/api/v1/calendar/company/connect';
// — O en SPA —
const { connectUrl } = await api.get('/calendar/company/connect');
router.push(`/oauth-redirect?url=${encodeURIComponent(connectUrl)}`);

// 3. Ver estado del webhook
// La conexión muestra: webhookExpiry, autoSync, calendarName

// 4. Desconectar
await api.delete('/calendar/company/disconnect');
```

#### Vista de Calendario Admin

```typescript
// Obtener eventos del calendario de empresa para renderizar en FullCalendar/react-big-calendar
const events = await api.get('/calendar/events', {
  params: {
    from: '2026-04-01T00:00:00.000Z',
    to: '2026-04-30T23:59:59.000Z',
    // staffMemberId: 'uuid'  ← opcional, para filtrar por staff
  },
});
// Response: CalendarEvent[]
// Solo expone eventos de ownerType='company' (no personales de staff/cliente)

// Mapear a formato FullCalendar
const fcEvents = events.map((e) => ({
  id: e.id,
  title: e.summary,
  start: e.start,
  end: e.end,
  backgroundColor: e.sourceType === 'appointment' ? '#3B82F6' : '#6B7280',
  extendedProps: { staffMemberId: e.staffMemberId, sourceType: e.sourceType },
}));
```

#### Importar Eventos Externos (fallback manual para Wix)

```typescript
// Si el webhook falla o para sincronización inicial
await api.post('/calendar/import-external', {
  startDateTime: '2026-04-01T00:00:00Z',
  endDateTime: '2026-04-30T23:59:59Z',
});
// Response: { imported: number, updated: number, skipped: number }
```

#### Gestión de Citas desde Admin

```typescript
// Listar todas las citas con paginación
const result = await api.get('/appointments', {
  params: { limit: 20, offset: 0 },
});
// Response: { count, pages, appointments }

// Ver cita específica con todas las relaciones
const appt = await api.get(`/appointments/${id}`);

// Actualizar (solo admin/staff pueden cambiar fechas o status manualmente)
await api.patch(`/appointments/${id}`, {
  start: '2026-04-10T15:00:00.000Z',
  end: '2026-04-10T16:00:00.000Z',
  timeZone: 'America/Toronto',
  status: 'confirmed',
});

// Cancelar (con razón; aplica regla de 24h si lo cancela el cliente)
await api.post(`/appointments/${id}/cancel`, {
  cancellationReason: 'Reagendamiento solicitado por el cliente',
});
```

---

## Referencia de Endpoints

### Disponibilidad

| Método | Endpoint        | Auth | Descripción              |
| ------ | --------------- | ---- | ------------------------ |
| `POST` | `/availability` | —    | Buscar slots disponibles |

### Citas

| Método   | Endpoint                            | Auth           | Descripción                       |
| -------- | ----------------------------------- | -------------- | --------------------------------- |
| `POST`   | `/appointments`                     | 🔐             | Crear cita                        |
| `GET`    | `/appointments`                     | 🔐 Admin/Staff | Listar todas (paginado)           |
| `GET`    | `/appointments/:id`                 | 🔐             | Ver cita                          |
| `PATCH`  | `/appointments/:id`                 | 🔐 Admin/Staff | Actualizar cita                   |
| `DELETE` | `/appointments/:id`                 | 🔐 Admin       | Eliminar cita                     |
| `POST`   | `/appointments/:id/cancel`          | 🔐             | Cancelar cita                     |
| `POST`   | `/appointments/:id/add-to-calendar` | 🔐             | Agregar al calendario del cliente |

### Calendario — Empresa (Admin)

| Método   | Endpoint                        | Auth           | Descripción                                 |
| -------- | ------------------------------- | -------------- | ------------------------------------------- |
| `GET`    | `/calendar/company/connect`     | 🔐 Admin       | URL OAuth para conectar                     |
| `GET`    | `/calendar/company/callback`    | 🔐             | Callback OAuth empresa                      |
| `GET`    | `/calendar/company/connections` | 🔐 Admin       | Ver conexiones activas                      |
| `DELETE` | `/calendar/company/disconnect`  | 🔐 Admin       | Desconectar empresa                         |
| `POST`   | `/calendar/webhook/company`     | —              | Webhook Google (push)                       |
| `POST`   | `/calendar/import-external`     | 🔐 Admin       | Importar eventos manualmente                |
| `GET`    | `/calendar/events`              | 🔐 Admin/Staff | Eventos del sistema (para vista calendario) |

### Calendario — Staff

| Método   | Endpoint                      | Auth           | Descripción                     |
| -------- | ----------------------------- | -------------- | ------------------------------- |
| `GET`    | `/calendar/staff/connect`     | 🔐 Staff/Admin | URL OAuth personal              |
| `GET`    | `/calendar/staff/callback`    | 🔐             | Callback OAuth staff            |
| `GET`    | `/calendar/staff/connections` | 🔐 Staff       | Ver mis conexiones              |
| `GET`    | `/calendar/staff/calendars`   | 🔐 Staff       | Listar calendarios de la cuenta |
| `PATCH`  | `/calendar/staff/:id/select`  | 🔐 Staff       | Elegir calendario específico    |
| `PATCH`  | `/calendar/staff/:id/toggle`  | 🔐 Staff       | Activar/desactivar autoSync     |
| `DELETE` | `/calendar/staff/:id`         | 🔐 Staff/Admin | Desconectar                     |
| `POST`   | `/calendar/webhook/staff`     | —              | Webhook Google (push) staff     |

### Calendario — Cliente

| Método   | Endpoint                       | Auth    | Descripción            |
| -------- | ------------------------------ | ------- | ---------------------- |
| `GET`    | `/calendar/client/connect`     | 🔐 User | URL OAuth personal     |
| `GET`    | `/calendar/client/callback`    | 🔐      | Callback OAuth cliente |
| `GET`    | `/calendar/client/connections` | 🔐 User | Ver mis conexiones     |
| `DELETE` | `/calendar/client/:id`         | 🔐 User | Desconectar            |

---

## Gestión de Errores

### Códigos Esperados

| HTTP  | Código                | Situación                                              |
| ----- | --------------------- | ------------------------------------------------------ |
| `409` | `ConflictException`   | Slot no disponible (cita solapada, calendario ocupado) |
| `409` | `ConflictException`   | Evento en calendario bloquea el horario                |
| `400` | `BadRequestException` | Horario fuera de las horas de trabajo del staff        |
| `400` | `BadRequestException` | Cancelación con menos de 24h de anticipación           |
| `400` | `BadRequestException` | Fechas inválidas o cita demasiado corta/larga          |
| `403` | `ForbiddenException`  | Intentar cancelar la cita de otro usuario              |

### Manejo en React Native

```typescript
try {
  await api.post('/appointments', payload);
} catch (err) {
  if (err.response?.status === 409) {
    // Slot ocupado — refrescar disponibilidad
    queryClient.invalidateQueries(['availability']);
    showToast('Ese horario ya no está disponible. Por favor elige otro.');
  } else if (err.response?.status === 400) {
    showToast(err.response.data.message);
  }
}
```

### React Query — Configuración Recomendada

```typescript
// Para disponibilidad: staleTime moderado (los slots cambian frecuentemente)
useQuery({
  queryKey: ['availability', serviceId, date, staffId, timeZone],
  queryFn: () =>
    api.post('/availability', { serviceId, date, staffId, timeZone }),
  staleTime: 30_000, // 30s — evita refetch en cada render
  gcTime: 60_000, // 1 min en cache
});

// Para citas del usuario: invalidar después de crear/cancelar
const createMutation = useMutation({
  mutationFn: (data) => api.post('/appointments', data),
  onSuccess: () => {
    queryClient.invalidateQueries(['appointments']);
    queryClient.invalidateQueries(['availability']);
  },
});

// Para conexiones de calendario: staleTime alto (cambian raramente)
useQuery({
  queryKey: ['calendar-connections', ownerType],
  staleTime: 5 * 60_000, // 5 min
});
```

---

## Variables de Entorno

### Existentes (mantener)

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Temporalmente como fallback hasta que la empresa conecte via OAuth:
GOOGLE_SERVICE_ACCOUNT_EMAIL=...   # deprecated (fallback)
GOOGLE_PRIVATE_KEY=...             # deprecated (fallback)
GOOGLE_CALENDAR_ID=...             # deprecated (fallback)
```

### Nuevas Requeridas

```env
# Criptografía para refresh tokens
ENCRYPTION_KEY=       # 32 bytes en hex, ej: openssl rand -hex 32

# URL pública de la API (para registrar webhooks en Google)
WEBHOOK_BASE_URL=     # https://api.ascenciotax.com (prod)
                      # https://abc123.ngrok.io   (dev con ngrok)

# Callbacks OAuth por actor (deben registrarse en Google Cloud Console)
GOOGLE_COMPANY_CALENDAR_CALLBACK_URL=https://api.ascenciotax.com/api/v1/calendar/company/callback
GOOGLE_STAFF_CALENDAR_CALLBACK_URL=https://api.ascenciotax.com/api/v1/calendar/staff/callback
GOOGLE_CLIENT_CALENDAR_CALLBACK_URL=https://api.ascenciotax.com/api/v1/calendar/client/callback

# Tiempo de paso de slots (minutos). También editable desde admin > configuración.
SLOT_STEP_MINUTES_DEFAULT=15
```

### Setup ngrok para desarrollo

```bash
# Instalar ngrok y tunelizar el puerto de la API
ngrok http 3000
# Copiar la URL HTTPS generada y configurar:
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

### Google Cloud Console — Configuración OAuth

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials → OAuth 2.0 Client IDs
3. Agregar a "Authorized redirect URIs" los tres `*_CALLBACK_URL` de arriba
4. Scopes necesarios para el proyecto:
   - `https://www.googleapis.com/auth/calendar` (empresa — lectura/escritura)
   - `https://www.googleapis.com/auth/calendar.readonly` (staff y cliente)

---

## Plan de Implementación

### Fase 0 — Bugs críticos de disponibilidad

- Error de calendario silenciado → 0 slots si falla la comprobación
- Company-wide events (`staffMemberId=null`) bloquean a todos
- Citas `pending` no restaban de la disponibilidad
- Staff duplicado en `availableStaff[]`
- Código muerto eliminado
- Slot step configurable desde `system_settings`

### Fase 1 — Estado `completed`

- Cron cada hora para marcar citas pasadas como `completed`

### Fase 2 — Adapter Pattern + CalendarConnection

- Interfaz `ICalendarProvider` (extensible a Outlook/Apple)
- `GoogleCalendarAdapter` (reemplaza service account)
- Entidad `CalendarConnection` + `CalendarConnectionService`
- `CalendarProviderFactory`

### Fase 3 — Calendario empresa via OAuth

- Elimina dependencia de service account estático
- Webhooks en tiempo real para sync
- Compatibilidad con Wix durante transición

### Fase 4 — Calendarios de staff

- Self-service: cada staff conecta su cuenta
- Selector de calendario (si tiene múltiples)
- Activar/desactivar autoSync
- Webhooks individuales por staff

### Fase 5 — Vista de calendario admin

- `GET /calendar/events` para renderizar en el frontend
- Solo expone eventos `ownerType='company'`

### Fase 6 — Calendario de clientes

- Add-to-calendar post-cita
- Base para futura verificación de conflictos en el slot selector

### Fase 7 — Limpieza

- Eliminar service account como código principal (mantener como fallback)
- Eliminar console.logs y código muerto
