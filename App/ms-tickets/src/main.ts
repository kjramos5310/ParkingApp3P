import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Permite que el dashboard (otro origen) consuma la API y el stream SSE.
  app.enableCors();
  // El JwtAuthGuard se registra globalmente vía APP_GUARD en AppModule,
  // así respeta los endpoints marcados con @Public() (p. ej. el SSE).
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
