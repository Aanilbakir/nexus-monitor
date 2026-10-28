import type { SystemMetricSample } from '@nexus-monitor/contracts';

import { CredentialService } from './credential.service.js';
import {
  InvalidMetricSampleError,
  MetricService,
  type MetricAlertHook,
  type MetricAlertHookInput,
  type MetricRepository,
} from './metric.service.js';
import { UnauthorizedAgentError } from './agent.service.js';
import { DashboardEventPublisher } from '../../dashboard/domain/dashboard-event.publisher.js';
import { AlertEvaluatorService } from '../../alerts/domain/alert-evaluator.service.js';
import { AlertIngestionCoordinator } from '../../alerts/domain/alert-ingestion.coordinator.js';
import type {
  AlertRuleRepository,
  PersistedAlertRule,
} from '../../alerts/domain/alert-rule-repository.js';
import type { AlertSampleRepository } from '../../alerts/domain/alert-sample-repository.js';
import type {
  ActiveAlertInstance,
  AlertRepository,
} from '../../alerts/domain/alert-repository.js';

const agentId = '11111111-1111-4111-8111-111111111111';
const hostId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-08-21T10:00:00.000Z');
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

class InMemoryMetricRepository implements MetricRepository {
  public credentialHash: string | null = null;
  public duplicate = false;
  public inserted: Parameters<MetricRepository['insert']>[0] | null = null;

  public findAgentIdentity() {
    return Promise.resolve(
      this.credentialHash
        ? { credentialHash: this.credentialHash, hostId }
        : null,
    );
  }

  public insert(input: Parameters<MetricRepository['insert']>[0]) {
    this.inserted = input;
    return Promise.resolve(
      this.duplicate ? ('duplicate' as const) : ('inserted' as const),
    );
  }
}

describe('MetricService', () => {
  function createService(repository: InMemoryMetricRepository): MetricService {
    return new MetricService(
      repository,
      new CredentialService('enrollment-secret'),
      () => now,
    );
  }

  it('authenticates and persists a validated sample with server receipt time', async () => {
    const repository = new InMemoryMetricRepository();
    const credentials = new CredentialService('enrollment-secret');
    repository.credentialHash = credentials.hash('agent-secret');
    const service = new MetricService(repository, credentials, () => now);

    await expect(
      service.ingest(agentId, 'agent-secret', sample),
    ).resolves.toEqual({
      collectedAt: sample.collectedAt,
      metricsIntervalSeconds: 15,
      receivedAt: now.toISOString(),
    });
    expect(repository.inserted).toEqual({
      agentId,
      collectedAt: new Date(sample.collectedAt),
      cpuPercent: 25,
      diskFreeBytes: 400n,
      diskTotalBytes: 1_000n,
      diskUsedBytes: 500n,
      memoryTotalBytes: 1_000n,
      memoryUsedBytes: 600n,
      networkReceivedBytes: 2_000n,
      networkTransmittedBytes: 1_500n,
      receivedAt: now,
      uptimeSeconds: 3_600n,
    });
  });

  it('treats a duplicate sample as idempotent success', async () => {
    const repository = new InMemoryMetricRepository();
    const credentials = new CredentialService('enrollment-secret');
    repository.credentialHash = credentials.hash('agent-secret');
    repository.duplicate = true;

    await expect(
      new MetricService(repository, credentials, () => now).ingest(
        agentId,
        'agent-secret',
        sample,
      ),
    ).resolves.toMatchObject({ collectedAt: sample.collectedAt });
  });

  it('publishes inserted metrics but not idempotent duplicates', async () => {
    const repository = new InMemoryMetricRepository();
    const credentials = new CredentialService('enrollment-secret');
    repository.credentialHash = credentials.hash('agent-secret');
    const publisher = new DashboardEventPublisher();
    const events: unknown[] = [];
    publisher.subscribe((event) => events.push(event));
    const service = new MetricService(
      repository,
      credentials,
      () => now,
      publisher,
    );

    await service.ingest(agentId, 'agent-secret', sample);
    repository.duplicate = true;
    await service.ingest(agentId, 'agent-secret', sample);

    expect(events).toEqual([
      {
        hostId,
        occurredAt: now.toISOString(),
        payload: {
          collectedAt: sample.collectedAt,
          cpuPercent: 25,
          diskFreeBytes: '400',
          diskTotalBytes: '1000',
          diskUsedBytes: '500',
          memoryTotalBytes: '1000',
          memoryUsedBytes: '600',
          networkReceivedBytes: '2000',
          networkTransmittedBytes: '1500',
          uptimeSeconds: '3600',
        },
        type: 'host.metric',
        version: 1,
      },
    ]);
  });

  it('rejects unknown and invalid credentials uniformly', async () => {
    const repository = new InMemoryMetricRepository();
    const service = createService(repository);

    await expect(
      service.ingest(agentId, 'wrong', sample),
    ).rejects.toBeInstanceOf(UnauthorizedAgentError);
    repository.credentialHash = new CredentialService('x').hash('right');
    await expect(
      service.ingest(agentId, 'wrong', sample),
    ).rejects.toBeInstanceOf(UnauthorizedAgentError);
  });

  it('rejects invalid samples before persistence', async () => {
    const repository = new InMemoryMetricRepository();
    const credentials = new CredentialService('enrollment-secret');
    repository.credentialHash = credentials.hash('agent-secret');

    await expect(
      new MetricService(repository, credentials, () => now).ingest(
        agentId,
        'agent-secret',
        { ...sample, collectedAt: '2026-08-21T10:05:00.001Z' },
      ),
    ).rejects.toBeInstanceOf(InvalidMetricSampleError);
    expect(repository.inserted).toBeNull();
  });

  describe('alert hook', () => {
    class RecordingAlertHook implements MetricAlertHook {
      public calls: MetricAlertHookInput[] = [];

      public afterInsert(input: MetricAlertHookInput): Promise<void> {
        this.calls.push(input);
        return Promise.resolve();
      }
    }

    it('invokes the alert hook with the derived metrics after a sample is inserted', async () => {
      const repository = new InMemoryMetricRepository();
      const credentials = new CredentialService('enrollment-secret');
      repository.credentialHash = credentials.hash('agent-secret');
      const alertHook = new RecordingAlertHook();
      const service = new MetricService(
        repository,
        credentials,
        () => now,
        new DashboardEventPublisher(),
        alertHook,
      );

      await service.ingest(agentId, 'agent-secret', sample);

      expect(alertHook.calls).toEqual([
        {
          agentId,
          collectedAt: new Date(sample.collectedAt),
          hostId,
          metrics: {
            cpuPercent: 25,
            diskUsedPercent: 50,
            memoryUsedPercent: 60,
          },
          receivedAt: now,
        },
      ]);
    });

    it('does not invoke the alert hook for an idempotent duplicate', async () => {
      const repository = new InMemoryMetricRepository();
      const credentials = new CredentialService('enrollment-secret');
      repository.credentialHash = credentials.hash('agent-secret');
      repository.duplicate = true;
      const alertHook = new RecordingAlertHook();
      const service = new MetricService(
        repository,
        credentials,
        () => now,
        new DashboardEventPublisher(),
        alertHook,
      );

      await service.ingest(agentId, 'agent-secret', sample);

      expect(alertHook.calls).toEqual([]);
    });

    it('swallows and logs an alert hook failure without failing ingestion', async () => {
      const repository = new InMemoryMetricRepository();
      const credentials = new CredentialService('enrollment-secret');
      repository.credentialHash = credentials.hash('agent-secret');
      const alertHook: MetricAlertHook = {
        afterInsert: () => Promise.reject(new Error('rule engine down')),
      };
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const service = new MetricService(
        repository,
        credentials,
        () => now,
        new DashboardEventPublisher(),
        alertHook,
      );

      await expect(
        service.ingest(agentId, 'agent-secret', sample),
      ).resolves.toEqual({
        collectedAt: sample.collectedAt,
        metricsIntervalSeconds: 15,
        receivedAt: now.toISOString(),
      });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [message, error] = errorSpy.mock.calls[0] as [string, unknown];
      expect(message).not.toContain('agent-secret');
      expect(error).toBeInstanceOf(Error);
      errorSpy.mockRestore();
    });

    it('wires a real AlertIngestionCoordinator end to end: ingestion evaluates rules and publishes the alert transition', async () => {
      class FakeAlertRepository implements AlertRepository {
        public active: ActiveAlertInstance | null = null;

        public acknowledge(): Promise<boolean> {
          throw new Error('not used in this test');
        }

        public findActive(): Promise<ActiveAlertInstance | null> {
          return Promise.resolve(this.active);
        }

        public openIfAbsent(): Promise<'already_active' | 'opened'> {
          return Promise.resolve('opened');
        }

        public resolve(): Promise<boolean> {
          throw new Error('not used in this test');
        }
      }

      class FakeAlertRuleRepository implements AlertRuleRepository {
        public findEnabledRules(): Promise<readonly PersistedAlertRule[]> {
          return Promise.resolve([
            {
              comparison: '>',
              durationSeconds: 0,
              enabled: true,
              id: 'rule-cpu',
              metric: 'cpuPercent',
              name: 'High CPU',
              severity: 'critical',
              threshold: 20,
            },
          ]);
        }
      }

      class FakeAlertSampleRepository implements AlertSampleRepository {
        public findRecentSamples(): Promise<
          readonly { collectedAt: Date; value: number }[]
        > {
          return Promise.resolve([]);
        }
      }

      const repository = new InMemoryMetricRepository();
      const credentials = new CredentialService('enrollment-secret');
      repository.credentialHash = credentials.hash('agent-secret');
      const dashboardEvents = new DashboardEventPublisher();
      const publishedEvents: unknown[] = [];
      dashboardEvents.subscribe((event) => publishedEvents.push(event));
      const alertRepository = new FakeAlertRepository();
      const coordinator = new AlertIngestionCoordinator(
        new FakeAlertRuleRepository(),
        new FakeAlertSampleRepository(),
        new AlertEvaluatorService(alertRepository, () => now),
        dashboardEvents,
      );
      const service = new MetricService(
        repository,
        credentials,
        () => now,
        dashboardEvents,
        coordinator,
      );

      await service.ingest(agentId, 'agent-secret', sample);

      expect(publishedEvents).toContainEqual({
        hostId,
        occurredAt: now.toISOString(),
        payload: {
          agentId,
          metric: 'cpuPercent',
          observedValue: 25,
          ruleId: 'rule-cpu',
          ruleName: 'High CPU',
          severity: 'critical',
        },
        type: 'alert.opened',
        version: 1,
      });
    });
  });
});
