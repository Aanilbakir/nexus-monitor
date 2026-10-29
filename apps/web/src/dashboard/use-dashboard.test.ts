import type {
  DashboardAlertInstance,
  DashboardFleetSnapshot,
  DashboardHost,
} from '@nexus-monitor/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadApiKey, saveApiKey } from './api-key';
import { useDashboard } from './use-dashboard';

const apiKey = 'a-dashboard-api-key';

const host: DashboardHost = {
  agentId: '22222222-2222-4222-8222-222222222222',
  agentVersion: '0.1.0',
  architecture: 'x64',
  availability: 'online',
  hostname: 'web-prod-01',
  id: '11111111-1111-4111-8111-111111111111',
  lastSeenAt: '2026-08-21T10:00:00.000Z',
  latestMetric: null,
  platform: 'win32',
};

const snapshot: DashboardFleetSnapshot = {
  generatedAt: '2026-08-21T10:00:01.000Z',
  hosts: [host],
};

const openAlert: DashboardAlertInstance = {
  acknowledgedAt: null,
  agentId: host.agentId,
  id: '33333333-3333-4333-8333-333333333333',
  metric: 'cpuPercent',
  observedValue: 95,
  openedAt: '2026-08-21T10:00:00.000Z',
  ruleId: 'rule-1',
  ruleName: 'High CPU',
  severity: 'critical',
  state: 'OPEN',
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

function readyStreamResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('event: ready\ndata: {}\n\n'),
      );
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
    status: 200,
  });
}

function closingStreamResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('event: ready\ndata: {}\n\n'),
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
    status: 200,
  });
}

function openEventStream(): {
  controller: ReadableStreamDefaultController<Uint8Array>;
  response: Response;
} {
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      controller.enqueue(
        new TextEncoder().encode('event: ready\ndata: {}\n\n'),
      );
    },
  });
  return {
    controller: streamController,
    response: new Response(stream, {
      headers: { 'content-type': 'text/event-stream' },
      status: 200,
    }),
  };
}

function enqueueFrame(
  controller: ReadableStreamDefaultController<Uint8Array>,
  type: string,
  data: unknown,
): void {
  controller.enqueue(
    new TextEncoder().encode(
      `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
    ),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('useDashboard alerts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    saveApiKey(apiKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it('loads active alerts alongside the fleet snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          return Promise.resolve(readyStreamResponse());
        }
        if (url.includes('/api/v1/alerts')) {
          return Promise.resolve(jsonResponse({ alerts: [openAlert] }));
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.alerts).toEqual([openAlert]);
  });

  it('exposes an empty list when there are no active alerts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          return Promise.resolve(readyStreamResponse());
        }
        if (url.includes('/api/v1/alerts')) {
          return Promise.resolve(jsonResponse({ alerts: [] }));
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.alerts).toEqual([]);
  });

  it('adds an alert when an alert.opened frame arrives over the live connection', async () => {
    const { controller, response } = openEventStream();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          return Promise.resolve(response);
        }
        if (url.includes('/api/v1/alerts')) {
          return Promise.resolve(jsonResponse({ alerts: [] }));
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.alerts).toEqual([]);

    enqueueFrame(controller, 'alert.opened', {
      hostId: host.id,
      occurredAt: '2026-08-21T10:05:00.000Z',
      payload: {
        agentId: host.agentId,
        alertId: '66666666-6666-4666-8666-666666666666',
        metric: 'cpuPercent',
        observedValue: 97,
        ruleId: 'rule-1',
        ruleName: 'High CPU',
        severity: 'critical',
      },
      type: 'alert.opened',
      version: 1,
    });

    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    expect(result.current.alerts[0]).toMatchObject({
      id: '66666666-6666-4666-8666-666666666666',
      ruleId: 'rule-1',
      state: 'OPEN',
    });
  });

  it('acknowledges an alert that was added from a live alert.opened frame, using its real id', async () => {
    const { controller, response } = openEventStream();
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.includes('/dashboard/events')) {
        return Promise.resolve(response);
      }
      if (url.includes('/acknowledge')) {
        return Promise.resolve(jsonResponse({}));
      }
      if (url.includes('/api/v1/alerts')) {
        return Promise.resolve(jsonResponse({ alerts: [] }));
      }
      return Promise.resolve(jsonResponse(snapshot));
    });
    vi.stubGlobal('fetch', fetcher);

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));

    enqueueFrame(controller, 'alert.opened', {
      hostId: host.id,
      occurredAt: '2026-08-21T10:05:00.000Z',
      payload: {
        agentId: host.agentId,
        alertId: '66666666-6666-4666-8666-666666666666',
        metric: 'cpuPercent',
        observedValue: 97,
        ruleId: 'rule-1',
        ruleName: 'High CPU',
        severity: 'critical',
      },
      type: 'alert.opened',
      version: 1,
    });
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));

    act(() => result.current.acknowledgeAlert(result.current.alerts[0]!.id));

    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          requestUrl(input).includes(
            '/api/v1/alerts/66666666-6666-4666-8666-666666666666/acknowledge',
          ),
        ),
      ).toBe(true),
    );
    expect(result.current.alertAcknowledgeError).toBe(false);
    expect(result.current.alerts[0]?.state).toBe('ACKNOWLEDGED');
  });

  it('removes an alert when an alert.resolved frame arrives over the live connection', async () => {
    const { controller, response } = openEventStream();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          return Promise.resolve(response);
        }
        if (url.includes('/api/v1/alerts')) {
          return Promise.resolve(jsonResponse({ alerts: [openAlert] }));
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.alerts).toEqual([openAlert]));

    enqueueFrame(controller, 'alert.resolved', {
      hostId: host.id,
      occurredAt: '2026-08-21T10:06:00.000Z',
      payload: {
        agentId: openAlert.agentId,
        alertId: openAlert.id,
        metric: openAlert.metric,
        observedValue: 40,
        ruleId: openAlert.ruleId,
        ruleName: openAlert.ruleName,
        severity: openAlert.severity,
      },
      type: 'alert.resolved',
      version: 1,
    });

    await waitFor(() => expect(result.current.alerts).toEqual([]));
  });

  it('returns to the key screen when the active-alerts fetch is unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          return Promise.resolve(readyStreamResponse());
        }
        if (url.includes('/api/v1/alerts')) {
          return Promise.resolve(new Response('unauthorized', { status: 401 }));
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loadState).toBe('unauthorized'));
    expect(loadApiKey()).toBeNull();
  });

  it('acknowledges an alert optimistically and keeps it acknowledged on success', async () => {
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.includes('/dashboard/events')) {
        return Promise.resolve(readyStreamResponse());
      }
      if (url.includes('/acknowledge')) {
        return Promise.resolve(jsonResponse({}));
      }
      if (url.includes('/api/v1/alerts')) {
        return Promise.resolve(jsonResponse({ alerts: [openAlert] }));
      }
      return Promise.resolve(jsonResponse(snapshot));
    });
    vi.stubGlobal('fetch', fetcher);

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.alerts).toEqual([openAlert]));

    act(() => result.current.acknowledgeAlert(openAlert.id));
    expect(result.current.alerts[0]?.state).toBe('ACKNOWLEDGED');

    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          requestUrl(input).includes('/acknowledge'),
        ),
      ).toBe(true),
    );
    expect(result.current.alertAcknowledgeError).toBe(false);
    expect(result.current.alerts[0]?.state).toBe('ACKNOWLEDGED');
  });

  it('reverts the optimistic acknowledgement and surfaces an error on a generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          return Promise.resolve(readyStreamResponse());
        }
        if (url.includes('/acknowledge')) {
          return Promise.resolve(new Response('failed', { status: 503 }));
        }
        if (url.includes('/api/v1/alerts')) {
          return Promise.resolve(jsonResponse({ alerts: [openAlert] }));
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.alerts).toEqual([openAlert]));

    act(() => result.current.acknowledgeAlert(openAlert.id));
    expect(result.current.alerts[0]?.state).toBe('ACKNOWLEDGED');

    await waitFor(() =>
      expect(result.current.alertAcknowledgeError).toBe(true),
    );
    expect(result.current.alerts[0]?.state).toBe('OPEN');
  });

  it('refreshes the alert list instead of reverting when acknowledgement conflicts', async () => {
    const acknowledgedElsewhere: DashboardAlertInstance = {
      ...openAlert,
      acknowledgedAt: '2026-08-21T10:04:00.000Z',
      state: 'ACKNOWLEDGED',
    };
    let alertsCall = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          return Promise.resolve(readyStreamResponse());
        }
        if (url.includes('/acknowledge')) {
          return Promise.resolve(new Response('conflict', { status: 409 }));
        }
        if (url.includes('/api/v1/alerts')) {
          alertsCall += 1;
          return Promise.resolve(
            jsonResponse({
              alerts: alertsCall === 1 ? [openAlert] : [acknowledgedElsewhere],
            }),
          );
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.alerts).toEqual([openAlert]));

    act(() => result.current.acknowledgeAlert(openAlert.id));

    await waitFor(() =>
      expect(result.current.alerts).toEqual([acknowledgedElsewhere]),
    );
    expect(result.current.alertAcknowledgeError).toBe(false);
  });

  it('re-fetches active alerts once the live connection reconnects', async () => {
    const reopenedAlert: DashboardAlertInstance = {
      ...openAlert,
      id: '44444444-4444-4444-8444-444444444444',
      ruleId: 'rule-2',
      ruleName: 'High memory',
    };
    let eventsCall = 0;
    let alertsCall = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          eventsCall += 1;
          return Promise.resolve(
            eventsCall === 1 ? closingStreamResponse() : readyStreamResponse(),
          );
        }
        if (url.includes('/api/v1/alerts')) {
          alertsCall += 1;
          return Promise.resolve(
            jsonResponse({ alerts: alertsCall === 1 ? [] : [reopenedAlert] }),
          );
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.connection).toBe('reconnecting'));
    expect(alertsCall).toBe(1);

    await waitFor(() => expect(result.current.connection).toBe('live'), {
      timeout: 3000,
    });
    expect(alertsCall).toBe(2);
    expect(result.current.alerts).toEqual([reopenedAlert]);
  }, 10_000);

  it('keeps an alert that opens while a reconnect reconcile is still in flight', async () => {
    const reopenedAlert: DashboardAlertInstance = {
      ...openAlert,
      id: '77777777-7777-4777-8777-777777777777',
      observedValue: 97,
      openedAt: '2026-08-21T10:07:00.000Z',
      ruleId: 'rule-2',
      ruleName: 'High memory',
    };
    const second = openEventStream();
    let eventsCall = 0;
    let alertsCall = 0;
    let resolveSecondAlertsFetch: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          eventsCall += 1;
          return Promise.resolve(
            eventsCall === 1 ? closingStreamResponse() : second.response,
          );
        }
        if (url.includes('/api/v1/alerts')) {
          alertsCall += 1;
          if (alertsCall === 1) {
            return Promise.resolve(jsonResponse({ alerts: [] }));
          }
          return new Promise<Response>((resolve) => {
            resolveSecondAlertsFetch = () =>
              resolve(jsonResponse({ alerts: [] }));
          });
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.connection).toBe('reconnecting'));
    expect(alertsCall).toBe(1);

    await waitFor(() => expect(alertsCall).toBe(2), { timeout: 3000 });

    enqueueFrame(second.controller, 'alert.opened', {
      hostId: host.id,
      occurredAt: reopenedAlert.openedAt,
      payload: {
        agentId: host.agentId,
        alertId: reopenedAlert.id,
        metric: reopenedAlert.metric,
        observedValue: reopenedAlert.observedValue,
        ruleId: reopenedAlert.ruleId,
        ruleName: reopenedAlert.ruleName,
        severity: reopenedAlert.severity,
      },
      type: 'alert.opened',
      version: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The reconcile fetch has not resolved yet, so the empty snapshot it will
    // return must not be allowed to clobber the alert that just opened.
    expect(result.current.connection).toBe('reconnecting');

    resolveSecondAlertsFetch?.();

    await waitFor(() => expect(result.current.connection).toBe('live'), {
      timeout: 3000,
    });
    expect(result.current.alerts).toEqual([reopenedAlert]);
  }, 10_000);

  it('keeps an alert removed when it resolves while a reconnect reconcile is in flight, even though the stale fetch response still lists it as active', async () => {
    const second = openEventStream();
    let eventsCall = 0;
    let alertsCall = 0;
    let resolveSecondAlertsFetch: (() => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = requestUrl(input);
        if (url.includes('/dashboard/events')) {
          eventsCall += 1;
          return Promise.resolve(
            eventsCall === 1 ? closingStreamResponse() : second.response,
          );
        }
        if (url.includes('/api/v1/alerts')) {
          alertsCall += 1;
          if (alertsCall === 1) {
            return Promise.resolve(jsonResponse({ alerts: [openAlert] }));
          }
          return new Promise<Response>((resolve) => {
            resolveSecondAlertsFetch = () =>
              resolve(jsonResponse({ alerts: [openAlert] }));
          });
        }
        return Promise.resolve(jsonResponse(snapshot));
      }),
    );

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.connection).toBe('reconnecting'));
    expect(alertsCall).toBe(1);

    await waitFor(() => expect(alertsCall).toBe(2), { timeout: 3000 });

    enqueueFrame(second.controller, 'alert.resolved', {
      hostId: host.id,
      occurredAt: '2026-08-21T10:08:00.000Z',
      payload: {
        agentId: openAlert.agentId,
        alertId: openAlert.id,
        metric: openAlert.metric,
        observedValue: 40,
        ruleId: openAlert.ruleId,
        ruleName: openAlert.ruleName,
        severity: openAlert.severity,
      },
      type: 'alert.resolved',
      version: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    resolveSecondAlertsFetch?.();

    await waitFor(() => expect(result.current.connection).toBe('live'), {
      timeout: 3000,
    });
    expect(result.current.alerts).toEqual([]);
  }, 10_000);

  it('ties the 409-conflict refresh fetch to the hook abort/unmount cleanup', async () => {
    let refreshSignal: AbortSignal | undefined;
    let acknowledgeCalls = 0;
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (url.includes('/dashboard/events')) {
        return Promise.resolve(readyStreamResponse());
      }
      if (url.includes('/acknowledge')) {
        acknowledgeCalls += 1;
        return Promise.resolve(new Response('conflict', { status: 409 }));
      }
      if (url.includes('/api/v1/alerts')) {
        if (acknowledgeCalls > 0) {
          refreshSignal = init?.signal ?? undefined;
          return new Promise<Response>(() => {
            /* never resolves: the refresh is still in flight at unmount */
          });
        }
        return Promise.resolve(jsonResponse({ alerts: [openAlert] }));
      }
      return Promise.resolve(jsonResponse(snapshot));
    });
    vi.stubGlobal('fetch', fetcher);

    const { result, unmount } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.alerts).toEqual([openAlert]));

    act(() => result.current.acknowledgeAlert(openAlert.id));

    await waitFor(() => expect(refreshSignal).toBeDefined());
    expect(refreshSignal?.aborted).toBe(false);

    unmount();

    expect(refreshSignal?.aborted).toBe(true);
  });
});
