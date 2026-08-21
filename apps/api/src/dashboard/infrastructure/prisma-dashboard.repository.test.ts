import type { PrismaClient } from '@nexus-monitor/database';

import { PrismaDashboardRepository } from './prisma-dashboard.repository.js';

const host = {
  id: '11111111-1111-4111-8111-111111111111',
  hostname: 'web-prod-01',
  platform: 'win32',
  architecture: 'x64',
  agents: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      version: '0.1.0',
      lastSeenAt: new Date('2026-08-21T10:00:00.000Z'),
      metricSamples: [
        {
          collectedAt: new Date('2026-08-21T09:59:59.000Z'),
          cpuPercent: 24,
          diskFreeBytes: 400n,
          diskTotalBytes: 1_000n,
          diskUsedBytes: 600n,
          memoryTotalBytes: 1_000n,
          memoryUsedBytes: 610n,
          networkReceivedBytes: 2_000n,
          networkTransmittedBytes: 1_500n,
          uptimeSeconds: 3_600n,
        },
      ],
    },
  ],
};

describe('PrismaDashboardRepository', () => {
  it('selects one current agent and its latest metric without credential data', async () => {
    const findMany = jest.fn().mockResolvedValue([host]);
    const prisma = { host: { findMany } } as unknown as PrismaClient;

    await expect(
      new PrismaDashboardRepository(prisma).listCurrentHosts(),
    ).resolves.toEqual([
      {
        id: host.id,
        hostname: host.hostname,
        platform: host.platform,
        architecture: host.architecture,
        agent: {
          id: host.agents[0]?.id,
          version: host.agents[0]?.version,
          lastSeenAt: host.agents[0]?.lastSeenAt,
          latestMetric: host.agents[0]?.metricSamples[0],
        },
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { hostname: 'asc' },
      select: expect.objectContaining({
        id: true,
        hostname: true,
        platform: true,
        architecture: true,
        agents: expect.objectContaining({
          orderBy: [{ lastSeenAt: 'desc' }, { enrolledAt: 'desc' }],
          take: 1,
        }),
      }),
    });
    expect(JSON.stringify(findMany.mock.calls[0])).not.toContain(
      'credentialHash',
    );
  });

  it('omits hosts that have no enrolled agent', async () => {
    const prisma = {
      host: { findMany: jest.fn().mockResolvedValue([{ ...host, agents: [] }]) },
    } as unknown as PrismaClient;

    await expect(
      new PrismaDashboardRepository(prisma).listCurrentHosts(),
    ).resolves.toEqual([]);
  });

  it('returns one mapped host by identifier or null', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(host)
      .mockResolvedValueOnce(null);
    const prisma = { host: { findUnique } } as unknown as PrismaClient;
    const repository = new PrismaDashboardRepository(prisma);

    await expect(repository.findCurrentHost(host.id)).resolves.toMatchObject({
      id: host.id,
      agent: { id: host.agents[0]?.id },
    });
    await expect(repository.findCurrentHost(host.id)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: host.id } }),
    );
  });
});

