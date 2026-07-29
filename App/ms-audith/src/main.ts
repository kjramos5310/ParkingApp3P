import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

/**
 * Origenes permitidos. En el cluster el trafico llega por Kong (mismo origen
 * que la SPA), pero se mantienen los origenes de desarrollo local.
 */
function corsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS;
  if (fromEnv) {
    return fromEnv.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return [
    'https://parqueadero.espe.edu.ec',
    'http://parqueadero.espe.edu.ec',
    'http://localhost:5173',
    'http://localhost:5500',
  ];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: corsOrigins(), credentials: true });
  app.useGlobalGuards(new JwtAuthGuard());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('MS-Auditoria - Sistema de Parqueaderos SaaS')
    .setDescription(
      'Registro centralizado de eventos. Consume la cola audit_queue de RabbitMQ ' +
      'y expone el historial filtrado por tenant. Solo roles administrativos.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addGlobalParameters({
      name: 'X-Tenant-ID',
      in: 'header',
      required: true,
      description: 'Identificador del tenant (empresa)',
      schema: { type: 'string', example: 'empresa-a' },
    })
    .addTag('audit', 'Consulta del historial de eventos por tenant')
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));

  const PORT = process.env.PORT || 3004;
  await app.listen(PORT);
  console.log(`Audit service is running on: http://localhost:${PORT}`);
  console.log(`OpenAPI docs available at: http://localhost:${PORT}/docs`);
}
bootstrap();
