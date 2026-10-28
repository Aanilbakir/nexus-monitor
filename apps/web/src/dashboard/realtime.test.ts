import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveApiKey } from './api-key';
import { openDashboardEvents } from './realtime';

const apiKey = 'a-dashboard-api-key';

function streamResponse(body: string, status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
    status,
  });
}

function frame(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
}

beforeEach(() => {
  saveApiKey(apiKey);
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('openDashboardEvents', () => {
  it('sends the stored key as a bearer header and never places it in the URL', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(streamResponse(frame('ready', {})));

    openDashboardEvents(
      {
        onDisconnect: vi.fn(),
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('/api/v1/dashboard/events');
    expect(url).not.toContain(apiKey);
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${apiKey}`,
    );
  });

  it('parses ready, host.status, and host.metric frames into the same handler calls the UI uses today', async () => {
    const statusEvent = {
      hostId: '11111111-1111-4111-8111-111111111111',
      occurredAt: '2026-08-21T10:00:00.000Z',
      payload: {
        availability: 'online',
        lastSeenAt: '2026-08-21T10:00:00.000Z',
      },
      type: 'host.status',
      version: 1,
    };
    const metricEvent = {
      hostId: '11111111-1111-4111-8111-111111111111',
      occurredAt: '2026-08-21T10:00:05.000Z',
      payload: {
        collectedAt: '2026-08-21T10:00:05.000Z',
        cpuPercent: 10,
        diskFreeBytes: '1',
        diskTotalBytes: '2',
        diskUsedBytes: '1',
        memoryTotalBytes: '2',
        memoryUsedBytes: '1',
        networkReceivedBytes: '1',
        networkTransmittedBytes: '1',
        uptimeSeconds: '1',
      },
      type: 'host.metric',
      version: 1,
    };
    const body =
      frame('ready', {}) +
      frame('host.status', statusEvent) +
      frame('keepalive', '') +
      frame('host.metric', metricEvent) +
      frame('host.status', '{bad json');
    const fetcher = vi.fn().mockResolvedValue(streamResponse(body));
    const onEvent = vi.fn();
    const onReady = vi.fn();

    openDashboardEvents(
      { onDisconnect: vi.fn(), onEvent, onReady, onUnauthorized: vi.fn() },
      fetcher,
    );

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(2));
    expect(onEvent).toHaveBeenCalledWith(statusEvent);
    expect(onEvent).toHaveBeenCalledWith(metricEvent);
  });

  it('reports disconnection when the stream ends', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(streamResponse(frame('ready', {})));
    const onDisconnect = vi.fn();

    openDashboardEvents(
      {
        onDisconnect,
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    await vi.waitFor(() => expect(onDisconnect).toHaveBeenCalledOnce());
  });

  it('reports disconnection when the response is not ok', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('unavailable', { status: 503 }));
    const onDisconnect = vi.fn();
    const onUnauthorized = vi.fn();

    openDashboardEvents(
      { onDisconnect, onEvent: vi.fn(), onReady: vi.fn(), onUnauthorized },
      fetcher,
    );

    await vi.waitFor(() => expect(onDisconnect).toHaveBeenCalledOnce());
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports unauthorized distinctly from a generic disconnect on a 401 response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('unauthorized', { status: 401 }));
    const onDisconnect = vi.fn();
    const onUnauthorized = vi.fn();

    openDashboardEvents(
      { onDisconnect, onEvent: vi.fn(), onReady: vi.fn(), onUnauthorized },
      fetcher,
    );

    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it('aborts the underlying request when closed', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(streamResponse(frame('ready', {})));

    const close = openDashboardEvents(
      {
        onDisconnect: vi.fn(),
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    close();

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });
});

describe('openDashboardEvents reconnect behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries with ~1s backoff after the stream ends and calls onReady again once reconnected', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(streamResponse(frame('ready', {})))
      .mockResolvedValueOnce(streamResponse(frame('ready', {})));
    const onDisconnect = vi.fn();
    const onReady = vi.fn();

    openDashboardEvents(
      { onDisconnect, onEvent: vi.fn(), onReady, onUnauthorized: vi.fn() },
      fetcher,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onReady).toHaveBeenCalledTimes(2);
  });

  it('retries after a network error', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(streamResponse(frame('ready', {})));
    const onDisconnect = vi.fn();
    const onReady = vi.fn();

    openDashboardEvents(
      { onDisconnect, onEvent: vi.fn(), onReady, onUnauthorized: vi.fn() },
      fetcher,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('does not retry after a 401 response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('unauthorized', { status: 401 }));
    const onUnauthorized = vi.fn();

    openDashboardEvents(
      {
        onDisconnect: vi.fn(),
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized,
      },
      fetcher,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(35_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('caps the reconnect backoff and keeps retrying on repeated disconnects', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(streamResponse(frame('ready', {}))),
      );

    openDashboardEvents(
      {
        onDisconnect: vi.fn(),
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await vi.advanceTimersByTimeAsync(40_000);
    }

    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(7);
  });

  it('cancels a pending reconnect timer when closed', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(streamResponse(frame('ready', {})));
    const onDisconnect = vi.fn();

    const close = openDashboardEvents(
      {
        onDisconnect,
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onDisconnect).toHaveBeenCalledTimes(1);

    close();

    await vi.advanceTimersByTimeAsync(35_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight retry request when closed', async () => {
    function openStream(): Response {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(frame('ready', {})));
        },
      });
      return new Response(stream, {
        headers: { 'content-type': 'text/event-stream' },
        status: 200,
      });
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(streamResponse(frame('ready', {})))
      .mockResolvedValueOnce(openStream());

    const close = openDashboardEvents(
      {
        onDisconnect: vi.fn(),
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    close();

    const [, init] = fetcher.mock.calls[1] as [string, RequestInit];
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it('resets the retry backoff to the initial delay after a successful connection, even after earlier quick disconnects grew it', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(streamResponse(''))
      .mockResolvedValueOnce(streamResponse(''))
      .mockResolvedValueOnce(streamResponse(frame('ready', {})))
      .mockResolvedValueOnce(streamResponse(frame('ready', {})));
    const onReady = vi.fn();

    openDashboardEvents(
      {
        onDisconnect: vi.fn(),
        onEvent: vi.fn(),
        onReady,
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    // Two quick disconnects (no ready frame) grow the backoff: 1s, then 2s.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Third attempt connects successfully (ready), then drops.
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onReady).toHaveBeenCalledTimes(1);

    // Without a reset, the next retry would wait for the grown ~4s delay.
    // With the fix, a successful connection resets it back to ~1s.
    await vi.advanceTimersByTimeAsync(999);
    expect(fetcher).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('reuses the stored key header on retry, reflecting the latest saved key', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(streamResponse(frame('ready', {})))
      .mockResolvedValueOnce(streamResponse(frame('ready', {})));

    openDashboardEvents(
      {
        onDisconnect: vi.fn(),
        onEvent: vi.fn(),
        onReady: vi.fn(),
        onUnauthorized: vi.fn(),
      },
      fetcher,
    );

    await vi.advanceTimersByTimeAsync(0);
    saveApiKey('a-different-dashboard-api-key');

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [, init] = fetcher.mock.calls[1] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer a-different-dashboard-api-key',
    );
  });
});
