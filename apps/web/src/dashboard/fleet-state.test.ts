import type {
  DashboardFleetSnapshot,
  DashboardHost,
} from '@nexus-monitor/contracts';
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
    expect(
      reduceFleet(createFleetState(), { type: 'snapshot', snapshot }),
    ).toEqual({
      alerts: [],
      generatedAt: snapshot.generatedAt,
      hosts: [host],
    });
  });

  it('merges a status event into only its known host', () => {
    const state = reduceFleet(createFleetState(), {
      type: 'snapshot',
      snapshot,
    });
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
    const state = reduceFleet(createFleetState(), {
      type: 'snapshot',
      snapshot,
    });
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

describe('reduceFleet alerts', () => {
  const alertPayload = {
    agentId: host.agentId,
    alertId: '55555555-5555-4555-8555-555555555555',
    metric: 'cpuPercent',
    observedValue: 95,
    ruleId: 'rule-1',
    ruleName: 'High CPU',
    severity: 'critical',
  };

  it('replaces the alert list on an "alerts" action, newest first', () => {
    const state = reduceFleet(createFleetState(), {
      alerts: [
        {
          acknowledgedAt: null,
          agentId: host.agentId,
          id: 'a',
          metric: 'cpuPercent',
          observedValue: 90,
          openedAt: '2026-08-21T09:00:00.000Z',
          ruleId: 'rule-1',
          ruleName: 'High CPU',
          severity: 'warning',
          state: 'OPEN',
        },
        {
          acknowledgedAt: null,
          agentId: host.agentId,
          id: 'b',
          metric: 'memoryUsedPercent',
          observedValue: 95,
          openedAt: '2026-08-21T10:00:00.000Z',
          ruleId: 'rule-2',
          ruleName: 'High memory',
          severity: 'critical',
          state: 'OPEN',
        },
      ],
      type: 'alerts',
    });

    expect(state.alerts.map((alert) => alert.id)).toEqual(['b', 'a']);
  });

  it('adds an alert on alert.opened, deriving its fields from the transition payload', () => {
    const state = reduceFleet(createFleetState(), {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:00.000Z',
        payload: alertPayload,
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });

    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0]).toMatchObject({
      acknowledgedAt: null,
      agentId: alertPayload.agentId,
      id: alertPayload.alertId,
      metric: alertPayload.metric,
      observedValue: alertPayload.observedValue,
      openedAt: '2026-08-21T10:00:00.000Z',
      ruleId: alertPayload.ruleId,
      ruleName: alertPayload.ruleName,
      severity: alertPayload.severity,
      state: 'OPEN',
    });
  });

  it('uses the real alert instance id from the payload, not a synthetic one', () => {
    const state = reduceFleet(createFleetState(), {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:00.000Z',
        payload: alertPayload,
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });

    expect(state.alerts[0]?.id).toBe(alertPayload.alertId);
  });

  it('keeps newly opened alerts first', () => {
    const first = reduceFleet(createFleetState(), {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:00.000Z',
        payload: alertPayload,
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });
    const second = reduceFleet(first, {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:05:00.000Z',
        payload: { ...alertPayload, ruleId: 'rule-2', ruleName: 'High memory' },
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });

    expect(second.alerts.map((alert) => alert.ruleId)).toEqual([
      'rule-2',
      'rule-1',
    ]);
  });

  it('replaces an already-open alert for the same rule and agent instead of duplicating it', () => {
    const first = reduceFleet(createFleetState(), {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:00.000Z',
        payload: alertPayload,
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });
    const second = reduceFleet(first, {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:10:00.000Z',
        payload: { ...alertPayload, observedValue: 99 },
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });

    expect(second.alerts).toHaveLength(1);
    expect(second.alerts[0]?.observedValue).toBe(99);
  });

  it('removes the matching alert on alert.resolved', () => {
    const opened = reduceFleet(createFleetState(), {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:00.000Z',
        payload: alertPayload,
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });
    const resolved = reduceFleet(opened, {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:15:00.000Z',
        payload: alertPayload,
        type: 'alert.resolved',
        version: 1,
      },
      type: 'event',
    });

    expect(resolved.alerts).toHaveLength(0);
  });

  it('ignores alert.resolved for a rule/agent pair with no active alert', () => {
    const state = reduceFleet(createFleetState(), {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:00.000Z',
        payload: alertPayload,
        type: 'alert.resolved',
        version: 1,
      },
      type: 'event',
    });

    expect(state.alerts).toHaveLength(0);
  });

  it('marks an alert ACKNOWLEDGED optimistically and can revert it back to OPEN', () => {
    const opened = reduceFleet(createFleetState(), {
      event: {
        hostId: host.id,
        occurredAt: '2026-08-21T10:00:00.000Z',
        payload: alertPayload,
        type: 'alert.opened',
        version: 1,
      },
      type: 'event',
    });
    const id = opened.alerts[0]!.id;

    const acknowledged = reduceFleet(opened, {
      id,
      type: 'alert-acknowledge-start',
    });
    expect(acknowledged.alerts[0]?.state).toBe('ACKNOWLEDGED');

    const reverted = reduceFleet(acknowledged, {
      id,
      type: 'alert-acknowledge-revert',
    });
    expect(reverted.alerts[0]?.state).toBe('OPEN');
  });
});
