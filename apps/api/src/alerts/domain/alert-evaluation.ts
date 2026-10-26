export type ComparisonOperator = '<' | '<=' | '>' | '>=';

export interface AlertRule {
  readonly comparison: ComparisonOperator;
  readonly durationSeconds: number;
  readonly id: string;
  readonly threshold: number;
}

export interface MetricSample {
  readonly collectedAt: Date;
  readonly value: number;
}

export type AlertEvaluationResult =
  | { readonly state: 'INSUFFICIENT_DATA' }
  | { readonly observedValue: number; readonly state: 'BREACHING' | 'CLEAR' };

export function buildDedupeKey(ruleId: string, agentId: string): string {
  return `${ruleId}:${agentId}`;
}

/** `samples` must already be scoped to a single agent. */
export function evaluateAlertRule(
  rule: AlertRule,
  samples: readonly MetricSample[],
): AlertEvaluationResult {
  const sortedSamples = [...samples].sort(
    (a, b) => a.collectedAt.getTime() - b.collectedAt.getTime(),
  );

  const latest = sortedSamples[sortedSamples.length - 1];
  if (!latest) {
    return { state: 'INSUFFICIENT_DATA' };
  }

  const windowStartMilliseconds =
    latest.collectedAt.getTime() - rule.durationSeconds * 1_000;
  const windowSamples = sortedSamples.filter(
    (sample) => sample.collectedAt.getTime() >= windowStartMilliseconds,
  );

  if (windowSamples.some((sample) => !Number.isFinite(sample.value))) {
    return { state: 'INSUFFICIENT_DATA' };
  }

  const breaching = windowSamples.every((sample) =>
    compare(rule.comparison, sample.value, rule.threshold),
  );

  return {
    observedValue: latest.value,
    state: breaching ? 'BREACHING' : 'CLEAR',
  };
}

function compare(
  comparison: ComparisonOperator,
  value: number,
  threshold: number,
): boolean {
  switch (comparison) {
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
  }
}
