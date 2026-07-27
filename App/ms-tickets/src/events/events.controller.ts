import { Controller, Headers, MessageEvent, Sse } from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { EventsService } from './events.service';

@Controller('sse')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Stream SSE consumido por el dashboard (http://localhost:3002/sse/eventos)
  @Sse('eventos')
  eventos(@Headers('x-tenant-id') tenantId: string): Observable<MessageEvent> {
    // Eventos reales de tickets -> mensaje por defecto (onmessage en el frontend)
    const eventos$ = this.eventsService.asObservable(tenantId).pipe(
      map((e) => ({ data: e }) as MessageEvent),
    );
    // Heartbeat como evento nombrado 'ping' (el frontend lo ignora) para
    // mantener viva la conexion.
    const heartbeat$ = interval(25000).pipe(
      map(() => ({ type: 'ping', data: 'keep-alive' }) as MessageEvent),
    );
    return merge(eventos$, heartbeat$);
  }
}
