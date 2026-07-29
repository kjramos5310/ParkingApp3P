import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface TicketEvent {
  type: string;
  data: any;
}

@Injectable()
export class EventsService {
  private readonly streams = new Map<string, Subject<TicketEvent>>();

  emit(tenantId: string, event: TicketEvent): void {
    this.streamFor(tenantId).next(event);
  }

  asObservable(tenantId: string): Observable<TicketEvent> {
    return this.streamFor(tenantId).asObservable();
  }

  private streamFor(tenantId: string): Subject<TicketEvent> {
    let stream = this.streams.get(tenantId);
    if (!stream) { stream = new Subject<TicketEvent>(); this.streams.set(tenantId, stream); }
    return stream;
  }
}
