import type { PrismaClient } from '@nexus-monitor/database';

import type {
  DashboardHistoryRecord,
  DashboardHostRecord,
  DashboardMetricRecord,
  DashboardRepository,
} from '../domain/dashboard-query.service.js';

const hostSelection = {
  architecture: true,
  hostname: true,
  id: true,
  platform: true,
  agents: {
    orderBy: [{ lastSeenAt: 'desc' as const }, { enrolledAt: 'desc' as const }],
    select: {
      id: true,
      lastSeenAt: true,
      version: true,
      metricSamples: {
        orderBy: { collectedAt: 'desc' as const },
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
    },
    take: 1,
  },
};

interface DashboardHostRow {
  readonly agents: readonly DashboardAgentRow[];
  readonly architecture: string;
  readonly hostname: string;
  readonly id: string;
  readonly platform: string;
}

interface DashboardAgentRow {
  readonly id: string;
  readonly lastSeenAt: Date | null;
  readonly metricSamples: readonly DashboardMetricRecord[];
  readonly version: string;
}

interface DashboardHistoryRow {
  readonly bucketAt: Date;
  readonly cpuPercent: number | string | null;
  readonly diskUsedPercent: number | string | null;
  readonly memoryUsedPercent: number | string | null;
  readonly networkReceivedBytes: bigint;
  readonly networkTransmittedBytes: bigint;
}

export class PrismaDashboardRepository implements DashboardRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listCurrentHosts(): Promise<readonly DashboardHostRecord[]> {
    const hosts: readonly DashboardHostRow[] = await this.prisma.host.findMany({
      orderBy: { hostname: 'asc' },
      select: hostSelection,
    });

    return hosts.flatMap((host) => {
      const mapped = mapHost(host);
      return mapped ? [mapped] : [];
    });
  }

  public async findCurrentHost(
    hostId: string,
  ): Promise<DashboardHostRecord | null> {
    const host: DashboardHostRow | null = await this.prisma.host.findUnique({
      where: { id: hostId },
      select: hostSelection,
    });

    return host ? mapHost(host) : null;
  }

  public async listHistory(
    agentId: string,
    startAt: Date,
    endAt: Date,
    bucketSeconds: number,
  ): Promise<readonly DashboardHistoryRecord[]> {
    const rows = await this.prisma.$queryRaw<DashboardHistoryRow[]>`
      WITH ordered AS (
        SELECT
          "collectedAt",
          "cpuPercent",
          "memoryUsedBytes",
          "memoryTotalBytes",
          "diskUsedBytes",
          "diskTotalBytes",
          GREATEST(
            "networkReceivedBytes" - LAG("networkReceivedBytes") OVER (ORDER BY "collectedAt"),
            0
          ) AS received_delta,
          GREATEST(
            "networkTransmittedBytes" - LAG("networkTransmittedBytes") OVER (ORDER BY "collectedAt"),
            0
          ) AS transmitted_delta
        FROM "SystemMetricSample"
        WHERE "agentId" = ${agentId}
          AND "collectedAt" >= ${startAt}
          AND "collectedAt" <= ${endAt}
      ),
      bucketed AS (
        SELECT
          to_timestamp(
            floor(extract(epoch FROM "collectedAt") / ${bucketSeconds}) * ${bucketSeconds}
          ) AS bucket_at,
          *
        FROM ordered
      )
      SELECT
        bucket_at AS "bucketAt",
        AVG("cpuPercent") AS "cpuPercent",
        AVG(
          ("memoryUsedBytes"::numeric / NULLIF("memoryTotalBytes", 0)) * 100
        ) AS "memoryUsedPercent",
        AVG(
          ("diskUsedBytes"::numeric / NULLIF("diskTotalBytes", 0)) * 100
        ) AS "diskUsedPercent",
        COALESCE(SUM(received_delta), 0) AS "networkReceivedBytes",
        COALESCE(SUM(transmitted_delta), 0) AS "networkTransmittedBytes"
      FROM bucketed
      GROUP BY bucket_at
      ORDER BY bucket_at ASC
    `;

    return rows.map((row) => ({
      bucketAt: row.bucketAt,
      cpuPercent: mapNullableNumber(row.cpuPercent),
      diskUsedPercent: mapNullableNumber(row.diskUsedPercent),
      memoryUsedPercent: mapNullableNumber(row.memoryUsedPercent),
      networkReceivedBytes: row.networkReceivedBytes,
      networkTransmittedBytes: row.networkTransmittedBytes,
    }));
  }
}

function mapNullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function mapHost(host: DashboardHostRow): DashboardHostRecord | null {
  const agent = host.agents[0];
  if (!agent) {
    return null;
  }

  return {
    agent: {
      id: agent.id,
      lastSeenAt: agent.lastSeenAt,
      latestMetric: agent.metricSamples[0] ?? null,
      version: agent.version,
    },
    architecture: host.architecture,
    hostname: host.hostname,
    id: host.id,
    platform: host.platform,
  };
}
