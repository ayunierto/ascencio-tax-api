# Configuración de Google OAuth - Guía Completa

## Problema Actual

Error: `TokenError: Unauthorized` al intentar autenticarse con Google.

## Causa

Las credenciales OAuth en `.env` no son válidas o no están autorizadas en Google Cloud Console.

## Solución: Verificar y Regenerar Credenciales

### 1. Ir a Google Cloud Console

1. Abre: https://console.cloud.google.com/
2. Selecciona tu proyecto: **Ascencio Tax** (o crea uno nuevo si no existe)

### 2. Verificar OAuth Consent Screen

1. Ve a: **APIs & Services → OAuth consent screen**
2. Verifica que:
   - **User Type**: External (para testing) o Internal (si es workspace)
   - **App name**: Ascencio Tax
   - **User support email**: Tu email
   - **Developer contact**: Tu email
   - **Scopes**: Asegúrate de tener:
     - `userinfo.email`
     - `userinfo.profile`
     - `openid`
3. Si no está configurado, haz clic en **EDIT APP** y completa los campos requeridos
4. Guarda los cambios

### 3. Crear/Verificar OAuth 2.0 Client ID

1. Ve a: **APIs & Services → Credentials**
2. Busca un "OAuth 2.0 Client ID" existente o crea uno nuevo

#### Para Crear Uno Nuevo:

1. Clic en **+ CREATE CREDENTIALS → OAuth client ID**
2. Application type: **Web application**
3. Name: `Ascencio Tax - Web App`
4. **Authorized JavaScript origins**: (opcional para desarrollo)
   ```
   http://localhost:3000
   ```
5. **Authorized redirect URIs**: ⚠️ **MUY IMPORTANTE**

   ```
   http://localhost:3000/auth/google/callback
   ```

   - NO trailing slash al final
   - NO cambiar `/` - debe coincidir exactamente con tu backend
   - Usa `http://` para desarrollo local, `https://` para producción

6. Clic en **CREATE**

### 4. Obtener las Credenciales

Después de crear el OAuth Client, verás:

- **Client ID**: algo como `1007923113225-xxxxx.apps.googleusercontent.com`
- **Client Secret**: algo como `GOCSPX-xxxxx`

### 5. Actualizar `.env`

En `/ascencio-tax-api/.env`, actualiza:

```bash
# Google OAuth (para login con Google)
GOOGLE_CLIENT_ID="TU_CLIENT_ID.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="TU_CLIENT_SECRET"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# URL de tu frontend (para redirigir después del login)
WEB_APP_URL="http://localhost:4000"
```

### 6. Reiniciar el Servidor

```bash
cd ascencio-tax-api
npm run start:dev
```

### 7. Probar OAuth

1. Inicia el frontend: `cd ascencio-tax-web && npm run dev`
2. Ve a: http://localhost:4000/es
3. Haz clic en "Iniciar Sesión con Google"
4. Deberías ver la pantalla de consentimiento de Google
5. Tras aceptar, deberías redirigir a `/es/admin`

## Errores Comunes

### Error: "Unauthorized"

- ✅ Verifica que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` coincidan con Google Cloud Console
- ✅ Verifica que la Callback URL en `.env` coincida EXACTAMENTE con la configurada en Google Cloud Console
- ✅ No uses credenciales de otro proyecto
- ✅ Verifica que el OAuth Client no esté revocado o borrado

### Error: "redirect_uri_mismatch"

- ✅ La URL en "Authorized redirect URIs" debe ser EXACTAMENTE: `http://localhost:3000/auth/google/callback`
- ✅ Sin trailing slash
- ✅ Protocolo correcto (`http://` para local, `https://` para producción)
- ✅ Puerto correcto (3000 es tu API, no tu frontend)

### Error: "access_denied"

- ✅ OAuth Consent Screen no está configurado
- ✅ Tu email no está en la lista de test users (si el app está en testing)
- ✅ El scope solicitado no está autorizado

### Error: "invalid_client"

- ✅ `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET` son incorrectos
- ✅ Credenciales fueron revocadas o borradas en Google Cloud Console

## Verificación de la Configuración

### En Google Cloud Console:

1. **APIs & Services → Credentials**
2. Encuentra tu OAuth 2.0 Client ID
3. Verifica que:
   - Status: Enabled (not deleted/revoked)
   - Authorized redirect URIs contiene: `http://localhost:3000/auth/google/callback`

### En tu código:

```bash
# Ver las variables configuradas (oculta el secret)
grep GOOGLE .env | sed 's/CLIENT_SECRET=.*/CLIENT_SECRET=***HIDDEN***/'
```

Deberías ver:

```
GOOGLE_CLIENT_ID="1234567890-xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET=***HIDDEN***
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
```

## Logs de Debug

Si el problema persiste, revisa los logs del servidor:

```bash
# En tu terminal del backend, deberías ver:
🔐 Google OAuth Strategy Config:
   - Client ID: 1234567890-xxxxx... (primeros 20 chars)
   - Client Secret: ******* (present)
   - Callback URL: http://localhost:3000/auth/google/callback
✅ GoogleStrategy initialized successfully
```

Si ves valores vacíos o diferentes, el problema está en la lectura del `.env`.

## Producción

Para producción, crea un nuevo OAuth Client con:

```
Authorized redirect URIs:
https://api.ascenciotax.com/auth/google/callback
```

Y actualiza tus variables de entorno en producción:

```bash
GOOGLE_CLIENT_ID="TU_CLIENT_ID_PROD"
GOOGLE_CLIENT_SECRET="TU_CLIENT_SECRET_PROD"
GOOGLE_CALLBACK_URL="https://api.ascenciotax.com/auth/google/callback"
WEB_APP_URL="https://ascenciotax.com"
```

## Recursos

- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Setting up OAuth 2.0](https://support.google.com/cloud/answer/6158849)
