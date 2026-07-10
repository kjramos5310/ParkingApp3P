import { Controller, Sse } from '@nestjs/common';
import { Observable, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Public } from '../common/decorators/public.decorator';
import { TicketEvent, TicketsEventsService } from './events.service';

interface SseMessage {
  data: string | object;
  type?: string;
  id?: string;
  retry?: number;
}

@Controller()
export class EventsController {
  constructor(private readonly eventsService: TicketsEventsService) {}

  /**
   * Stream SSE que consume el dashboard en http://localhost:3002/sse/eventos
   * Emite un evento inicial de conexión y luego los eventos de tickets/espacios.
   */
  @Public()
  @Sse('sse/eventos')
  eventos(): Observable<SseMessage> {
    const init$ = of<SseMessage>({
      type: 'message',
      data: { type: 'INIT', message: 'Conectado a ms-tickets SSE' },
    });

    const stream$ = this.eventsService.asObservable().pipe(
      map<TicketEvent, SseMessage>((event) => ({
        type: event.type,
        data: event.data,
      })),
    );

    return merge(init$, stream$);
  }
}
