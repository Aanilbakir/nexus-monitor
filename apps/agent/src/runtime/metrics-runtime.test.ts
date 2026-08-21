import type { SystemMetricSample } from '@nexus-monitor/contracts';

import type { SystemMetricsCollector } from '../metrics/system-metrics-collector.js';
import { MetricsRuntime } from './metrics-runtime.js';

const sample: SystemMetricSample = {
  collectedAt: '2026-08-21T09:59:59.000Z',
  cpuPercent: 25,
  diskFreeBytes: 400,
  diskTotalBytes: 1_000,
  diskUsedBytes: 500,
  memoryTotalBytes: 1_000,
  memoryUsedBytes: 600,
  networkReceivedBytes: 2_000,
  networkTransmittedBytes: 1_500,
  uptimeSeconds: 3_600,
};

describe('MetricsRuntime', () => {
  it('primes collection and sends the first scheduled sample', async () => {
    const readings = [null, sample];
    const collector: SystemMetricsCollector = {
      collect: () => Promise.resolve(readings.shift() ?? null),
    };
    const sent: SystemMetricSample[] = [];
    const sender = {
      sendMetrics: (
        _agentId: string,
        _agentToken: string,
        value: SystemMetricSample,
      ) => {
        sent.push(value);
        return Promise.resolve();
      },
    };
    let scheduled: (() => Promise<void>) | undefined;
    const runtime = new MetricsRuntime(collector, sender, (task) => {
      scheduled = task;
    });

    await runtime.start('agent-id', 'agent-secret');
    expect(sent).toEqual([]);
    await scheduled?.();
    expect(sent).toEqual([sample]);
  });

  it('reports a failed collection and retries on the next interval', async () => {
    const readings: Array<SystemMetricSample | Error | null> = [
      null,
      new Error('collector failed'),
      sample,
    ];
    const collector: SystemMetricsCollector = {
      collect: () => {
        const reading = readings.shift() ?? null;
        return reading instanceof Error
          ? Promise.reject(reading)
          : Promise.resolve(reading);
      },
    };
    const sent: SystemMetricSample[] = [];
    const errors: unknown[] = [];
    let scheduled: (() => Promise<void>) | undefined;
    const runtime = new MetricsRuntime(
      collector,
      {
        sendMetrics: (_agentId, _agentToken, value) => {
          sent.push(value);
          return Promise.resolve();
        },
      },
      (task) => {
        scheduled = task;
      },
      (error) => errors.push(error),
    );

    await runtime.start('agent-id', 'agent-secret');
    await scheduled?.();
    await scheduled?.();

    expect(errors).toHaveLength(1);
    expect(sent).toEqual([sample]);
  });

  it('reports a send failure without stopping later cycles', async () => {
    const readings = [
      null,
      sample,
      { ...sample, collectedAt: '2026-08-21T10:00:14.000Z' },
    ];
    const collector: SystemMetricsCollector = {
      collect: () => Promise.resolve(readings.shift() ?? null),
    };
    let sends = 0;
    const errors: unknown[] = [];
    let scheduled: (() => Promise<void>) | undefined;
    const runtime = new MetricsRuntime(
      collector,
      {
        sendMetrics: () => {
          sends += 1;
          return sends === 1
            ? Promise.reject(new Error('send failed'))
            : Promise.resolve();
        },
      },
      (task) => {
        scheduled = task;
      },
      (error) => errors.push(error),
    );

    await runtime.start('agent-id', 'agent-secret');
    await scheduled?.();
    await scheduled?.();

    expect(errors).toHaveLength(1);
    expect(sends).toBe(2);
  });
});
