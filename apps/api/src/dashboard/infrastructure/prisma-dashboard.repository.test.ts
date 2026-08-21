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
      select: {
        agents: {
          orderBy: [{ lastSeenAt: 'desc' }, { enrolledAt: 'desc' }],
          select: {
            id: true,
            lastSeenAt: true,
            metricSamples: {
              orderBy: { collectedAt: 'desc' },
              select: {
                collectedAt: true,
                cpuPercent: true,
                diskFreeBytes: true,
                diskTotalBytes: true,
                diskUsedBytes: true,
                memoryTotalBytes: true,
                memoryUsedBytes: true,
                networkReceivedBytes: true,
                networkTransmittedBytes: true,
                uptimeSeconds: true,
              },
              take: 1,
            },
            version: true,
          },
          take: 1,
        },
        architecture: true,
        id: true,
        hostname: true,
        platform: true,
      },
    });
    expect(JSON.stringify(findMany.mock.calls[0])).not.toContain(
      'credentialHash',
    );
  });

  it('omits hosts that have no enrolled agent', async () => {
    const prisma = {
      host: {
        findMany: jest.fn().mockResolvedValue([{ ...host, agents: [] }]),
      },
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

  it('returns mapped history from a bounded parameterized aggregation query', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        bucketAt: new Date('2026-08-21T09:00:00.000Z'),
        cpuPercent: '24.5',
        diskUsedPercent: '60',
        memoryUsedPercent: null,
        networkReceivedBytes: 2_000n,
        networkTransmittedBytes: 1_500n,
      },
    ]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const startAt = new Date('2026-08-21T09:00:00.000Z');
    const endAt = new Date('2026-08-21T10:00:00.000Z');

    await expect(
      new PrismaDashboardRepository(prisma).listHistory(
        '22222222-2222-4222-8222-222222222222',
        startAt,
        endAt,
        60,
      ),
    ).resolves.toEqual([
      {
        bucketAt: new Date('2026-08-21T09:00:00.000Z'),
        cpuPercent: 24.5,
        diskUsedPercent: 60,
        memoryUsedPercent: null,
        networkReceivedBytes: 2_000n,
        networkTransmittedBytes: 1_500n,
      },
    ]);

    const [strings, ...values] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join('?');
    expect(values).toEqual([
      '22222222-2222-4222-8222-222222222222',
      startAt,
      endAt,
      60,
      60,
    ]);
    expect(sql).toContain('LAG');
    expect(sql).toContain('GREATEST');
    expect(sql).toContain('"collectedAt" >=');
    expect(sql).toContain('"collectedAt" <=');
    expect(sql).toContain('ORDER BY bucket_at ASC');
  });
});
