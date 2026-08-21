import type {
  DashboardFleetSnapshot,
  DashboardHistoryResponse,
  DashboardHost,
  DashboardMetric,
  HistoryRange,
} from '@nexus-monitor/contracts';

import { getHostAvailability } from '../../agents/domain/availability.js';
import type { Clock } from '../../agents/domain/agent.service.js';
import { getHistoryPolicy } from './history-range.js';

export interface DashboardMetricRecord {
  readonly collectedAt: Date;
  readonly cpuPercent: number;
  readonly diskFreeBytes: bigint;
  readonly diskTotalBytes: bigint;
  readonly diskUsedBytes: bigint;
  readonly memoryTotalBytes: bigint;
  readonly memoryUsedBytes: bigint;
  readonly networkReceivedBytes: bigint;
  readonly networkTransmittedBytes: bigint;
  readonly uptimeSeconds: bigint;
}

export interface DashboardHostRecord {
  readonly agent: {
    readonly id: string;
    readonly lastSeenAt: Date | null;
    readonly latestMetric: DashboardMetricRecord | null;
    readonly version: string;
  };
  readonly architecture: string;
  readonly hostname: string;
  readonly id: string;
  readonly platform: string;
}

export interface DashboardHistoryRecord {
  readonly bucketAt: Date;
  readonly cpuPercent: number | null;
  readonly diskUsedPercent: number | null;
  readonly memoryUsedPercent: number | null;
  readonly networkReceivedBytes: bigint;
  readonly networkTransmittedBytes: bigint;
}

export interface DashboardRepository {
  findCurrentHost(hostId: string): Promise<DashboardHostRecord | null>;
  listHistory(
    agentId: string,
    startAt: Date,
    endAt: Date,
    bucketSeconds: number,
  ): Promise<readonly DashboardHistoryRecord[]>;
  listCurrentHosts(): Promise<readonly DashboardHostRecord[]>;
}

export class DashboardQueryService {
  public constructor(
    private readonly repository: DashboardRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  public async listHosts(): Promise<DashboardFleetSnapshot> {
    const now = this.clock();
    const records = await this.repository.listCurrentHosts();
    const hosts = records.map((record) => mapHost(record, now));

    hosts.sort((left, right) => {
      if (left.availability !== right.availability) {
        return left.availability === 'online' ? -1 : 1;
      }

      return compareText(left.hostname, right.hostname);
    });

    return { generatedAt: now.toISOString(), hosts };
  }

  public async getHost(hostId: string): Promise<DashboardHost | null> {
    const record = await this.repository.findCurrentHost(hostId);
    return record ? mapHost(record, this.clock()) : null;
  }

  public async getHistory(
    hostId: string,
    range: HistoryRange,
  ): Promise<DashboardHistoryResponse | null> {
    const host = await this.repository.findCurrentHost(hostId);
    if (!host) {
      return null;
    }

    const policy = getHistoryPolicy(range);
    const endAt = this.clock();
    const startAt = new Date(endAt.getTime() - policy.durationMilliseconds);
    const records = await this.repository.listHistory(
      host.agent.id,
      startAt,
      endAt,
      policy.bucketSeconds,
    );
    if (records.length > policy.maximumPoints) {
      throw new Error('Historical metric query exceeded its point limit.');
    }

    return {
      bucketSeconds: policy.bucketSeconds,
      endAt: endAt.toISOString(),
      hostId,
      points: records.map((record) => ({
        bucketAt: record.bucketAt.toISOString(),
        cpuPercent: record.cpuPercent,
        diskUsedPercent: record.diskUsedPercent,
        memoryUsedPercent: record.memoryUsedPercent,
        networkReceivedBytes: record.networkReceivedBytes.toString(),
        networkTransmittedBytes: record.networkTransmittedBytes.toString(),
      })),
      range,
      startAt: startAt.toISOString(),
    };
  }
}

function mapHost(record: DashboardHostRecord, now: Date): DashboardHost {
  return {
    agentId: record.agent.id,
    agentVersion: record.agent.version,
    architecture: record.architecture,
    availability: getHostAvailability(record.agent.lastSeenAt, now),
    hostname: record.hostname,
    id: record.id,
    lastSeenAt: record.agent.lastSeenAt?.toISOString() ?? null,
    latestMetric: record.agent.latestMetric
      ? mapMetric(record.agent.latestMetric)
      : null,
    platform: record.platform,
  };
}

function mapMetric(record: DashboardMetricRecord): DashboardMetric {
  return {
    collectedAt: record.collectedAt.toISOString(),
    cpuPercent: record.cpuPercent,
    diskFreeBytes: record.diskFreeBytes.toString(),
    diskTotalBytes: record.diskTotalBytes.toString(),
    diskUsedBytes: record.diskUsedBytes.toString(),
    memoryTotalBytes: record.memoryTotalBytes.toString(),
    memoryUsedBytes: record.memoryUsedBytes.toString(),
    networkReceivedBytes: record.networkReceivedBytes.toString(),
    networkTransmittedBytes: record.networkTransmittedBytes.toString(),
    uptimeSeconds: record.uptimeSeconds.toString(),
  };
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}
