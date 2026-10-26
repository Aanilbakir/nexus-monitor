import type { PrismaClient } from '@nexus-monitor/database';

import type {
  ActiveAlertInstance,
  AlertInstanceState,
  AlertRepository,
  OpenAlertInstanceInput,
} from '../domain/alert-repository.js';

export class PrismaAlertRepository implements AlertRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async acknowledge(id: string, at: Date): Promise<boolean> {
    return this.applyTransition(id, 'OPEN', 'ACKNOWLEDGED', at, {
      acknowledgedAt: at,
    });
  }

  public async findActive(
    dedupeKey: string,
  ): Promise<ActiveAlertInstance | null> {
    const instance = await this.prisma.alertInstance.findFirst({
      where: { dedupeKey, state: { not: 'RESOLVED' } },
      select: {
        agentId: true,
        dedupeKey: true,
        id: true,
        observedValue: true,
        openedAt: true,
        ruleId: true,
        state: true,
      },
    });

    return instance
      ? { ...instance, state: instance.state as AlertInstanceState }
      : null;
  }

  public async openIfAbsent(
    input: OpenAlertInstanceInput,
  ): Promise<'already_active' | 'opened'> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.alertInstance.create({
          data: {
            agentId: input.agentId,
            dedupeKey: input.dedupeKey,
            id: input.id,
            observedValue: input.observedValue,
            openedAt: input.openedAt,
            ruleId: input.ruleId,
            state: 'OPEN',
          },
          select: { id: true },
        });

        await transaction.alertTransition.create({
          data: {
            alertInstanceId: input.id,
            fromState: null,
            occurredAt: input.openedAt,
            toState: 'OPEN',
          },
        });
      });
      return 'opened';
    } catch (error) {
      if (isDedupeKeyConflict(error)) return 'already_active';
      throw error;
    }
  }

  public async resolve(id: string, at: Date): Promise<boolean> {
    const resolvedFromOpen = await this.applyTransition(
      id,
      'OPEN',
      'RESOLVED',
      at,
      { resolvedAt: at },
    );
    if (resolvedFromOpen) return true;

    return this.applyTransition(id, 'ACKNOWLEDGED', 'RESOLVED', at, {
      resolvedAt: at,
    });
  }

  private async applyTransition(
    id: string,
    fromState: AlertInstanceState,
    toState: AlertInstanceState,
    at: Date,
    extra: Record<string, Date>,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.alertInstance.updateMany({
        where: { id, state: fromState },
        data: { state: toState, ...extra },
      });

      if (updated.count === 0) {
        return false;
      }

      await transaction.alertTransition.create({
        data: {
          alertInstanceId: id,
          fromState,
          occurredAt: at,
          toState,
        },
      });

      return true;
    });
  }
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function isDedupeKeyConflict(error: unknown): boolean {
  if (!isPrismaUniqueConflict(error)) return false;

  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (target === undefined) return true;

  if (Array.isArray(target)) return target.includes('dedupeKey');

  if (typeof target === 'string') {
    return (
      target.includes('dedupeKey') ||
      target.includes('AlertInstance_dedupeKey_active_key')
    );
  }

  return true;
}
