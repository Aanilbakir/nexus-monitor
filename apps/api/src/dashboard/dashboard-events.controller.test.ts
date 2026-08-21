import type { DashboardEvent } from '@nexus-monitor/contracts';

import { DashboardEventsController } from './dashboard-events.controller.js';
import { DashboardEventPublisher } from './domain/dashboard-event.publisher.js';

const event: DashboardEvent = {
  hostId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-08-21T10:00:00.000Z',
  payload: { availability: 'online', lastSeenAt: '2026-08-21T10:00:00.000Z' },
  type: 'host.status',
  version: 1,
};

describe('DashboardEventsController', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('emits ready, domain, and keepalive events and cleans up on disconnect', () => {
    const publisher = new DashboardEventPublisher();
    const controller = new DashboardEventsController(
      publisher,
      () => new Date('2026-08-21T10:00:00.000Z'),
    );
    const received: unknown[] = [];
    const subscription = controller.events().subscribe((message) => {
      received.push(message);
    });

    publisher.publish(event);
    jest.advanceTimersByTime(20_000);
    subscription.unsubscribe();
    publisher.publish({ ...event, occurredAt: '2026-08-21T10:00:21.000Z' });
    jest.advanceTimersByTime(20_000);

    expect(received).toEqual([
      {
        type: 'ready',
        data: { connectedAt: '2026-08-21T10:00:00.000Z' },
      },
      { type: 'host.status', data: event },
      { type: 'keepalive', data: '' },
    ]);
  });
});
