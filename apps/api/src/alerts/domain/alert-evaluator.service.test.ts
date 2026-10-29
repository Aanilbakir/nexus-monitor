import type { AlertRule, MetricSample } from './alert-evaluation.js';
import { AlertEvaluatorService } from './alert-evaluator.service.js';
import type {
  ActiveAlertInstance,
  AlertRepository,
  OpenAlertInstanceInput,
} from './alert-repository.js';

class FakeAlertRepository implements AlertRepository {
  public active: ActiveAlertInstance | null = null;
  public opened: OpenAlertInstanceInput | null = null;
  public openResult: 'already_active' | 'opened' = 'opened';
  public resolveResult = true;
  public resolved: { readonly at: Date; readonly id: string } | null = null;

  public acknowledge(): Promise<boolean> {
    throw new Error('not used in these tests');
  }

  public findActive(): Promise<ActiveAlertInstance | null> {
    return Promise.resolve(this.active);
  }

  public openIfAbsent(
    input: OpenAlertInstanceInput,
  ): Promise<'already_active' | 'opened'> {
    this.opened = input;
    return Promise.resolve(this.openResult);
  }

  public resolve(id: string, at: Date): Promise<boolean> {
    this.resolved = { at, id };
    return Promise.resolve(this.resolveResult);
  }
}

const rule: AlertRule = {
  comparison: '>',
  durationSeconds: 0,
  id: 'rule-1',
  threshold: 80,
};
const agentId = 'agent-1';
const now = new Date('2026-08-21T10:00:00.000Z');

function sample(value: number): MetricSample {
  return { collectedAt: now, value };
}

describe('AlertEvaluatorService', () => {
  it('opens a new alert when the rule is breaching', async () => {
    const repository = new FakeAlertRepository();
    const service = new AlertEvaluatorService(
      repository,
      () => now,
      () => 'instance-1',
    );

    await expect(
      service.evaluate(rule, agentId, [sample(90)]),
    ).resolves.toEqual({ alertId: 'instance-1', outcome: 'opened' });
    expect(repository.opened).toEqual({
      agentId,
      dedupeKey: 'rule-1:agent-1',
      id: 'instance-1',
      observedValue: 90,
      openedAt: now,
      ruleId: 'rule-1',
    });
  });

  it('reports an already-active alert without duplicating it', async () => {
    const repository = new FakeAlertRepository();
    repository.openResult = 'already_active';
    const service = new AlertEvaluatorService(repository, () => now);

    await expect(
      service.evaluate(rule, agentId, [sample(90)]),
    ).resolves.toEqual({ alertId: null, outcome: 'already_active' });
  });

  it('resolves the active alert when the rule clears', async () => {
    const repository = new FakeAlertRepository();
    repository.active = {
      agentId,
      dedupeKey: 'rule-1:agent-1',
      id: 'instance-1',
      observedValue: 90,
      openedAt: now,
      ruleId: 'rule-1',
      state: 'OPEN',
    };
    const service = new AlertEvaluatorService(repository, () => now);

    await expect(
      service.evaluate(rule, agentId, [sample(10)]),
    ).resolves.toEqual({ alertId: 'instance-1', outcome: 'resolved' });
    expect(repository.resolved).toEqual({ at: now, id: 'instance-1' });
  });

  it('does nothing when the rule clears and there is no active alert', async () => {
    const repository = new FakeAlertRepository();
    const service = new AlertEvaluatorService(repository, () => now);

    await expect(
      service.evaluate(rule, agentId, [sample(10)]),
    ).resolves.toEqual({ alertId: null, outcome: 'no_active_instance' });
  });

  it('takes no action when there is insufficient data', async () => {
    const repository = new FakeAlertRepository();
    const service = new AlertEvaluatorService(repository, () => now);

    await expect(service.evaluate(rule, agentId, [])).resolves.toEqual({
      alertId: null,
      outcome: 'insufficient_data',
    });
    expect(repository.opened).toBeNull();
  });

  it('reports no active instance when the clearing resolve loses a race', async () => {
    const repository = new FakeAlertRepository();
    repository.active = {
      agentId,
      dedupeKey: 'rule-1:agent-1',
      id: 'instance-1',
      observedValue: 90,
      openedAt: now,
      ruleId: 'rule-1',
      state: 'OPEN',
    };
    repository.resolveResult = false;
    const service = new AlertEvaluatorService(repository, () => now);

    await expect(
      service.evaluate(rule, agentId, [sample(10)]),
    ).resolves.toEqual({ alertId: null, outcome: 'no_active_instance' });
  });
});
