#!/usr/bin/env node
/**
 * Script de verificación de configuración de Google OAuth
 * Ejecutar: node scripts/verify-google-oauth.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de Google OAuth...\n');

// Leer .env
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: No se encontró el archivo .env');
  console.log('   Copia .env.example a .env y configura las credenciales');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    envVars[match[1].trim()] = value;
  }
});

// Verificar variables requeridas
const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
];

let hasErrors = false;

console.log('📋 Variables de Entorno:');
console.log('─'.repeat(60));

requiredVars.forEach((varName) => {
  const value = envVars[varName];
  if (!value || value === 'your_value_here' || value.includes('example')) {
    console.log(`❌ ${varName}: NO CONFIGURADO`);
    hasErrors = true;
  } else {
    // Mostrar solo los primeros caracteres
    const display = value.length > 30 ? `${value.substring(0, 30)}...` : value;
    console.log(`✅ ${varName}: ${display}`);
  }
});

console.log('─'.repeat(60));

// Verificar formato de Client ID
if (envVars.GOOGLE_CLIENT_ID) {
  if (!envVars.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')) {
    console.warn(
      '⚠️  ADVERTENCIA: GOOGLE_CLIENT_ID debería terminar en .apps.googleusercontent.com',
    );
    hasErrors = true;
  }
}

// Verificar formato de Callback URL
if (envVars.GOOGLE_CALLBACK_URL) {
  const callbackUrl = envVars.GOOGLE_CALLBACK_URL;
  if (
    !callbackUrl.startsWith('http://') &&
    !callbackUrl.startsWith('https://')
  ) {
    console.warn(
      '⚠️  ADVERTENCIA: GOOGLE_CALLBACK_URL debe comenzar con http:// o https://',
    );
    hasErrors = true;
  }
  if (!callbackUrl.includes('/auth/google/callback')) {
    console.warn(
      '⚠️  ADVERTENCIA: GOOGLE_CALLBACK_URL debería incluir /auth/google/callback',
    );
  }
}

console.log();

// Verificar que WEB_APP_URL también esté configurado
if (!envVars.WEB_APP_URL || envVars.WEB_APP_URL === 'http://localhost:3000') {
  console.warn(
    '⚠️  ADVERTENCIA: WEB_APP_URL no está configurado o usa el valor por defecto',
  );
  console.log(
    '   Asegúrate de que apunte a tu frontend (ej: http://localhost:4000)',
  );
}

console.log();
console.log('📝 Pasos para configurar Google OAuth:');
console.log('─'.repeat(60));
console.log('1. Ve a: https://console.cloud.google.com/');
console.log('2. Selecciona tu proyecto o crea uno nuevo');
console.log('3. Ve a "APIs & Services" → "Credentials"');
console.log('4. Clic en "Create Credentials" → "OAuth client ID"');
console.log('5. Tipo de aplicación: "Web application"');
console.log('6. Authorized redirect URIs:');
console.log(
  `   - ${envVars.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'}`,
);
console.log('7. Guarda el Client ID y Client Secret en tu .env');
console.log('─'.repeat(60));

console.log();

if (hasErrors) {
  console.error('❌ Se encontraron errores en la configuración');
  console.log('   Revisa las advertencias arriba y corrige los problemas');
  process.exit(1);
} else {
  console.log('✅ Configuración de Google OAuth parece correcta');
  console.log();
  console.log('Si aún tienes problemas:');
  console.log(
    '1. Verifica que las credenciales en .env coincidan con Google Cloud Console',
  );
  console.log(
    '2. Verifica que la URL de callback esté autorizada en Google Cloud Console',
  );
  console.log('3. Reinicia el servidor después de cambiar .env');
  console.log('4. Revisa los logs del servidor para más detalles');
}
