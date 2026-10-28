import { AlertsQueryService } from './alerts-query.service.js';
import type {
  ActiveAlertSummary,
  AlertInstanceState,
  AlertRepository,
} from './alert-repository.js';

class FakeAlertRepository implements AlertRepository {
  public acknowledgeResult = true;
  public acknowledged: { readonly at: Date; readonly id: string } | null = null;
  public active: readonly ActiveAlertSummary[] = [];
  public state: AlertInstanceState | null = null;

  public acknowledge(id: string, at: Date): Promise<boolean> {
    this.acknowledged = { at, id };
    return Promise.resolve(this.acknowledgeResult);
  }

  public findActive(): Promise<null> {
    return Promise.resolve(null);
  }

  public findState(): Promise<AlertInstanceState | null> {
    return Promise.resolve(this.state);
  }

  public listActive(): Promise<readonly ActiveAlertSummary[]> {
    return Promise.resolve(this.active);
  }

  public openIfAbsent(): Promise<'already_active' | 'opened'> {
    throw new Error('not used in these tests');
  }

  public resolve(): Promise<boolean> {
    throw new Error('not used in these tests');
  }
}

function summary(
  overrides: Partial<ActiveAlertSummary> = {},
): ActiveAlertSummary {
  return {
    acknowledgedAt: null,
    agentId: 'agent-1',
    dedupeKey: 'rule-1:agent-1',
    id: 'instance-1',
    metric: 'cpuPercent',
    observedValue: 95,
    openedAt: new Date('2026-08-21T10:00:00.000Z'),
    ruleId: 'rule-1',
    ruleName: 'High CPU',
    severity: 'critical',
    state: 'OPEN',
    ...overrides,
  };
}

describe('AlertsQueryService', () => {
  describe('listActive', () => {
    it('returns active alerts sorted with the most recently opened first', async () => {
      const older = summary({
        id: 'older',
        openedAt: new Date('2026-08-21T09:00:00.000Z'),
      });
      const newer = summary({
        id: 'newer',
        openedAt: new Date('2026-08-21T11:00:00.000Z'),
      });
      const repository = new FakeAlertRepository();
      repository.active = [older, newer];
      const service = new AlertsQueryService(repository);

      await expect(service.listActive()).resolves.toEqual([newer, older]);
    });
  });

  describe('acknowledge', () => {
    const now = new Date('2026-08-21T10:05:00.000Z');

    it('reports not_found for an unknown instance', async () => {
      const repository = new FakeAlertRepository();
      repository.state = null;
      const service = new AlertsQueryService(repository, () => now);

      await expect(service.acknowledge('missing')).resolves.toEqual({
        outcome: 'not_found',
      });
      expect(repository.acknowledged).toBeNull();
    });

    it('reports conflict when the instance is no longer open', async () => {
      const repository = new FakeAlertRepository();
      repository.state = 'ACKNOWLEDGED';
      const service = new AlertsQueryService(repository, () => now);

      await expect(service.acknowledge('instance-1')).resolves.toEqual({
        outcome: 'conflict',
      });
      expect(repository.acknowledged).toBeNull();
    });

    it('reports conflict when the instance was already resolved', async () => {
      const repository = new FakeAlertRepository();
      repository.state = 'RESOLVED';
      const service = new AlertsQueryService(repository, () => now);

      await expect(service.acknowledge('instance-1')).resolves.toEqual({
        outcome: 'conflict',
      });
    });

    it('acknowledges an open instance using the injected clock', async () => {
      const repository = new FakeAlertRepository();
      repository.state = 'OPEN';
      const service = new AlertsQueryService(repository, () => now);

      await expect(service.acknowledge('instance-1')).resolves.toEqual({
        at: now,
        outcome: 'acknowledged',
      });
      expect(repository.acknowledged).toEqual({ at: now, id: 'instance-1' });
    });

    it('reports conflict when the acknowledge CAS loses a race', async () => {
      const repository = new FakeAlertRepository();
      repository.state = 'OPEN';
      repository.acknowledgeResult = false;
      const service = new AlertsQueryService(repository, () => now);

      await expect(service.acknowledge('instance-1')).resolves.toEqual({
        outcome: 'conflict',
      });
    });
  });
});
