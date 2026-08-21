import type { DashboardFleetSnapshot } from '@nexus-monitor/contracts';

import { DashboardEventPublisher } from './dashboard-event.publisher.js';
import { AvailabilityMonitor } from './availability-monitor.js';
import type { DashboardQueryService } from './dashboard-query.service.js';

const online: DashboardFleetSnapshot = {
  generatedAt: '2026-08-21T10:00:00.000Z',
  hosts: [
    {
      agentId: '22222222-2222-4222-8222-222222222222',
      agentVersion: '0.1.0',
      architecture: 'x64',
      availability: 'online',
      hostname: 'web-prod-01',
      id: '11111111-1111-4111-8111-111111111111',
      lastSeenAt: '2026-08-21T10:00:00.000Z',
      latestMetric: null,
      platform: 'win32',
    },
  ],
};

describe('AvailabilityMonitor', () => {
  it('publishes one event when an online host becomes offline', async () => {
    const snapshots = [
      online,
      {
        ...online,
        generatedAt: '2026-08-21T10:00:46.000Z',
        hosts: [{ ...online.hosts[0]!, availability: 'offline' as const }],
      },
      {
        ...online,
        generatedAt: '2026-08-21T10:00:51.000Z',
        hosts: [{ ...online.hosts[0]!, availability: 'offline' as const }],
      },
    ];
    const queries = {
      listHosts: jest
        .fn()
        .mockImplementation(() => Promise.resolve(snapshots.shift())),
    } as unknown as DashboardQueryService;
    const publisher = new DashboardEventPublisher();
    const events: unknown[] = [];
    publisher.subscribe((event) => events.push(event));
    const monitor = new AvailabilityMonitor(queries, publisher);

    await monitor.check();
    await monitor.check();
    await monitor.check();

    expect(events).toEqual([
      {
        hostId: online.hosts[0]?.id,
        occurredAt: '2026-08-21T10:00:46.000Z',
        payload: {
          availability: 'offline',
          lastSeenAt: '2026-08-21T10:00:00.000Z',
        },
        type: 'host.status',
        version: 1,
      },
    ]);
  });

  it('allows a later online state to cross the boundary again', async () => {
    const offline = {
      ...online,
      generatedAt: '2026-08-21T10:00:46.000Z',
      hosts: [{ ...online.hosts[0]!, availability: 'offline' as const }],
    };
    const snapshots = [online, offline, online, offline];
    const queries = {
      listHosts: jest
        .fn()
        .mockImplementation(() => Promise.resolve(snapshots.shift())),
    } as unknown as DashboardQueryService;
    const publisher = new DashboardEventPublisher();
    const events: unknown[] = [];
    publisher.subscribe((event) => events.push(event));
    const monitor = new AvailabilityMonitor(queries, publisher);

    await monitor.check();
    await monitor.check();
    await monitor.check();
    await monitor.check();

    expect(events).toHaveLength(2);
  });
});
