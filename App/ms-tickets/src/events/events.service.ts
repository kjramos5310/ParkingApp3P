import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface TicketEvent {
  type: string;
  data: any;
}

/**
 * Bus de eventos en memoria para publicar cambios (creación/cierre de tickets,
 * cambios de estado de espacios) hacia los clientes SSE conectados.
 */
@Injectable()
export class TicketsEventsService {
  private readonly stream$ = new Subject<TicketEvent>();

  asObservable(): Observable<TicketEvent> {
    return this.stream$.asObservable();
  }

  emit(event: TicketEvent): void {
    this.stream$.next(event);
  }
}
