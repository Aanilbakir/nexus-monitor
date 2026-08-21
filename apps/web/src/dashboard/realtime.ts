import {
  DASHBOARD_EVENT_TYPES,
  isDashboardEvent,
  type DashboardEvent,
} from '@nexus-monitor/contracts';

export interface EventSourceLike {
  addEventListener(type: string, listener: EventListener): void;
  close(): void;
}

export interface DashboardEventHandlers {
  readonly onDisconnect: () => void;
  readonly onEvent: (event: DashboardEvent) => void;
  readonly onReady: () => void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

export function openDashboardEvents(
  handlers: DashboardEventHandlers,
  createEventSource: EventSourceFactory = (url) => new EventSource(url),
): () => void {
  const source = createEventSource('/api/v1/dashboard/events');
  source.addEventListener('ready', handlers.onReady);
  source.addEventListener('error', handlers.onDisconnect);

  const receive = (rawEvent: Event): void => {
    if (!(rawEvent instanceof MessageEvent)) {
      return;
    }

    try {
      const value: unknown = JSON.parse(String(rawEvent.data));
      if (isDashboardEvent(value)) {
        handlers.onEvent(value);
      }
    } catch {
      return;
    }
  };

  source.addEventListener(DASHBOARD_EVENT_TYPES.metric, receive);
  source.addEventListener(DASHBOARD_EVENT_TYPES.status, receive);
  return () => source.close();
}

