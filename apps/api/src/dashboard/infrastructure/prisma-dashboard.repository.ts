import type { PrismaClient } from '@nexus-monitor/database';

import type {
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
