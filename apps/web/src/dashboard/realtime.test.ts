import { describe, expect, it, vi } from 'vitest';

import { openDashboardEvents, type EventSourceLike } from './realtime';

class FakeEventSource implements EventSourceLike {
  public readonly listeners = new Map<string, EventListener>();
  public close = vi.fn();

  public addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }

  public emit(type: string, data = ''): void {
    this.listeners.get(type)?.(new MessageEvent(type, { data }));
  }
}

describe('openDashboardEvents', () => {
  it('delivers valid named events and connection state', () => {
    const source = new FakeEventSource();
    const event = {
      hostId: '11111111-1111-4111-8111-111111111111',
      occurredAt: '2026-08-21T10:00:00.000Z',
      payload: {
        availability: 'online',
        lastSeenAt: '2026-08-21T10:00:00.000Z',
      },
      type: 'host.status',
      version: 1,
    };
    const onEvent = vi.fn();
    const onReady = vi.fn();
    const onDisconnect = vi.fn();
    const close = openDashboardEvents(
      { onDisconnect, onEvent, onReady },
      () => source,
    );

    source.emit('ready', '{}');
    source.emit('host.status', JSON.stringify(event));
    source.emit('host.metric', '{bad json');
    source.emit('error');
    close();

    expect(onReady).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(source.close).toHaveBeenCalledOnce();
  });
});
