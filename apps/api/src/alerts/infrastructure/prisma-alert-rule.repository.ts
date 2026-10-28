import type { PrismaClient } from '@nexus-monitor/database';

import type { ComparisonOperator } from '../domain/alert-evaluation.js';
import type {
  AlertRuleRepository,
  PersistedAlertRule,
} from '../domain/alert-rule-repository.js';

export class PrismaAlertRuleRepository implements AlertRuleRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findEnabledRules(): Promise<readonly PersistedAlertRule[]> {
    const rules = await this.prisma.alertRule.findMany({
      where: { enabled: true },
      select: {
        comparison: true,
        durationSeconds: true,
        enabled: true,
        id: true,
        metric: true,
        name: true,
        severity: true,
        threshold: true,
      },
    });

    return rules.map((rule) => ({
      comparison: rule.comparison as ComparisonOperator,
      durationSeconds: rule.durationSeconds,
      enabled: rule.enabled,
      id: rule.id,
      metric: rule.metric,
      name: rule.name,
      severity: rule.severity,
      threshold: rule.threshold,
    }));
  }
}
