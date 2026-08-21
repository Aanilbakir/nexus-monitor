import {
  isDashboardEvent,
  type DashboardEvent,
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
  ])('rejects malformed event %#', (event) => {
    expect(isDashboardEvent(event)).toBe(false);
  });
});
