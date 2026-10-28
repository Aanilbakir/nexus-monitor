import {
  HISTORY_RANGES,
  isDashboardEvent,
  isDashboardHistoryResponse,
  type DashboardEvent,
  type DashboardHistoryResponse,
  type DashboardMetric,
} from './dashboard.js';

const metric: DashboardMetric = {
  collectedAt: '2026-08-21T10:00:00.000Z',
  cpuPercent: 24.5,
  diskFreeBytes: '400',
  diskTotalBytes: '1000',
  diskUsedBytes: '600',
  memoryTotalBytes: '1000',
  memoryUsedBytes: '610',
  networkReceivedBytes: '2000',
  networkTransmittedBytes: '1500',
  uptimeSeconds: '3600',
};

const alertPayload = {
  agentId: '22222222-2222-4222-8222-222222222222',
  metric: 'cpuPercent',
  observedValue: 97.5,
  ruleId: '33333333-3333-4333-8333-333333333333',
  ruleName: 'High CPU',
  severity: 'critical',
};

describe('isDashboardEvent', () => {
  it.each<DashboardEvent>([
    {
      version: 1,
      type: 'host.metric',
      hostId: 'd35f02d8-9aa8-4f6f-a8f0-079f2f0d05ba',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: metric,
    },
    {
      version: 1,
      type: 'host.status',
      hostId: 'd35f02d8-9aa8-4f6f-a8f0-079f2f0d05ba',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: {
        availability: 'offline',
        lastSeenAt: '2026-08-21T09:59:15.000Z',
      },
    },
    {
      version: 1,
      type: 'alert.opened',
      hostId: 'd35f02d8-9aa8-4f6f-a8f0-079f2f0d05ba',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: alertPayload,
    },
    {
      version: 1,
      type: 'alert.resolved',
      hostId: 'd35f02d8-9aa8-4f6f-a8f0-079f2f0d05ba',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: alertPayload,
    },
  ])('accepts a valid $type event', (event) => {
    expect(isDashboardEvent(event)).toBe(true);
  });

  it.each([
    null,
    {},
    { version: 2, type: 'host.metric' },
    {
      version: 1,
      type: 'host.metric',
      hostId: 'host',
      occurredAt: 'not-a-date',
      payload: { ...metric, cpuPercent: '24.5' },
    },
    {
      version: 1,
      type: 'host.status',
      hostId: 'host',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: { availability: 'warning', lastSeenAt: null },
    },
    {
      version: 1,
      type: 'alert.opened',
      hostId: 'host',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: { ...alertPayload, agentId: '' },
    },
    {
      version: 1,
      type: 'alert.opened',
      hostId: 'host',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: { ...alertPayload, observedValue: 'high' },
    },
    {
      version: 1,
      type: 'alert.resolved',
      hostId: 'host',
      occurredAt: '2026-08-21T10:00:01.000Z',
      payload: { ...alertPayload, ruleName: '' },
    },
  ])('rejects malformed event %#', (event) => {
    expect(isDashboardEvent(event)).toBe(false);
  });
});

const history: DashboardHistoryResponse = {
  bucketSeconds: 60,
  endAt: '2026-08-21T10:00:00.000Z',
  hostId: 'd35f02d8-9aa8-4f6f-a8f0-079f2f0d05ba',
  points: [
    {
      bucketAt: '2026-08-21T09:58:00.000Z',
      cpuPercent: 20,
      diskUsedPercent: 60,
      memoryUsedPercent: 50,
      networkReceivedBytes: '1000',
      networkTransmittedBytes: '500',
    },
    {
      bucketAt: '2026-08-21T09:59:00.000Z',
      cpuPercent: null,
      diskUsedPercent: null,
      memoryUsedPercent: null,
      networkReceivedBytes: '0',
      networkTransmittedBytes: '0',
    },
  ],
  range: '1h',
  startAt: '2026-08-21T09:00:00.000Z',
};

describe('isDashboardHistoryResponse', () => {
  it('accepts every supported range in a complete response', () => {
    for (const range of HISTORY_RANGES) {
      expect(isDashboardHistoryResponse({ ...history, range })).toBe(true);
    }
  });

  it.each([
    { ...history, range: '90d' },
    { ...history, bucketSeconds: 0 },
    { ...history, startAt: 'not-a-date' },
    { ...history, hostId: '' },
    {
      ...history,
      points: [history.points[1], history.points[0]],
    },
    {
      ...history,
      points: [{ ...history.points[0], cpuPercent: 101 }],
    },
    {
      ...history,
      points: [{ ...history.points[0], memoryUsedPercent: -1 }],
    },
    {
      ...history,
      points: [{ ...history.points[0], networkReceivedBytes: '-1' }],
    },
    {
      ...history,
      points: [{ ...history.points[0], bucketAt: 'yesterday' }],
    },
  ])('rejects malformed history %#', (value) => {
    expect(isDashboardHistoryResponse(value)).toBe(false);
  });
});
