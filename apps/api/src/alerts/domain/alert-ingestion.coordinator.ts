import type { DashboardEvent } from '@nexus-monitor/contracts';

import type {
  MetricAlertHook,
  MetricAlertHookInput,
} from '../../agents/domain/metric.service.js';
import type { DashboardEventPublisher } from '../../dashboard/domain/dashboard-event.publisher.js';
import type { AlertEvaluatorService } from './alert-evaluator.service.js';
import type {
  AlertRuleRepository,
  PersistedAlertRule,
} from './alert-rule-repository.js';
import type { AlertSampleRepository } from './alert-sample-repository.js';

/**
 * Runs enabled alert rules against a just-ingested metric sample and publishes
 * the resulting `alert.opened`/`alert.resolved` transitions. A failure
 * evaluating one rule must never block ingestion or the remaining rules.
 */
export class AlertIngestionCoordinator implements MetricAlertHook {
  public constructor(
    private readonly rules: AlertRuleRepository,
    private readonly samples: AlertSampleRepository,
    private readonly evaluator: AlertEvaluatorService,
    private readonly dashboardEvents: DashboardEventPublisher,
  ) {}

  public async afterInsert(input: MetricAlertHookInput): Promise<void> {
    const enabledRules = await this.rules.findEnabledRules();

    const outcomes = await Promise.allSettled(
      enabledRules.map((rule) => this.evaluateIfApplicable(rule, input)),
    );

    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'rejected') {
        console.error(
          `Alert rule evaluation failed for rule ${enabledRules[index]?.id}.`,
          outcome.reason,
        );
      }
    });
  }

  private async evaluateIfApplicable(
    rule: PersistedAlertRule,
    input: MetricAlertHookInput,
  ): Promise<void> {
    const currentValue = input.metrics[rule.metric];
    if (currentValue === undefined) {
      return;
    }

    await this.evaluateRule(rule, input, currentValue);
  }

  private async evaluateRule(
    rule: PersistedAlertRule,
    input: MetricAlertHookInput,
    currentValue: number,
  ): Promise<void> {
    const windowStart = new Date(
      input.collectedAt.getTime() - rule.durationSeconds * 1_000,
    );
    const history = await this.samples.findRecentSamples(
      input.agentId,
      rule.metric,
      windowStart,
    );
    const samples = [
      ...history,
      { collectedAt: input.collectedAt, value: currentValue },
    ];

    const outcome = await this.evaluator.evaluate(rule, input.agentId, samples);
    if (outcome !== 'opened' && outcome !== 'resolved') {
      return;
    }

    const event: DashboardEvent = {
      hostId: input.hostId,
      occurredAt: input.receivedAt.toISOString(),
      payload: {
        agentId: input.agentId,
        metric: rule.metric,
        observedValue: currentValue,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
      },
      type: outcome === 'opened' ? 'alert.opened' : 'alert.resolved',
      version: 1,
    };
    this.dashboardEvents.publish(event);
  }
}
