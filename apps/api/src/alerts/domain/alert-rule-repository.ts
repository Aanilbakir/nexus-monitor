import type { ComparisonOperator } from './alert-evaluation.js';

export interface PersistedAlertRule {
  readonly comparison: ComparisonOperator;
  readonly durationSeconds: number;
  readonly enabled: boolean;
  readonly id: string;
  readonly metric: string;
  readonly name: string;
  readonly severity: string;
  readonly threshold: number;
}

export interface AlertRuleRepository {
  findEnabledRules(): Promise<readonly PersistedAlertRule[]>;
}
