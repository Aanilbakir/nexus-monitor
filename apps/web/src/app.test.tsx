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
import { LANGUAGE_STORAGE_KEY } from './i18n/language';

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

class FakeEventSource {
  public static latest: FakeEventSource | null = null;
  private readonly listeners = new Map<string, EventListener>();

  public constructor(public readonly url: string) {
    FakeEventSource.latest = this;
  }

  public addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }

  public close(): void {}

  public emit(type: string, data = ''): void {
    this.listeners.get(type)?.(new MessageEvent(type, { data }));
  }
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    FakeEventSource.latest = null;
  });

  it('loads the fleet, routes to its first host, and switches the global language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(snapshot), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      ),
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

    FakeEventSource.latest?.emit('ready', '{}');
    await waitFor(() => expect(screen.getByText('Live')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Türkçe' }));
    expect(screen.getAllByText('Çevrimiçi').length).toBeGreaterThan(0);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('tr');
  });

  it('renders an honest empty fleet state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...snapshot, hosts: [] }), {
          status: 200,
        }),
      ),
    );

    render(<App />);

    expect(await screen.findByText('No monitored hosts')).toBeVisible();
    expect(
      screen.getByText('Enroll and connect an agent to begin monitoring.'),
    ).toBeVisible();
  });

  it('keeps current telemetry available while host history loads', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    let resolveHistory: (response: Response) => void = () => undefined;
    const fetcher = vi.fn<typeof fetch>((input) => {
      if (requestUrl(input).includes('/history?')) {
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
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...snapshot, hosts: [] }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetcher);

    render(<App />);

    expect(await screen.findByText('Dashboard unavailable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No monitored hosts')).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
