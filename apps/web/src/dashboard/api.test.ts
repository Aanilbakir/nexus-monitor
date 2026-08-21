import type {
  DashboardFleetSnapshot,
  DashboardHistoryResponse,
} from '@nexus-monitor/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  DashboardRequestError,
  fetchFleetSnapshot,
  fetchHostHistory,
} from './api';

const snapshot: DashboardFleetSnapshot = {
  generatedAt: '2026-08-21T10:00:00.000Z',
  hosts: [],
};

describe('fetchFleetSnapshot', () => {
  it('returns a valid current snapshot', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      fetchFleetSnapshot(controller.signal, fetcher),
    ).resolves.toEqual(snapshot);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/dashboard/hosts', {
      signal: controller.signal,
    });
  });

  it.each([
    new Response('unavailable', { status: 503 }),
    new Response(JSON.stringify({ generatedAt: 'invalid', hosts: {} }), {
      status: 200,
    }),
  ])('rejects failed or malformed responses', async (response) => {
    await expect(
      fetchFleetSnapshot(
        new AbortController().signal,
        vi.fn().mockResolvedValue(response),
      ),
    ).rejects.toBeInstanceOf(DashboardRequestError);
  });
});

const history: DashboardHistoryResponse = {
  bucketSeconds: 900,
  endAt: '2026-08-21T10:00:00.000Z',
  hostId: '11111111-1111-4111-8111-111111111111',
  points: [],
  range: '24h',
  startAt: '2026-08-20T10:00:00.000Z',
};

describe('fetchHostHistory', () => {
  it('requests and validates the selected host range', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(history), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      fetchHostHistory(history.hostId, '24h', controller.signal, fetcher),
    ).resolves.toEqual(history);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/dashboard/hosts/${history.hostId}/history?range=24h`,
      { signal: controller.signal },
    );
  });

  it.each([
    new Response('unavailable', { status: 503 }),
    new Response(JSON.stringify({ ...history, range: '90d' }), {
      status: 200,
    }),
  ])('rejects failed or malformed history', async (response) => {
    await expect(
      fetchHostHistory(
        history.hostId,
        '24h',
        new AbortController().signal,
        vi.fn().mockResolvedValue(response),
      ),
    ).rejects.toBeInstanceOf(DashboardRequestError);
  });
});
