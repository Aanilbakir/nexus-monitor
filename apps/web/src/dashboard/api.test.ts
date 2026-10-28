import type {
  DashboardAlertInstance,
  DashboardFleetSnapshot,
  DashboardHistoryResponse,
} from '@nexus-monitor/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeAlert,
  DashboardRequestError,
  DashboardUnauthorizedError,
  fetchActiveAlerts,
  fetchFleetSnapshot,
  fetchHostHistory,
} from './api';
import { saveApiKey } from './api-key';

const apiKey = 'a-dashboard-api-key';

const snapshot: DashboardFleetSnapshot = {
  generatedAt: '2026-08-21T10:00:00.000Z',
  hosts: [],
};

beforeEach(() => {
  saveApiKey(apiKey);
});

afterEach(() => {
  window.sessionStorage.clear();
});

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
      headers: { authorization: `Bearer ${apiKey}` },
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

  it('rejects with a distinguishable error on an unauthorized response', async () => {
    await expect(
      fetchFleetSnapshot(
        new AbortController().signal,
        vi
          .fn()
          .mockResolvedValue(new Response('unauthorized', { status: 401 })),
      ),
    ).rejects.toBeInstanceOf(DashboardUnauthorizedError);
  });

  it('sends no authorization header when no key is stored', async () => {
    window.sessionStorage.clear();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(snapshot), { status: 200 }),
      );

    await fetchFleetSnapshot(new AbortController().signal, fetcher);

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({});
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
      {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
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

  it('rejects with a distinguishable error on an unauthorized response', async () => {
    await expect(
      fetchHostHistory(
        history.hostId,
        '24h',
        new AbortController().signal,
        vi
          .fn()
          .mockResolvedValue(new Response('unauthorized', { status: 401 })),
      ),
    ).rejects.toBeInstanceOf(DashboardUnauthorizedError);
  });
});

const activeAlert: DashboardAlertInstance = {
  acknowledgedAt: null,
  agentId: '22222222-2222-4222-8222-222222222222',
  id: '11111111-1111-4111-8111-111111111111',
  metric: 'cpuPercent',
  observedValue: 95,
  openedAt: '2026-08-21T10:00:00.000Z',
  ruleId: 'rule-1',
  ruleName: 'High CPU',
  severity: 'critical',
  state: 'OPEN',
};

describe('fetchActiveAlerts', () => {
  it('returns the active alert list', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ alerts: [activeAlert] }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      fetchActiveAlerts(controller.signal, fetcher),
    ).resolves.toEqual([activeAlert]);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/alerts', {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
  });

  it.each([
    new Response('unavailable', { status: 503 }),
    new Response(JSON.stringify({ alerts: [{ ...activeAlert, state: 'X' }] }), {
      status: 200,
    }),
  ])('rejects failed or malformed responses', async (response) => {
    await expect(
      fetchActiveAlerts(
        new AbortController().signal,
        vi.fn().mockResolvedValue(response),
      ),
    ).rejects.toBeInstanceOf(DashboardRequestError);
  });

  it('rejects with a distinguishable error on an unauthorized response', async () => {
    await expect(
      fetchActiveAlerts(
        new AbortController().signal,
        vi
          .fn()
          .mockResolvedValue(new Response('unauthorized', { status: 401 })),
      ),
    ).rejects.toBeInstanceOf(DashboardUnauthorizedError);
  });
});

describe('acknowledgeAlert', () => {
  it('posts to the acknowledge endpoint with the stored key', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          acknowledgedAt: '2026-08-21T10:05:00.000Z',
          id: activeAlert.id,
          state: 'ACKNOWLEDGED',
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );

    await acknowledgeAlert(activeAlert.id, fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/alerts/${activeAlert.id}/acknowledge`,
      {
        headers: { authorization: `Bearer ${apiKey}` },
        method: 'POST',
      },
    );
  });

  it('rejects with a distinguishable error on an unauthorized response', async () => {
    await expect(
      acknowledgeAlert(
        activeAlert.id,
        vi
          .fn()
          .mockResolvedValue(new Response('unauthorized', { status: 401 })),
      ),
    ).rejects.toBeInstanceOf(DashboardUnauthorizedError);
  });

  it.each([404, 409, 503])(
    'rejects a failed acknowledge response with status %i',
    async (status) => {
      await expect(
        acknowledgeAlert(
          activeAlert.id,
          vi.fn().mockResolvedValue(new Response('failed', { status })),
        ),
      ).rejects.toBeInstanceOf(DashboardRequestError);
    },
  );
});
