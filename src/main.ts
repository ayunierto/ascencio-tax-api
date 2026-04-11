import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  Logger,
  // VersioningType
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SeedService } from './seed/seed.service';

const parseTrustProxySetting = (
  value: string | undefined,
): boolean | number | string => {
  if (!value) {
    return process.env.STAGE === 'dev' ? false : 1;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }

  return value;
};

async function bootstrap() {
  const logger = new Logger('AscencioTaxApi');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const trustProxySetting = parseTrustProxySetting(process.env.TRUST_PROXY);
  app.set('trust proxy', trustProxySetting);
  logger.log(`Trust proxy setting: ${String(trustProxySetting)}`);

  app.use(cookieParser());

  // app.setGlobalPrefix('api');

  // app.enableVersioning({
  //   type: VersioningType.URI,
  //   defaultVersion: '1',
  // });

  app.enableCors({
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Ascencio Tax API')
    .setDescription('Ascencio Tax API')
    .setVersion('1.0')
    .addTag('ascencio-tax')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3001;

  const seedService = app.get(SeedService);
  await seedService.runSeed().catch((error: unknown) => {
    logger.warn(
      `Seed skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  await app.listen(port);
  logger.debug(
    `Server on port ${String(port)} - Environment: ${process.env.STAGE ?? 'dev'}`,
  );
}

void bootstrap();
