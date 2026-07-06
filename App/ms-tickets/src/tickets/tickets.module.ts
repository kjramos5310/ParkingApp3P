import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { HttpClientService } from './common/httpl-client.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EventPublisher } from '../common/event.publisher.service';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    HttpClientService,
    EventPublisher,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [TicketsService],
})
export class TicketsModule { }
