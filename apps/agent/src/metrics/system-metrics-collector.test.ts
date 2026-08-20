import type { CpuTimes } from './cpu.js';
import {
  NodeSystemMetricsCollector,
  type MetricSource,
} from './system-metrics-collector.js';

class FakeMetricSource implements MetricSource {
  private cpuIndex = 0;

  public constructor(
    private readonly cpuReadings: readonly CpuTimes[],
    private readonly memory = { totalBytes: 1_000, usedBytes: 600 },
  ) {}

  public readCpuTimes(): CpuTimes {
    return this.cpuReadings[
      Math.min(this.cpuIndex++, this.cpuReadings.length - 1)
    ]!;
  }

  public readMemory(): { totalBytes: number; usedBytes: number } {
    return this.memory;
  }

  public readUptimeSeconds(): number {
    return 3_600;
  }

  public readFilesystems(): Promise<
    ReadonlyArray<{
      freeBytes: number;
      local: boolean;
      sizeBytes: number;
      usedBytes: number;
    }>
  > {
    return Promise.resolve([
      { freeBytes: 400, local: true, sizeBytes: 1_000, usedBytes: 500 },
      { freeBytes: 200, local: true, sizeBytes: 500, usedBytes: 250 },
      { freeBytes: 9_000, local: false, sizeBytes: 10_000, usedBytes: 1_000 },
    ]);
  }

  public readNetworks(): Promise<
    ReadonlyArray<{
      active: boolean;
      loopback: boolean;
      receivedBytes: number;
      transmittedBytes: number;
    }>
  > {
    return Promise.resolve([
      {
        active: true,
        loopback: false,
        receivedBytes: 2_000,
        transmittedBytes: 1_000,
      },
      {
        active: true,
        loopback: false,
        receivedBytes: 3_000,
        transmittedBytes: 4_000,
      },
      {
        active: true,
        loopback: true,
        receivedBytes: 100,
        transmittedBytes: 100,
      },
      {
        active: false,
        loopback: false,
        receivedBytes: 100,
        transmittedBytes: 100,
      },
    ]);
  }
}

describe('NodeSystemMetricsCollector', () => {
  it('primes CPU state before emitting the first complete sample', async () => {
    const collector = new NodeSystemMetricsCollector(
      new FakeMetricSource([
        { idle: 400, total: 1_000 },
        { idle: 450, total: 1_200 },
      ]),
      () => new Date('2026-08-21T10:00:00.000Z'),
    );

    await expect(collector.collect()).resolves.toBeNull();
    await expect(collector.collect()).resolves.toEqual({
      collectedAt: '2026-08-21T10:00:00.000Z',
      cpuPercent: 75,
      diskFreeBytes: 600,
      diskTotalBytes: 1_500,
      diskUsedBytes: 750,
      memoryTotalBytes: 1_000,
      memoryUsedBytes: 600,
      networkReceivedBytes: 5_000,
      networkTransmittedBytes: 5_000,
      uptimeSeconds: 3_600,
    });
  });

  it('fails a cycle when no local filesystem is available', async () => {
    const source = new FakeMetricSource([
      { idle: 1, total: 2 },
      { idle: 2, total: 4 },
    ]);
    source.readFilesystems = () =>
      Promise.resolve([
        { freeBytes: 1, local: false, sizeBytes: 1, usedBytes: 0 },
      ]);
    const collector = new NodeSystemMetricsCollector(source);

    await collector.collect();
    await expect(collector.collect()).rejects.toThrow(
      'No local filesystem metrics are available.',
    );
  });

  it('rejects counters outside the safe integer range', async () => {
    const collector = new NodeSystemMetricsCollector(
      new FakeMetricSource(
        [
          { idle: 1, total: 2 },
          { idle: 2, total: 4 },
        ],
        { totalBytes: Number.MAX_SAFE_INTEGER + 1, usedBytes: 1 },
      ),
    );

    await collector.collect();
    await expect(collector.collect()).rejects.toThrow(
      'Collected metric values are unsafe.',
    );
  });
});
