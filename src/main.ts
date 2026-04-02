import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, VersioningType } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SeedService } from './seed/seed.service';

async function bootstrap() {
  const logger = new Logger('AscencioTaxApi');

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableCors({
    credentials: true,
  });

  // Use zod validation pipe later
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //   }),
  // );

  const config = new DocumentBuilder()
    .setTitle('Ascencio Tax API')
    .setDescription('Ascencio Tax API')
    .setVersion('1.0')
    .addTag('ascencio-tax')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const port = process.env.PORT ?? 3001;

  const seedService = app.get(SeedService);
  await seedService.runSeed().catch((error: unknown) => {
    logger.warn(
      `Seed skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  await app.listen(port);
  logger.log(
    `Server on port ${String(port)} - Environment: ${process.env.STAGE ?? 'dev'}`,
  );
}

void bootstrap();
