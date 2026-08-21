import type { DashboardEvent } from '@nexus-monitor/contracts';

import { DashboardEventPublisher } from './dashboard-event.publisher.js';

const event: DashboardEvent = {
  hostId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-08-21T10:00:00.000Z',
  payload: { availability: 'online', lastSeenAt: '2026-08-21T10:00:00.000Z' },
  type: 'host.status',
  version: 1,
};

describe('DashboardEventPublisher', () => {
  it('delivers events to active subscribers and stops after unsubscribe', () => {
    const publisher = new DashboardEventPublisher();
    const received: DashboardEvent[] = [];
    const unsubscribe = publisher.subscribe((published) => {
      received.push(published);
    });

    publisher.publish(event);
    unsubscribe();
    publisher.publish({ ...event, occurredAt: '2026-08-21T10:00:01.000Z' });

    expect(received).toEqual([event]);
  });

  it('does not let one broken subscriber block persistence callers or peers', () => {
    const listenerError = jest.fn();
    const publisher = new DashboardEventPublisher(listenerError);
    const received: DashboardEvent[] = [];
    publisher.subscribe(() => {
      throw new Error('stream closed');
    });
    publisher.subscribe((published) => {
      received.push(published);
    });

    expect(() => publisher.publish(event)).not.toThrow();
    expect(received).toEqual([event]);
    expect(listenerError).toHaveBeenCalledWith(new Error('stream closed'));
  });
});
