import { randomUUID } from 'node:crypto';

import {
  buildDedupeKey,
  evaluateAlertRule,
  type AlertRule,
  type MetricSample,
} from './alert-evaluation.js';
import type { AlertRepository } from './alert-repository.js';

export type Clock = () => Date;

export type AlertEvaluatorOutcome =
  | 'already_active'
  | 'insufficient_data'
  | 'no_active_instance'
  | 'opened'
  | 'resolved';

export interface AlertEvaluationResult {
  /** Set when `outcome` is `opened` or `resolved`, otherwise null. */
  readonly alertId: string | null;
  readonly outcome: AlertEvaluatorOutcome;
}

export class AlertEvaluatorService {
  public constructor(
    private readonly repository: AlertRepository,
    private readonly clock: Clock = () => new Date(),
    private readonly idFactory: () => string = randomUUID,
  ) {}

  public async evaluate(
    rule: AlertRule,
    agentId: string,
    samples: readonly MetricSample[],
  ): Promise<AlertEvaluationResult> {
    const result = evaluateAlertRule(rule, samples);

    if (result.state === 'INSUFFICIENT_DATA') {
      return { alertId: null, outcome: 'insufficient_data' };
    }

    const dedupeKey = buildDedupeKey(rule.id, agentId);

    if (result.state === 'BREACHING') {
      const id = this.idFactory();
      const outcome = await this.repository.openIfAbsent({
        agentId,
        dedupeKey,
        id,
        observedValue: result.observedValue,
        openedAt: this.clock(),
        ruleId: rule.id,
      });
      return { alertId: outcome === 'opened' ? id : null, outcome };
    }

    const active = await this.repository.findActive(dedupeKey);
    if (!active) {
      return { alertId: null, outcome: 'no_active_instance' };
    }

    const resolved = await this.repository.resolve(active.id, this.clock());
    return resolved
      ? { alertId: active.id, outcome: 'resolved' }
      : { alertId: null, outcome: 'no_active_instance' };
  }
}
