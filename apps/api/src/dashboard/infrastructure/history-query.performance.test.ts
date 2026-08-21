import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@nexus-monitor/database';

import { PrismaDashboardRepository } from './prisma-dashboard.repository.js';

const runPerformance = process.env.RUN_HISTORY_PERFORMANCE === '1';
const performanceDescribe = runPerformance ? describe : describe.skip;

performanceDescribe('historical metric query performance', () => {
  const databaseUrl = process.env.DATABASE_URL;
  let prisma: PrismaClient;
  const hostId = randomUUID();
  const agentId = randomUUID();

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required when RUN_HISTORY_PERFORMANCE=1.',
      );
    }

    const { createPrismaClient } = await import('@nexus-monitor/database');
    prisma = createPrismaClient(databaseUrl);

    await prisma.host.create({
      data: {
        architecture: 'x64',
        hostname: `history-performance-${hostId}`,
        id: hostId,
        platform: 'linux',
        agents: {
          create: {
            credentialHash: 'a'.repeat(64),
            id: agentId,
            lastSeenAt: new Date('2026-08-22T00:00:00.000Z'),
            version: '0.1.0',
          },
        },
      },
    });

    await prisma.$executeRaw`
      INSERT INTO "SystemMetricSample" (
        "agentId",
        "collectedAt",
        "cpuPercent",
        "memoryTotalBytes",
        "memoryUsedBytes",
        "diskTotalBytes",
        "diskUsedBytes",
        "diskFreeBytes",
        "networkReceivedBytes",
        "networkTransmittedBytes",
        "uptimeSeconds"
      )
      SELECT
        ${agentId}::uuid,
        sample_at,
        35 + MOD(sequence_number, 30),
        16000000000,
        8000000000 + MOD(sequence_number, 1000000),
        1000000000000,
        600000000000 + MOD(sequence_number, 1000000),
        400000000000 - MOD(sequence_number, 1000000),
        sequence_number * 150000,
        sequence_number * 90000,
        sequence_number * 15
      FROM (
        SELECT
          sample_at,
          ROW_NUMBER() OVER (ORDER BY sample_at)::bigint AS sequence_number
        FROM generate_series(
          ${new Date('2026-07-23T00:00:00.000Z')}::timestamptz,
          ${new Date('2026-08-21T23:59:45.000Z')}::timestamptz,
          interval '15 seconds'
        ) AS sample_at
      ) samples
    `;
  }, 120_000);

  afterAll(async () => {
    await prisma.host.delete({ where: { id: hostId } });
    await prisma.$disconnect();
  });

  it('aggregates 30 days of 15-second samples into at most 121 points', async () => {
    const repository = new PrismaDashboardRepository(prisma);
    const startAt = new Date('2026-07-23T00:00:00.000Z');
    const endAt = new Date('2026-08-22T00:00:00.000Z');
    const startedAt = performance.now();

    const points = await repository.listHistory(
      agentId,
      startAt,
      endAt,
      21_600,
    );
    const durationMilliseconds = performance.now() - startedAt;
    const plan = await prisma.$queryRaw<readonly Record<string, unknown>[]>`
        EXPLAIN (FORMAT JSON)
        SELECT "collectedAt"
        FROM "SystemMetricSample"
        WHERE "agentId" = ${agentId}
          AND "collectedAt" >= ${startAt}
          AND "collectedAt" <= ${endAt}
        ORDER BY "collectedAt"
      `;

    expect(points).toHaveLength(120);
    expect(points.length).toBeLessThanOrEqual(121);
    expect(JSON.stringify(plan)).toMatch(/Index|Bitmap/);
    expect(points[0]?.bucketAt.getTime()).toBeLessThan(
      points.at(-1)?.bucketAt.getTime() ?? 0,
    );
    process.stdout.write(
      `history_30d_points=${points.length} duration_ms=${durationMilliseconds.toFixed(2)}\n`,
    );
  }, 120_000);
});
