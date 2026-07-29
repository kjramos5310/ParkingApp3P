import { NestFactory } from '@nestjs/core';
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

  const config = new DocumentBuilder()
    .setTitle('MS-Vehiculos - Sistema de Parqueaderos SaaS')
    .setDescription(
      'Registro y catalogo de vehiculos por tenant. Todas las operaciones ' +
      'requieren un JWT valido y la cabecera X-Tenant-ID que identifica a la empresa.',
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
    .addTag('vehiculos', 'CRUD de vehiculos y asociacion con propietarios')
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
