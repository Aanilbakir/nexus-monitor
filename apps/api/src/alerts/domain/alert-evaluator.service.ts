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
  ): Promise<AlertEvaluatorOutcome> {
    const result = evaluateAlertRule(rule, samples);

    if (result.state === 'INSUFFICIENT_DATA') {
      return 'insufficient_data';
    }

    const dedupeKey = buildDedupeKey(rule.id, agentId);

    if (result.state === 'BREACHING') {
      return this.repository.openIfAbsent({
        agentId,
        dedupeKey,
        id: this.idFactory(),
        observedValue: result.observedValue,
        openedAt: this.clock(),
        ruleId: rule.id,
      });
    }

    const active = await this.repository.findActive(dedupeKey);
    if (!active) {
      return 'no_active_instance';
    }

    const resolved = await this.repository.resolve(active.id, this.clock());
    return resolved ? 'resolved' : 'no_active_instance';
  }
}
