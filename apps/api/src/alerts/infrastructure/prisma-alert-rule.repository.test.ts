import type { PrismaClient } from '@nexus-monitor/database';

import { PrismaAlertRuleRepository } from './prisma-alert-rule.repository.js';

describe('PrismaAlertRuleRepository', () => {
  describe('findEnabledRules', () => {
    it('queries only enabled rules and maps them to the evaluator shape', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          comparison: '>',
          durationSeconds: 300,
          enabled: true,
          id: 'rule-cpu',
          metric: 'cpuPercent',
          name: 'High CPU',
          severity: 'critical',
          threshold: 90,
        },
      ]);
      const prisma = {
        alertRule: { findMany },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRuleRepository(prisma).findEnabledRules(),
      ).resolves.toEqual([
        {
          comparison: '>',
          durationSeconds: 300,
          enabled: true,
          id: 'rule-cpu',
          metric: 'cpuPercent',
          name: 'High CPU',
          severity: 'critical',
          threshold: 90,
        },
      ]);
      expect(findMany).toHaveBeenCalledWith({
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
    });

    it('returns an empty list when no rules are enabled', async () => {
      const prisma = {
        alertRule: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRuleRepository(prisma).findEnabledRules(),
      ).resolves.toEqual([]);
    });
  });
});
