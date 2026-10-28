import type { PrismaClient } from '@nexus-monitor/database';

import { PrismaAlertSampleRepository } from './prisma-alert-sample.repository.js';

const windowStart = new Date('2026-08-21T09:55:00.000Z');
const agentId = 'agent-1';

function prismaWithRows(
  rows: readonly Record<string, unknown>[],
): PrismaClient {
  return {
    systemMetricSample: { findMany: jest.fn().mockResolvedValue(rows) },
  } as unknown as PrismaClient;
}

describe('PrismaAlertSampleRepository', () => {
  it('queries samples for the agent within the window, capped at the newest MAX_WINDOW_SAMPLES rows', async () => {
    const prisma = prismaWithRows([
      {
        collectedAt: new Date('2026-08-21T09:59:00.000Z'),
        cpuPercent: 95,
        diskTotalBytes: 1_000n,
        diskUsedBytes: 400n,
        memoryTotalBytes: 1_000n,
        memoryUsedBytes: 500n,
      },
    ]);

    await new PrismaAlertSampleRepository(prisma).findRecentSamples(
      agentId,
      'cpuPercent',
      windowStart,
    );

    expect(
      (
        prisma.systemMetricSample.findMany as jest.Mock<
          unknown,
          [Record<string, unknown>]
        >
      ).mock.calls[0]?.[0],
    ).toEqual({
      where: { agentId, collectedAt: { gte: windowStart } },
      orderBy: { collectedAt: 'desc' },
      take: 500,
      select: {
        collectedAt: true,
        cpuPercent: true,
        diskTotalBytes: true,
        diskUsedBytes: true,
        memoryTotalBytes: true,
        memoryUsedBytes: true,
      },
    });
  });

  it('re-orders the capped newest-first rows back to oldest-first for the evaluator', async () => {
    const older = new Date('2026-08-21T09:58:00.000Z');
    const newer = new Date('2026-08-21T09:59:00.000Z');
    const prisma = prismaWithRows([
      {
        collectedAt: newer,
        cpuPercent: 95,
        diskTotalBytes: 1_000n,
        diskUsedBytes: 400n,
        memoryTotalBytes: 1_000n,
        memoryUsedBytes: 500n,
      },
      {
        collectedAt: older,
        cpuPercent: 10,
        diskTotalBytes: 1_000n,
        diskUsedBytes: 400n,
        memoryTotalBytes: 1_000n,
        memoryUsedBytes: 500n,
      },
    ]);

    await expect(
      new PrismaAlertSampleRepository(prisma).findRecentSamples(
        agentId,
        'cpuPercent',
        windowStart,
      ),
    ).resolves.toEqual([
      { collectedAt: older, value: 10 },
      { collectedAt: newer, value: 95 },
    ]);
  });

  it('maps rows to the cpuPercent column directly', async () => {
    const collectedAt = new Date('2026-08-21T09:59:00.000Z');
    const prisma = prismaWithRows([
      {
        collectedAt,
        cpuPercent: 42.5,
        diskTotalBytes: 1_000n,
        diskUsedBytes: 400n,
        memoryTotalBytes: 1_000n,
        memoryUsedBytes: 500n,
      },
    ]);

    await expect(
      new PrismaAlertSampleRepository(prisma).findRecentSamples(
        agentId,
        'cpuPercent',
        windowStart,
      ),
    ).resolves.toEqual([{ collectedAt, value: 42.5 }]);
  });

  it('derives memoryUsedPercent from the stored byte counters', async () => {
    const collectedAt = new Date('2026-08-21T09:59:00.000Z');
    const prisma = prismaWithRows([
      {
        collectedAt,
        cpuPercent: 10,
        diskTotalBytes: 1_000n,
        diskUsedBytes: 400n,
        memoryTotalBytes: 1_000n,
        memoryUsedBytes: 250n,
      },
    ]);

    await expect(
      new PrismaAlertSampleRepository(prisma).findRecentSamples(
        agentId,
        'memoryUsedPercent',
        windowStart,
      ),
    ).resolves.toEqual([{ collectedAt, value: 25 }]);
  });

  it('derives diskUsedPercent from the stored byte counters', async () => {
    const collectedAt = new Date('2026-08-21T09:59:00.000Z');
    const prisma = prismaWithRows([
      {
        collectedAt,
        cpuPercent: 10,
        diskTotalBytes: 2_000n,
        diskUsedBytes: 1_000n,
        memoryTotalBytes: 1_000n,
        memoryUsedBytes: 250n,
      },
    ]);

    await expect(
      new PrismaAlertSampleRepository(prisma).findRecentSamples(
        agentId,
        'diskUsedPercent',
        windowStart,
      ),
    ).resolves.toEqual([{ collectedAt, value: 50 }]);
  });

  it('returns an empty list for an unrecognized metric name', async () => {
    const prisma = prismaWithRows([
      {
        collectedAt: new Date('2026-08-21T09:59:00.000Z'),
        cpuPercent: 10,
        diskTotalBytes: 1_000n,
        diskUsedBytes: 400n,
        memoryTotalBytes: 1_000n,
        memoryUsedBytes: 500n,
      },
    ]);

    await expect(
      new PrismaAlertSampleRepository(prisma).findRecentSamples(
        agentId,
        'unknownMetric',
        windowStart,
      ),
    ).resolves.toEqual([]);
  });
});
