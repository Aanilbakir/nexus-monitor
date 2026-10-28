import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  DashboardFleetSnapshot,
  DashboardHistoryResponse,
} from '@nexus-monitor/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';
import {
  DASHBOARD_API_KEY_STORAGE_KEY,
  loadApiKey,
  saveApiKey,
} from './dashboard/api-key';
import { LANGUAGE_STORAGE_KEY } from './i18n/language';
import { messages } from './i18n/messages';

const apiKey = 'a-dashboard-api-key';

const snapshot: DashboardFleetSnapshot = {
  generatedAt: '2026-08-21T10:00:01.000Z',
  hosts: [
    {
      agentId: '22222222-2222-4222-8222-222222222222',
      agentVersion: '0.1.0',
      architecture: 'x64',
      availability: 'online',
      hostname: 'web-prod-01',
      id: '11111111-1111-4111-8111-111111111111',
      lastSeenAt: '2026-08-21T10:00:00.000Z',
      latestMetric: {
        collectedAt: '2026-08-21T09:59:59.000Z',
        cpuPercent: 24.5,
        diskFreeBytes: '400000000000',
        diskTotalBytes: '1000000000000',
        diskUsedBytes: '600000000000',
        memoryTotalBytes: '16000000000',
        memoryUsedBytes: '8000000000',
        networkReceivedBytes: '2000000000',
        networkTransmittedBytes: '1500000000',
        uptimeSeconds: '3600',
      },
      platform: 'win32',
    },
  ],
};

const history: DashboardHistoryResponse = {
  bucketSeconds: 900,
  endAt: '2026-08-21T10:00:00.000Z',
  hostId: snapshot.hosts[0]!.id,
  points: [
    {
      bucketAt: '2026-08-21T09:45:00.000Z',
      cpuPercent: 25,
      diskUsedPercent: 60,
      memoryUsedPercent: 50,
      networkReceivedBytes: '2048',
      networkTransmittedBytes: '1024',
    },
  ],
  range: '24h',
  startAt: '2026-08-20T10:00:00.000Z',
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

function requestHeader(
  init: RequestInit | undefined,
  name: string,
): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.[name];
}

function readyStreamResponse(): Response {
  // Left open deliberately: the real SSE endpoint never closes the stream
  // while connected (it relies on keepalive frames instead). Closing the
  // body here would make `realtime.ts` treat the ready frame as an
  // immediate disconnect, which does not reflect a live connection.
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

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it('loads the fleet, routes to its first host, and switches the global language', async () => {
    saveApiKey(apiKey);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        if (requestUrl(input).includes('/dashboard/events')) {
          return Promise.resolve(readyStreamResponse());
        }
        return Promise.resolve(
          new Response(JSON.stringify(snapshot), {
            headers: { 'content-type': 'application/json' },
            status: 200,
          }),
        );
      }),
    );

    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading monitored hosts',
    );
    expect(
      await screen.findByRole('heading', { name: 'web-prod-01' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe(
      '/hosts/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText('24.5%')).toBeVisible();

    await waitFor(() => expect(screen.getByText('Live')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Türkçe' }));
    expect(screen.getAllByText('Çevrimiçi').length).toBeGreaterThan(0);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('tr');
  });

  it('renders an honest empty fleet state', async () => {
    saveApiKey(apiKey);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        if (requestUrl(input).includes('/dashboard/events')) {
          return Promise.resolve(readyStreamResponse());
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ...snapshot, hosts: [] }), {
            status: 200,
          }),
        );
      }),
    );

    render(<App />);

    expect(await screen.findByText('No monitored hosts')).toBeVisible();
    expect(
      screen.getByText('Enroll and connect an agent to begin monitoring.'),
    ).toBeVisible();
  });

  it('keeps current telemetry available while host history loads', async () => {
    saveApiKey(apiKey);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    let resolveHistory: (response: Response) => void = () => undefined;
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.includes('/dashboard/events')) {
        return Promise.resolve(readyStreamResponse());
      }
      if (url.includes('/history?')) {
        return new Promise<Response>((resolve) => {
          resolveHistory = resolve;
        });
      }
      return Promise.resolve(
        new Response(JSON.stringify(snapshot), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetcher);

    render(<App />);

    expect(await screen.findByText('24.5%')).toBeVisible();
    expect(screen.getByText('Loading historical metrics')).toBeVisible();
    resolveHistory(
      new Response(JSON.stringify(history), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    expect(
      await screen.findByRole('figure', { name: 'Utilization' }),
    ).toBeVisible();
  });

  it('shows a retry action when the snapshot cannot be loaded', async () => {
    saveApiKey(apiKey);
    let snapshotCalls = 0;
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url.includes('/dashboard/events')) {
        return Promise.resolve(readyStreamResponse());
      }
      snapshotCalls += 1;
      if (snapshotCalls === 1) {
        return Promise.resolve(new Response('unavailable', { status: 503 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ...snapshot, hosts: [] }), {
          status: 200,
        }),
      );
    });
    vi.stubGlobal('fetch', fetcher);

    render(<App />);

    expect(await screen.findByText('Dashboard unavailable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No monitored hosts')).toBeVisible();
    expect(snapshotCalls).toBe(2);
  });

  it('shows the key screen when no key is stored and does not call the API', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    render(<App />);

    expect(screen.getByLabelText(messages.en.apiKeyLabel)).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('stores an entered key and loads the dashboard using it as the bearer header', async () => {
    const fetcher = vi.fn<typeof fetch>((input) => {
      if (requestUrl(input).includes('/dashboard/events')) {
        return Promise.resolve(readyStreamResponse());
      }
      return Promise.resolve(
        new Response(JSON.stringify(snapshot), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetcher);

    render(<App />);
    fireEvent.change(screen.getByLabelText(messages.en.apiKeyLabel), {
      target: { value: apiKey },
    });
    fireEvent.click(
      screen.getByRole('button', { name: messages.en.apiKeySubmit }),
    );

    expect(
      await screen.findByRole('heading', { name: 'web-prod-01' }),
    ).toBeVisible();
    expect(loadApiKey()).toBe(apiKey);
    const hostsCall = fetcher.mock.calls.find(([input]) =>
      requestUrl(input).includes('/dashboard/hosts'),
    );
    expect(requestHeader(hostsCall?.[1], 'authorization')).toBe(
      `Bearer ${apiKey}`,
    );
  });

  it('clears the stored key and returns to the key screen after an unauthorized response', async () => {
    saveApiKey(apiKey);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response('unauthorized', { status: 401 })),
      ),
    );

    render(<App />);

    expect(await screen.findByLabelText(messages.en.apiKeyLabel)).toBeVisible();
    expect(
      window.sessionStorage.getItem(DASHBOARD_API_KEY_STORAGE_KEY),
    ).toBeNull();
  });
});
