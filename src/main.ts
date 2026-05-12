import 'dotenv/config';
import 'reflect-metadata';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { Socket } from 'net';
import { AppModule } from './app.module';
import { envs } from './config/envs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: envs.allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('CUTS - Traffic Simulator API')
    .setDescription('API del simulador de tráfico urbano colaborativo')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = envs.port || 4000;
  await app.listen(port);
  const httpServer = app.getHttpServer();
  const ignoreSocketErrors = new Set(['ECONNRESET', 'EPIPE']);

  httpServer.on('connection', (socket: Socket) => {
    socket.on('error', (err: NodeJS.ErrnoException) => {
      if (err?.code && ignoreSocketErrors.has(err.code)) return;
      logger.warn(`Socket error: ${err?.message || 'unknown'}`);
    });
  });

  httpServer.on('clientError', (err: NodeJS.ErrnoException, socket: Socket) => {
    if (err?.code && ignoreSocketErrors.has(err.code)) return;
    logger.warn(`Client error: ${err?.message || 'unknown'}`);
    try {
      socket.destroy();
    } catch {
      // Ignore destroy errors
    }
  });
  logger.log(`Backend running on port ${port}`);
  logger.log(`API docs available at http://localhost:${port}/api`);
}

bootstrap();
