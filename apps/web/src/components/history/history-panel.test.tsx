import type { DashboardHistoryResponse } from '@nexus-monitor/contracts';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { messages } from '../../i18n/messages';
import { HistoryPanel } from './history-panel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const hostId = '11111111-1111-4111-8111-111111111111';
const history: DashboardHistoryResponse = {
  bucketSeconds: 900,
  endAt: '2026-08-21T10:00:00.000Z',
  hostId,
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

describe('HistoryPanel', () => {
  it('renders three chart groups and requests a newly selected range', async () => {
    const fetcher = vi.fn<typeof fetch>((input) => {
      const range = requestUrl(input).includes('range=1h') ? '1h' : '24h';
      return Promise.resolve(
        new Response(JSON.stringify({ ...history, range }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetcher);

    render(<HistoryPanel copy={messages.en} hostId={hostId} language="en" />);

    expect(
      await screen.findByRole('figure', { name: 'Utilization' }),
    ).toBeVisible();
    expect(screen.getByRole('figure', { name: 'Disk usage' })).toBeVisible();
    expect(
      screen.getByRole('figure', { name: 'Network traffic' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '24 hours' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: '1 hour' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const [input, init] = fetcher.mock.lastCall ?? [];
    expect(input).toBe(`/api/v1/dashboard/hosts/${hostId}/history?range=1h`);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps errors local and retries the history request', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(history), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetcher);

    render(<HistoryPanel copy={messages.en} hostId={hostId} language="en" />);

    expect(await screen.findByText('History unavailable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry history' }));
    expect(
      await screen.findByRole('figure', { name: 'Utilization' }),
    ).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('shows a distinct empty history state in Turkish', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ...history, points: [] }), {
          status: 200,
        }),
      ),
    );

    render(<HistoryPanel copy={messages.tr} hostId={hostId} language="tr" />);

    expect(await screen.findByText('Geçmiş veri yok')).toBeVisible();
    expect(screen.getByRole('button', { name: '24 saat' })).toBeVisible();
  });
});
