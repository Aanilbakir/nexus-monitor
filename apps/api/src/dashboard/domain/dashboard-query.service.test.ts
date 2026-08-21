import type { DashboardRepository } from './dashboard-query.service.js';
import { DashboardQueryService } from './dashboard-query.service.js';

const now = new Date('2026-08-21T10:00:00.000Z');

const onlineRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  hostname: 'web-prod-01',
  platform: 'win32',
  architecture: 'x64',
  agent: {
    id: '22222222-2222-4222-8222-222222222222',
    version: '0.1.0',
    lastSeenAt: new Date('2026-08-21T09:59:30.000Z'),
    latestMetric: {
      collectedAt: new Date('2026-08-21T09:59:29.000Z'),
      cpuPercent: 24.5,
      diskFreeBytes: 400n,
      diskTotalBytes: 1_000n,
      diskUsedBytes: 600n,
      memoryTotalBytes: 17_179_869_184n,
      memoryUsedBytes: 8_589_934_592n,
      networkReceivedBytes: 2_000n,
      networkTransmittedBytes: 1_500n,
      uptimeSeconds: 3_600n,
    },
  },
} as const;

describe('DashboardQueryService', () => {
  it('maps current records to browser-safe values and orders online hosts first', async () => {
    const repository: DashboardRepository = {
      findCurrentHost: jest.fn(),
      listCurrentHosts: jest.fn().mockResolvedValue([
        {
          ...onlineRecord,
          id: '33333333-3333-4333-8333-333333333333',
          hostname: 'archived-worker',
          agent: {
            ...onlineRecord.agent,
            id: '44444444-4444-4444-8444-444444444444',
            lastSeenAt: null,
            latestMetric: null,
          },
        },
        onlineRecord,
      ]),
    };

    const result = await new DashboardQueryService(
      repository,
      () => now,
    ).listHosts();

    expect(result).toEqual({
      generatedAt: '2026-08-21T10:00:00.000Z',
      hosts: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          agentId: '22222222-2222-4222-8222-222222222222',
          agentVersion: '0.1.0',
          architecture: 'x64',
          availability: 'online',
          hostname: 'web-prod-01',
          lastSeenAt: '2026-08-21T09:59:30.000Z',
          latestMetric: {
            collectedAt: '2026-08-21T09:59:29.000Z',
            cpuPercent: 24.5,
            diskFreeBytes: '400',
            diskTotalBytes: '1000',
            diskUsedBytes: '600',
            memoryTotalBytes: '17179869184',
            memoryUsedBytes: '8589934592',
            networkReceivedBytes: '2000',
            networkTransmittedBytes: '1500',
            uptimeSeconds: '3600',
          },
          platform: 'win32',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          agentId: '44444444-4444-4444-8444-444444444444',
          agentVersion: '0.1.0',
          architecture: 'x64',
          availability: 'offline',
          hostname: 'archived-worker',
          lastSeenAt: null,
          latestMetric: null,
          platform: 'win32',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('credential');
  });

  it('returns null when a host does not exist', async () => {
    const repository: DashboardRepository = {
      findCurrentHost: jest.fn().mockResolvedValue(null),
      listCurrentHosts: jest.fn(),
    };

    await expect(
      new DashboardQueryService(repository, () => now).getHost(
        '55555555-5555-4555-8555-555555555555',
      ),
    ).resolves.toBeNull();
  });
});
