import { Controller, Inject, Optional, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';

import type { Clock } from '../agents/domain/agent.service.js';
import { DashboardEventPublisher } from './domain/dashboard-event.publisher.js';
import { DashboardAuthGuard } from './infrastructure/dashboard-api-key.guard.js';

const KEEPALIVE_INTERVAL_MILLISECONDS = 20_000;
export const DASHBOARD_CLOCK = Symbol('DASHBOARD_CLOCK');

@Controller('dashboard')
@UseGuards(DashboardAuthGuard)
export class DashboardEventsController {
  public constructor(
    private readonly publisher: DashboardEventPublisher,
    @Optional()
    @Inject(DASHBOARD_CLOCK)
    private readonly clock: Clock = () => new Date(),
  ) {}

  @Sse('events')
  public events(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        type: 'ready',
        data: { connectedAt: this.clock().toISOString() },
      });

      const unsubscribe = this.publisher.subscribe((event) => {
        subscriber.next({ type: event.type, data: event });
      });
      const keepalive = setInterval(() => {
        subscriber.next({ type: 'keepalive', data: '' });
      }, KEEPALIVE_INTERVAL_MILLISECONDS);

      return () => {
        clearInterval(keepalive);
        unsubscribe();
      };
    });
  }
}
