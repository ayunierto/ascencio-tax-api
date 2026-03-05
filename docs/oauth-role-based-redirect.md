# OAuth Google - Redirección Basada en Roles

## 📝 Descripción

Se implementó un sistema de **redirección inteligente** basado en roles para el flujo de autenticación con Google OAuth. Ahora los usuarios son redirigidos a diferentes páginas según sus permisos después de iniciar sesión con Google.

## 🎯 Problema Resuelto

**Antes:** Todos los usuarios eran redirigidos a `/admin` sin importar su rol, causando errores "Unauthorized" para usuarios sin permisos administrativos.

**Ahora:** Los usuarios son redirigidos a la página apropiada según su rol:

| Rol                           | Redirección         | Descripción                                      |
| ----------------------------- | ------------------- | ------------------------------------------------ |
| `superUser`, `admin`, `staff` | `/{locale}/admin`   | Panel de administración (con permisos según rol) |
| `user`                        | `/{locale}/booking` | Página de reservas de citas                      |

## 🔧 Cambios Implementados

### 1. Auth Controller (`auth.controller.ts`)

```typescript
// Antes
const successPath = process.env.OAUTH_SUCCESS_REDIRECT ?? '/en/admin';

// Ahora
const userRoles = result.user.roles || [];
const locale = result.user.locale || 'en';
const hasAdminAccess = userRoles.some((role) =>
  ['superUser', 'admin', 'staff'].includes(role),
);
const successPath = hasAdminAccess ? `/${locale}/admin` : `/${locale}/booking`;
```

### 2. Roles Disponibles

- `superUser` - Súper administrador con acceso completo
- `admin` - Administrador de la plataforma
- `staff` - Personal con acceso limitado al admin
- `user` - Usuario regular (solo puede ver sus propias citas)

## 🚀 Flujo de Autenticación

1. Usuario inicia sesión con Google: `GET /api/v1/auth/google`
2. Google redirige a: `GET /api/v1/auth/google/callback?code=...`
3. El servidor:
   - Verifica el código con Google
   - Crea o actualiza el usuario en la BD
   - Genera JWT token
   - **Determina la ruta según el rol del usuario**
   - Establece cookie `access_token`
   - Redirige a la página apropiada

## 📋 Configuración Requerida

### Variables de Entorno (.env)

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/v1/auth/google/callback"

# Frontend Configuration
WEB_APP_URL="http://localhost:4000"

# Ya no es necesario OAUTH_SUCCESS_REDIRECT (se calcula dinámicamente)
```

### Google Cloud Console

Asegúrate de tener configurado en **Authorized redirect URIs**:

- Desarrollo: `http://localhost:3000/api/v1/auth/google/callback`
- Producción: `https://tu-dominio.com/api/v1/auth/google/callback`

## 🔐 Gestión de Roles

### Asignar Roles a Usuarios

Los roles se asignan desde la base de datos. Para un nuevo usuario:

```sql
-- Actualizar rol de un usuario existente
UPDATE users
SET roles = ARRAY['admin']  -- o ['staff'], ['user']
WHERE email = 'usuario@ejemplo.com';

-- Ver roles actuales de un usuario
SELECT email, roles FROM users WHERE email = 'usuario@ejemplo.com';
```

### Roles por Defecto

Cuando un usuario se registra por primera vez (con Google o email):

- **Google OAuth**: Se asigna automáticamente `['user']`
- **Email/Password**: Se asigna automáticamente `['user']`

Los administradores deben cambiar manualmente los roles en la BD.

## 🎨 Frontend

### Páginas Correspondientes

- **`/[lang]/admin`** - Dashboard administrativo (requiere roles: admin, staff, superUser)
- **`/[lang]/booking`** - Página de reservas (accesible para todos los usuarios autenticados)

### Protección de Rutas

El layout de admin (`/app/[lang]/(admin)/admin/layout.tsx`) verifica que el usuario esté autenticado:

```tsx
const user = await getCurrentUser();
if (!user) {
  return <div>Necesitas iniciar sesión</div>;
}
```

**Recomendación:** Agregar validación de roles específica en secciones críticas:

```tsx
if (!user.roles.some((r) => ['admin', 'superUser'].includes(r))) {
  return <div>No tienes permisos para esta sección</div>;
}
```

## 🧪 Prueba del Flujo

1. **Usuario Regular (rol: user)**
   - Ir a: `http://localhost:3000/api/v1/auth/google`
   - Iniciar sesión con Google
   - Resultado: Redirigido a `http://localhost:4000/en/booking` o `/es/booking`

2. **Administrador (rol: admin)**
   - Ir a: `http://localhost:3000/api/v1/auth/google`
   - Iniciar sesión con Google
   - Resultado: Redirigido a `http://localhost:4000/en/admin` o `/es/admin`

## 📱 Mobile App

Para la app móvil, el flujo usa el parámetro `oauth_mode=mobile`:

```typescript
// GET /api/v1/auth/google/mobile
// Redirige a: ascenciotaxapp://auth/google/callback?access_token=...
```

El modo móvil **siempre** devuelve el token sin redirecciones web.

## ⚠️ Troubleshooting

### Error: "Unauthorized" después del login

**Causa:** El usuario no tiene el rol correcto para acceder a `/admin`

**Solución:**

1. Verificar roles del usuario en la BD
2. Asignar rol correcto con SQL:
   ```sql
   UPDATE users SET roles = ARRAY['admin'] WHERE email = '...';
   ```

### Error: "Invalid Google ID token"

**Causa:** Credenciales de Google incorrectas o expiradas

**Solución:**

1. Verificar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`
2. Verificar que la URL de callback esté registrada en Google Cloud Console
3. Reiniciar el servidor después de cambiar `.env`

## 🔄 Migraciones Futuras

Si deseas agregar más roles o cambiar la lógica de redirección:

1. Agregar nuevo rol en `auth/enums/role.enum.ts`
2. Actualizar lógica en `auth.controller.ts` → `googleCallback()`
3. Crear la página correspondiente en el frontend
4. Actualizar esta documentación

---

**Última actualización:** 1 de marzo de 2026
