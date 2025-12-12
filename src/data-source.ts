import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Cargar variables de entorno en orden de prioridad
config({ path: '../../.env.migration' }); // Para ejecutar migrations contra Railway
config({ path: '../../.env.docker' }); // Para desarrollo local con Docker
config(); // Para otras configuraciones

// Para migrations locales, usar localhost en vez de 'db' (nombre del contenedor)
const host = process.env.DB_HOST === 'db' ? 'localhost' : process.env.DB_HOST;

export default new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: host || 'localhost',
        port: +(process.env.DB_PORT || 5432),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'ascencio',
      }),
  ssl: process.env.STAGE !== 'dev' ? { rejectUnauthorized: false } : false,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
});
