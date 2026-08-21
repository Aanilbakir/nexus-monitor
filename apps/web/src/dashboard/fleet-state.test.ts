import type { DashboardFleetSnapshot, DashboardHost } from '@nexus-monitor/contracts';
import { describe, expect, it } from 'vitest';

import { createFleetState, reduceFleet } from './fleet-state';

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

describe('reduceFleet', () => {
  it('replaces state with a reconciled snapshot', () => {
    expect(reduceFleet(createFleetState(), { type: 'snapshot', snapshot })).toEqual({
      generatedAt: snapshot.generatedAt,
      hosts: [host],
    });
  });

  it('merges a status event into only its known host', () => {
    const state = reduceFleet(createFleetState(), { type: 'snapshot', snapshot });
    const next = reduceFleet(state, {
      type: 'event',
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:46.000Z',
        payload: { availability: 'offline', lastSeenAt: host.lastSeenAt },
        type: 'host.status',
        version: 1,
      },
    });

    expect(next.hosts[0]?.availability).toBe('offline');
    expect(next.generatedAt).toBe('2026-08-21T10:00:46.000Z');
  });

  it('ignores events for hosts absent from the reconciled snapshot', () => {
    const state = reduceFleet(createFleetState(), { type: 'snapshot', snapshot });
    expect(
      reduceFleet(state, {
        type: 'event',
        event: {
          hostId: '33333333-3333-4333-8333-333333333333',
          occurredAt: '2026-08-21T10:00:02.000Z',
          payload: { availability: 'offline', lastSeenAt: null },
          type: 'host.status',
          version: 1,
        },
      }),
    ).toBe(state);
  });
});

