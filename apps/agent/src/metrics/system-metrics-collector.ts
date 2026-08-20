import type { SystemMetricSample } from '@nexus-monitor/contracts';

import { calculateCpuPercent, type CpuTimes } from './cpu.js';

export interface FilesystemMetric {
  readonly freeBytes: number;
  readonly local: boolean;
  readonly sizeBytes: number;
  readonly usedBytes: number;
}

export interface NetworkMetric {
  readonly active: boolean;
  readonly loopback: boolean;
  readonly receivedBytes: number;
  readonly transmittedBytes: number;
}

export interface MetricSource {
  readCpuTimes(): CpuTimes;
  readMemory(): { readonly totalBytes: number; readonly usedBytes: number };
  readUptimeSeconds(): number;
  readFilesystems(): Promise<readonly FilesystemMetric[]>;
  readNetworks(): Promise<readonly NetworkMetric[]>;
}

export interface SystemMetricsCollector {
  collect(): Promise<SystemMetricSample | null>;
}

export class NodeSystemMetricsCollector implements SystemMetricsCollector {
  private previousCpuTimes: CpuTimes | null = null;

  public constructor(
    private readonly source: MetricSource,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public async collect(): Promise<SystemMetricSample | null> {
    const currentCpuTimes = this.source.readCpuTimes();
    const previousCpuTimes = this.previousCpuTimes;
    this.previousCpuTimes = currentCpuTimes;
    if (!previousCpuTimes) return null;

    const cpuPercent = calculateCpuPercent(previousCpuTimes, currentCpuTimes);
    if (cpuPercent === null) {
      throw new Error('CPU metric delta is unavailable.');
    }

    const [filesystems, networks] = await Promise.all([
      this.source.readFilesystems(),
      this.source.readNetworks(),
    ]);
    const localFilesystems = filesystems.filter(
      (filesystem) => filesystem.local,
    );
    if (localFilesystems.length === 0) {
      throw new Error('No local filesystem metrics are available.');
    }

    const memory = this.source.readMemory();
    const sample: SystemMetricSample = {
      collectedAt: this.clock().toISOString(),
      cpuPercent,
      diskFreeBytes: sum(localFilesystems, (item) => item.freeBytes),
      diskTotalBytes: sum(localFilesystems, (item) => item.sizeBytes),
      diskUsedBytes: sum(localFilesystems, (item) => item.usedBytes),
      memoryTotalBytes: memory.totalBytes,
      memoryUsedBytes: memory.usedBytes,
      networkReceivedBytes: sum(
        networks.filter((network) => network.active && !network.loopback),
        (item) => item.receivedBytes,
      ),
      networkTransmittedBytes: sum(
        networks.filter((network) => network.active && !network.loopback),
        (item) => item.transmittedBytes,
      ),
      uptimeSeconds: Math.floor(this.source.readUptimeSeconds()),
    };

    if (!hasSafeValues(sample)) {
      throw new Error('Collected metric values are unsafe.');
    }
    return sample;
  }
}

function hasSafeValues(sample: SystemMetricSample): boolean {
  const counters = [
    sample.diskFreeBytes,
    sample.diskTotalBytes,
    sample.diskUsedBytes,
    sample.memoryTotalBytes,
    sample.memoryUsedBytes,
    sample.networkReceivedBytes,
    sample.networkTransmittedBytes,
    sample.uptimeSeconds,
  ];
  return (
    Number.isFinite(sample.cpuPercent) &&
    sample.cpuPercent >= 0 &&
    sample.cpuPercent <= 100 &&
    counters.every((value) => Number.isSafeInteger(value) && value >= 0) &&
    sample.memoryUsedBytes <= sample.memoryTotalBytes &&
    sample.diskUsedBytes + sample.diskFreeBytes <= sample.diskTotalBytes
  );
}

function sum<T>(values: readonly T[], select: (value: T) => number): number {
  return values.reduce((total, value) => total + select(value), 0);
}
