import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // CORS — environment-based origin instead of wildcard
  const frontendUrl = configService.get<string>('app.frontendUrl', 'http://localhost:3001');
  app.enableCors({ origin: frontendUrl });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      whitelist: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  logger.log(`Server is running on port ${port}`);
}

bootstrap();
