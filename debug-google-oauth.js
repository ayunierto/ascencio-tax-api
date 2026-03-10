/**
 * Script de debugging para Google OAuth
 * Ejecutar: node debug-google-oauth.js
 */

require('dotenv').config();

console.log('\n🔍 VERIFICACIÓN DE CONFIGURACIÓN GOOGLE OAUTH\n');
console.log('='.repeat(60));

// Verificar variables de entorno
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
const webAppUrl = process.env.WEB_APP_URL;

console.log('\n📋 Variables de Entorno (.env):');
console.log('-'.repeat(60));
console.log(
  'GOOGLE_CLIENT_ID:',
  clientId ? `${clientId.substring(0, 30)}...` : '❌ FALTA',
);
console.log(
  'GOOGLE_CLIENT_SECRET:',
  clientSecret ? '✅ Configurado (oculto por seguridad)' : '❌ FALTA',
);
console.log('GOOGLE_CALLBACK_URL:', callbackUrl || '❌ FALTA');
console.log('WEB_APP_URL:', webAppUrl || '❌ FALTA');

// Validaciones
console.log('\n✅ Validaciones:');
console.log('-'.repeat(60));

const issues = [];

if (!clientId) {
  issues.push('❌ GOOGLE_CLIENT_ID no está configurado');
} else if (
  clientId !==
  '1007923113225-97m3vggmasa9vktkpdqi01jmtfkmmd3r.apps.googleusercontent.com'
) {
  issues.push(
    '⚠️  GOOGLE_CLIENT_ID no coincide con el de Google Cloud Console',
  );
}

if (!clientSecret) {
  issues.push('❌ GOOGLE_CLIENT_SECRET no está configurado');
}

if (!callbackUrl) {
  issues.push('❌ GOOGLE_CALLBACK_URL no está configurado');
} else {
  if (callbackUrl !== 'http://localhost:3000/api/v1/auth/google/callback') {
    issues.push(
      `⚠️  GOOGLE_CALLBACK_URL debería ser: http://localhost:3000/api/v1/auth/google/callback`,
    );
    issues.push(`   Actual: ${callbackUrl}`);
  }

  if (
    callbackUrl.includes('192.168.') ||
    callbackUrl.includes('10.') ||
    callbackUrl.includes('172.')
  ) {
    issues.push(
      '❌ GOOGLE_CALLBACK_URL usa una IP privada - Google la rechazará',
    );
    issues.push(
      '   Cambiar a: http://localhost:3000/api/v1/auth/google/callback',
    );
  }
}

if (!webAppUrl) {
  issues.push('❌ WEB_APP_URL no está configurado');
}

if (issues.length === 0) {
  console.log('✅ Todas las validaciones pasaron correctamente');
} else {
  console.log('⚠️  Se encontraron problemas:\n');
  issues.forEach((issue) => console.log('   ' + issue));
}

// Checklist de Google Cloud Console
console.log('\n📋 Checklist Google Cloud Console:');
console.log('-'.repeat(60));
console.log('\n¿Tienes configuradas estas URIs en Google Cloud Console?');
console.log('https://console.cloud.google.com/apis/credentials\n');

console.log('✅ Authorized JavaScript origins (debe incluir):');
console.log('   • http://localhost');
console.log(
  '   • http://localhost:3000   ← ⚠️  IMPORTANTE: Verifica que esté agregado',
);
console.log('   • http://localhost:4000');

console.log('\n✅ Authorized redirect URIs (debe incluir):');
console.log('   • http://localhost:3000/api/v1/auth/google/callback');

console.log('\n💡 Próximos Pasos:');
console.log('-'.repeat(60));
console.log(
  '1. Agregar http://localhost:3000 a "Authorized JavaScript origins"',
);
console.log('2. Guardar cambios en Google Cloud Console');
console.log('3. Esperar 5-10 minutos para que Google propague los cambios');
console.log('4. Reiniciar el servidor API: npm run start:dev');
console.log(
  '5. Limpiar cookies del navegador (F12 > Application > Clear site data)',
);
console.log('6. Probar: http://localhost:4000/en/signin');
console.log('\n' + '='.repeat(60) + '\n');
