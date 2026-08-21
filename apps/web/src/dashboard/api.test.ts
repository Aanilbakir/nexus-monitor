import type { DashboardFleetSnapshot } from '@nexus-monitor/contracts';
import { describe, expect, it, vi } from 'vitest';

import { DashboardRequestError, fetchFleetSnapshot } from './api';

const snapshot: DashboardFleetSnapshot = {
  generatedAt: '2026-08-21T10:00:00.000Z',
  hosts: [],
};

describe('fetchFleetSnapshot', () => {
  it('returns a valid current snapshot', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      fetchFleetSnapshot(new AbortController().signal, fetcher),
    ).resolves.toEqual(snapshot);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/dashboard/hosts', {
      signal: expect.any(AbortSignal),
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

