import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { HttpClientService } from './common/httpl-client.service';
import { ServiceAuthService } from './common/service-auth.service';
import { RedisCacheService } from './common/redis-cache.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
    EventsModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, HttpClientService, ServiceAuthService, RedisCacheService],
  exports: [TicketsService],
})
export class TicketsModule { }
