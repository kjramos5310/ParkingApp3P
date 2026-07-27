import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsModule } from './tickets/tickets.module';
import { Ticket } from './tickets/entities/ticket.entity';
import { EventsModule } from './events/events.module';
import { EventPublisher } from './common/event.publisher.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USUARIO'),
        password: configService.get<string>('DB_CONTRASENA'),
        database: configService.get<string>('DB_NOMBRE'),
        entities: [Ticket],
        synchronize: true, // solo desarrollo
        logging: true,
      }),
      inject: [ConfigService],
    }),
    TicketsModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    EventPublisher,
    // Interceptor global: audita toda operacion HTTP del microservicio y
    // publica el evento a RabbitMQ para que ms-audith lo persista.
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
