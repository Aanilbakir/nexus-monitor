import type { SystemMetricSample } from '@nexus-monitor/contracts';

import type { SystemMetricsCollector } from '../metrics/system-metrics-collector.js';
import type { Scheduler } from './agent-runtime.js';

const METRICS_INTERVAL_MILLISECONDS = 15_000;

export interface MetricSender {
  sendMetrics(
    agentId: string,
    agentToken: string,
    sample: SystemMetricSample,
  ): Promise<void>;
}

export class MetricsRuntime {
  private running = false;

  public constructor(
    private readonly collector: SystemMetricsCollector,
    private readonly sender: MetricSender,
    private readonly schedule: Scheduler = (task, interval) => {
      setInterval(() => void task(), interval);
    },
    private readonly reportError: (error: unknown) => void = (error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Metric collection failed.'}\n`,
      );
    },
  ) {}

  public async start(agentId: string, agentToken: string): Promise<void> {
    try {
      await this.runCycle(agentId, agentToken);
    } catch (error) {
      this.reportError(error);
    }

    this.schedule(async () => {
      if (this.running) return;
      this.running = true;
      try {
        await this.runCycle(agentId, agentToken);
      } catch (error) {
        this.reportError(error);
      } finally {
        this.running = false;
      }
    }, METRICS_INTERVAL_MILLISECONDS);
  }

  private async runCycle(agentId: string, agentToken: string): Promise<void> {
    const sample = await this.collector.collect();
    if (sample) await this.sender.sendMetrics(agentId, agentToken, sample);
  }
}
