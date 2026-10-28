import type { DashboardEvent } from '@nexus-monitor/contracts';

import { AlertEvaluatorService } from './alert-evaluator.service.js';
import { AlertIngestionCoordinator } from './alert-ingestion.coordinator.js';
import type {
  AlertRuleRepository,
  PersistedAlertRule,
} from './alert-rule-repository.js';
import type { AlertSampleRepository } from './alert-sample-repository.js';
import type {
  ActiveAlertInstance,
  AlertRepository,
} from './alert-repository.js';
import { DashboardEventPublisher } from '../../dashboard/domain/dashboard-event.publisher.js';

class FakeAlertRepository implements AlertRepository {
  public active: ActiveAlertInstance | null = null;
  public openResult: 'already_active' | 'opened' = 'opened';
  public resolveResult = true;

  public acknowledge(): Promise<boolean> {
    throw new Error('not used in these tests');
  }

  public findActive(): Promise<ActiveAlertInstance | null> {
    return Promise.resolve(this.active);
  }

  public openIfAbsent(): Promise<'already_active' | 'opened'> {
    return Promise.resolve(this.openResult);
  }

  public resolve(): Promise<boolean> {
    return Promise.resolve(this.resolveResult);
  }
}

class FakeAlertRuleRepository implements AlertRuleRepository {
  public constructor(public rules: readonly PersistedAlertRule[]) {}

  public findEnabledRules(): Promise<readonly PersistedAlertRule[]> {
    return Promise.resolve(this.rules);
  }
}

class FakeAlertSampleRepository implements AlertSampleRepository {
  public history: readonly { collectedAt: Date; value: number }[] = [];

  public findRecentSamples(): Promise<
    readonly { collectedAt: Date; value: number }[]
  > {
    return Promise.resolve(this.history);
  }
}

const cpuRule: PersistedAlertRule = {
  comparison: '>',
  durationSeconds: 0,
  enabled: true,
  id: 'rule-cpu',
  metric: 'cpuPercent',
  name: 'High CPU',
  severity: 'critical',
  threshold: 90,
};

const memoryRule: PersistedAlertRule = {
  comparison: '>',
  durationSeconds: 0,
  enabled: true,
  id: 'rule-memory',
  metric: 'memoryUsedPercent',
  name: 'High memory',
  severity: 'warning',
  threshold: 90,
};

const agentId = 'agent-1';
const hostId = 'host-1';
const now = new Date('2026-08-21T10:00:00.000Z');

describe('AlertIngestionCoordinator', () => {
  it('publishes alert.opened on the dashboard events publisher when a rule starts breaching', async () => {
    const repository = new FakeAlertRepository();
    const evaluator = new AlertEvaluatorService(repository, () => now);
    const rules = new FakeAlertRuleRepository([cpuRule]);
    const samples = new FakeAlertSampleRepository();
    const publisher = new DashboardEventPublisher();
    const received: DashboardEvent[] = [];
    publisher.subscribe((event) => received.push(event));
    const coordinator = new AlertIngestionCoordinator(
      rules,
      samples,
      evaluator,
      publisher,
    );

    await coordinator.afterInsert({
      agentId,
      collectedAt: now,
      hostId,
      metrics: { cpuPercent: 95 },
      receivedAt: now,
    });

    expect(received).toEqual([
      {
        hostId,
        occurredAt: now.toISOString(),
        payload: {
          agentId,
          metric: 'cpuPercent',
          observedValue: 95,
          ruleId: 'rule-cpu',
          ruleName: 'High CPU',
          severity: 'critical',
        },
        type: 'alert.opened',
        version: 1,
      },
    ]);
  });

  it('publishes alert.resolved when an active alert clears', async () => {
    const repository = new FakeAlertRepository();
    repository.active = {
      agentId,
      dedupeKey: 'rule-cpu:agent-1',
      id: 'instance-1',
      observedValue: 95,
      openedAt: now,
      ruleId: 'rule-cpu',
      state: 'OPEN',
    };
    const evaluator = new AlertEvaluatorService(repository, () => now);
    const rules = new FakeAlertRuleRepository([cpuRule]);
    const samples = new FakeAlertSampleRepository();
    const publisher = new DashboardEventPublisher();
    const received: DashboardEvent[] = [];
    publisher.subscribe((event) => received.push(event));
    const coordinator = new AlertIngestionCoordinator(
      rules,
      samples,
      evaluator,
      publisher,
    );

    await coordinator.afterInsert({
      agentId,
      collectedAt: now,
      hostId,
      metrics: { cpuPercent: 10 },
      receivedAt: now,
    });

    expect(received).toEqual([
      {
        hostId,
        occurredAt: now.toISOString(),
        payload: {
          agentId,
          metric: 'cpuPercent',
          observedValue: 10,
          ruleId: 'rule-cpu',
          ruleName: 'High CPU',
          severity: 'critical',
        },
        type: 'alert.resolved',
        version: 1,
      },
    ]);
  });

  const noPublishCases = [
    {
      configure: (repository: FakeAlertRepository) => {
        repository.openResult = 'already_active';
      },
      metrics: { cpuPercent: 95 },
      outcome: 'already_active',
    },
    {
      configure: () => {},
      metrics: { cpuPercent: 10 },
      outcome: 'no_active_instance',
    },
    {
      configure: () => {},
      metrics: { cpuPercent: Number.NaN },
      outcome: 'insufficient_data',
    },
  ] as const;

  it.each(noPublishCases)(
    'does not publish anything when the evaluation outcome is $outcome',
    async ({ configure, metrics }) => {
      const repository = new FakeAlertRepository();
      configure(repository);
      const evaluator = new AlertEvaluatorService(repository, () => now);
      const rules = new FakeAlertRuleRepository([cpuRule]);
      const samples = new FakeAlertSampleRepository();
      const publisher = new DashboardEventPublisher();
      const received: DashboardEvent[] = [];
      publisher.subscribe((event) => received.push(event));
      const coordinator = new AlertIngestionCoordinator(
        rules,
        samples,
        evaluator,
        publisher,
      );

      await coordinator.afterInsert({
        agentId,
        collectedAt: now,
        hostId,
        metrics,
        receivedAt: now,
      });

      expect(received).toEqual([]);
    },
  );

  it('only evaluates enabled rules whose metric is present in the ingested sample', async () => {
    const repository = new FakeAlertRepository();
    const evaluator = new AlertEvaluatorService(repository, () => now);
    const rules = new FakeAlertRuleRepository([cpuRule, memoryRule]);
    const samples = new FakeAlertSampleRepository();
    const publisher = new DashboardEventPublisher();
    const received: DashboardEvent[] = [];
    publisher.subscribe((event) => received.push(event));
    const coordinator = new AlertIngestionCoordinator(
      rules,
      samples,
      evaluator,
      publisher,
    );

    await coordinator.afterInsert({
      agentId,
      collectedAt: now,
      hostId,
      metrics: { cpuPercent: 95 },
      receivedAt: now,
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.payload).toMatchObject({ metric: 'cpuPercent' });
  });

  it('swallows an evaluation error for one rule, logs it, and still evaluates the remaining rules', async () => {
    const repository = new FakeAlertRepository();
    const evaluator = new AlertEvaluatorService(repository, () => now);
    const rules = new FakeAlertRuleRepository([cpuRule, memoryRule]);
    const samples = new FakeAlertSampleRepository();
    samples.findRecentSamples = jest
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error('db unavailable')))
      .mockImplementationOnce(() => Promise.resolve([]));
    const publisher = new DashboardEventPublisher();
    const received: DashboardEvent[] = [];
    publisher.subscribe((event) => received.push(event));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const coordinator = new AlertIngestionCoordinator(
      rules,
      samples,
      evaluator,
      publisher,
    );

    await expect(
      coordinator.afterInsert({
        agentId,
        collectedAt: now,
        hostId,
        metrics: { cpuPercent: 95, memoryUsedPercent: 95 },
        receivedAt: now,
      }),
    ).resolves.toBeUndefined();

    expect(received).toEqual([
      {
        hostId,
        occurredAt: now.toISOString(),
        payload: {
          agentId,
          metric: 'memoryUsedPercent',
          observedValue: 95,
          ruleId: 'rule-memory',
          ruleName: 'High memory',
          severity: 'warning',
        },
        type: 'alert.opened',
        version: 1,
      },
    ]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0] as [string];
    expect(message).toContain('rule-cpu');
    errorSpy.mockRestore();
  });
});
