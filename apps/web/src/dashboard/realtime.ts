import {
  DASHBOARD_EVENT_TYPES,
  isDashboardEvent,
  type DashboardEvent,
} from '@nexus-monitor/contracts';

import { loadApiKey } from './api-key';

export interface DashboardEventHandlers {
  readonly onDisconnect: () => void;
  readonly onEvent: (event: DashboardEvent) => void;
  readonly onReady: () => void;
  readonly onUnauthorized: () => void;
}

const DASHBOARD_EVENTS_URL = '/api/v1/dashboard/events';
const FRAME_EVENT_TYPES: readonly string[] = [
  DASHBOARD_EVENT_TYPES.metric,
  DASHBOARD_EVENT_TYPES.status,
  DASHBOARD_EVENT_TYPES.alertOpened,
  DASHBOARD_EVENT_TYPES.alertResolved,
];
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;

export function openDashboardEvents(
  handlers: DashboardEventHandlers,
  fetcher: typeof fetch = fetch,
): () => void {
  let closed = false;
  let controller = new AbortController();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = INITIAL_RETRY_DELAY_MS;

  const connectionHandlers: DashboardEventHandlers = {
    ...handlers,
    onReady: () => {
      retryDelay = INITIAL_RETRY_DELAY_MS;
      handlers.onReady();
    },
  };

  const attempt = (): void => {
    void run(connectionHandlers, fetcher, controller).then((unauthorized) => {
      if (closed || unauthorized) {
        return;
      }

      retryTimer = setTimeout(() => {
        controller = new AbortController();
        attempt();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
    });
  };

  attempt();

  return () => {
    closed = true;
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
    }
    controller.abort();
  };
}

async function run(
  handlers: DashboardEventHandlers,
  fetcher: typeof fetch,
  controller: AbortController,
): Promise<boolean> {
  const apiKey = loadApiKey();
  const headers: Record<string, string> = apiKey
    ? { authorization: `Bearer ${apiKey}` }
    : {};

  try {
    const response = await fetcher(DASHBOARD_EVENTS_URL, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        handlers.onUnauthorized();
        return true;
      }
      handlers.onDisconnect();
      return false;
    }

    await readFrames(response, handlers);
    if (!controller.signal.aborted) {
      handlers.onDisconnect();
    }
    return false;
  } catch {
    if (!controller.signal.aborted) {
      handlers.onDisconnect();
    }
    return false;
  }
}

async function readFrames(
  response: Response,
  handlers: DashboardEventHandlers,
): Promise<void> {
  const body = response.body;
  if (!body) {
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      handleFrame(buffer.slice(0, separatorIndex), handlers);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');
    }
  }
}

function handleFrame(rawFrame: string, handlers: DashboardEventHandlers): void {
  let type: string | undefined;
  const dataLines: string[] = [];

  for (const line of rawFrame.split('\n')) {
    if (line.startsWith('event:')) {
      type = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  if (!type || type === 'keepalive') {
    return;
  }

  if (type === 'ready') {
    handlers.onReady();
    return;
  }

  if (!FRAME_EVENT_TYPES.includes(type)) {
    return;
  }

  try {
    const value: unknown = JSON.parse(dataLines.join('\n'));
    if (isDashboardEvent(value)) {
      handlers.onEvent(value);
    }
  } catch {
    return;
  }
}
