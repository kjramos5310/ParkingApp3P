import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { TicketsEventsService } from './events.service';

@Module({
  controllers: [EventsController],
  providers: [TicketsEventsService],
  exports: [TicketsEventsService],
})
export class EventsModule {}
