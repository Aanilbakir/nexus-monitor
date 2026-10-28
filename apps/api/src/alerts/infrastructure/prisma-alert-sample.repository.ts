import type { PrismaClient } from '@nexus-monitor/database';

import type {
  AlertSampleRepository,
  AlertSampleWindowEntry,
} from '../domain/alert-sample-repository.js';

interface SampleRow {
  readonly collectedAt: Date;
  readonly cpuPercent: number;
  readonly diskTotalBytes: bigint;
  readonly diskUsedBytes: bigint;
  readonly memoryTotalBytes: bigint;
  readonly memoryUsedBytes: bigint;
}

/** Hard cap on rows scanned per rule evaluation so window queries stay bounded regardless of durationSeconds. */
const MAX_WINDOW_SAMPLES = 500;

export class PrismaAlertSampleRepository implements AlertSampleRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findRecentSamples(
    agentId: string,
    metric: string,
    windowStart: Date,
  ): Promise<readonly AlertSampleWindowEntry[]> {
    const rows = await this.prisma.systemMetricSample.findMany({
      where: { agentId, collectedAt: { gte: windowStart } },
      orderBy: { collectedAt: 'desc' },
      take: MAX_WINDOW_SAMPLES,
      select: {
        collectedAt: true,
        cpuPercent: true,
        diskTotalBytes: true,
        diskUsedBytes: true,
        memoryTotalBytes: true,
        memoryUsedBytes: true,
      },
    });

    const samples: AlertSampleWindowEntry[] = [];
    for (const row of rows) {
      const value = extractMetricValue(row, metric);
      if (value !== undefined) {
        samples.push({ collectedAt: row.collectedAt, value });
      }
    }
    return samples.reverse();
  }
}

function extractMetricValue(
  row: SampleRow,
  metric: string,
): number | undefined {
  switch (metric) {
    case 'cpuPercent':
      return row.cpuPercent;
    case 'diskUsedPercent':
      return percentOf(row.diskUsedBytes, row.diskTotalBytes);
    case 'memoryUsedPercent':
      return percentOf(row.memoryUsedBytes, row.memoryTotalBytes);
    default:
      return undefined;
  }
}

function percentOf(used: bigint, total: bigint): number {
  return total === 0n ? 0 : (Number(used) / Number(total)) * 100;
}
