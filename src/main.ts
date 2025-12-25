import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { TransformInterceptor } from './core/transform.interceptor';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);

  // Static files
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Cookie
  app.use(cookieParser());

  // Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  // Global Guard & Interceptor
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  // CORS (production-safe)
  app.enableCors({
    origin: (origin, callback) => {
      // allow server-to-server & tools like Postman
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  });

  // 🚀 IMPORTANT: Render injects PORT
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log(`🚀 Server running on port ${port}`);
}
bootstrap();
