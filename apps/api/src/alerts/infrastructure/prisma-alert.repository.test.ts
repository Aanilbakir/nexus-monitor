import type { PrismaClient } from '@nexus-monitor/database';

import type { OpenAlertInstanceInput } from '../domain/alert-repository.js';
import { PrismaAlertRepository } from './prisma-alert.repository.js';

const openInput: OpenAlertInstanceInput = {
  agentId: 'agent-1',
  dedupeKey: 'rule-1:agent-1',
  id: 'instance-1',
  observedValue: 95,
  openedAt: new Date('2026-08-21T10:00:00.000Z'),
  ruleId: 'rule-1',
};

function prismaWithTransaction(transactionClient: unknown): PrismaClient {
  return {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      Promise.resolve(callback(transactionClient)),
    ),
  } as unknown as PrismaClient;
}

describe('PrismaAlertRepository', () => {
  describe('openIfAbsent', () => {
    it('opens a new alert instance with an initial transition', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'instance-1' });
      const transitionCreate = jest.fn().mockResolvedValue({});
      const prisma = prismaWithTransaction({
        alertInstance: { create },
        alertTransition: { create: transitionCreate },
      });

      await expect(
        new PrismaAlertRepository(prisma).openIfAbsent(openInput),
      ).resolves.toBe('opened');

      expect(create).toHaveBeenCalledWith({
        data: {
          agentId: 'agent-1',
          dedupeKey: 'rule-1:agent-1',
          id: 'instance-1',
          observedValue: 95,
          openedAt: openInput.openedAt,
          ruleId: 'rule-1',
          state: 'OPEN',
        },
        select: { id: true },
      });
      expect(transitionCreate).toHaveBeenCalledWith({
        data: {
          alertInstanceId: 'instance-1',
          fromState: null,
          occurredAt: openInput.openedAt,
          toState: 'OPEN',
        },
      });
    });

    it('treats a unique violation as an already-active instance', async () => {
      const create = jest.fn().mockRejectedValue(
        Object.assign(new Error('unique conflict'), {
          code: 'P2002',
          meta: { target: ['dedupeKey'] },
        }),
      );
      const prisma = prismaWithTransaction({
        alertInstance: { create },
        alertTransition: { create: jest.fn() },
      });

      await expect(
        new PrismaAlertRepository(prisma).openIfAbsent(openInput),
      ).resolves.toBe('already_active');
    });

    it('treats a unique violation on the dedupe key index name as an already-active instance', async () => {
      const create = jest.fn().mockRejectedValue(
        Object.assign(new Error('unique conflict'), {
          code: 'P2002',
          meta: { target: 'AlertInstance_dedupeKey_active_key' },
        }),
      );
      const prisma = prismaWithTransaction({
        alertInstance: { create },
        alertTransition: { create: jest.fn() },
      });

      await expect(
        new PrismaAlertRepository(prisma).openIfAbsent(openInput),
      ).resolves.toBe('already_active');
    });

    it('rethrows a unique violation on an unrelated constraint target array', async () => {
      const failure = Object.assign(new Error('unique conflict'), {
        code: 'P2002',
        meta: { target: ['id'] },
      });
      const create = jest.fn().mockRejectedValue(failure);
      const prisma = prismaWithTransaction({
        alertInstance: { create },
        alertTransition: { create: jest.fn() },
      });

      await expect(
        new PrismaAlertRepository(prisma).openIfAbsent(openInput),
      ).rejects.toBe(failure);
    });

    it('rethrows a unique violation on an unrelated constraint name', async () => {
      const failure = Object.assign(new Error('unique conflict'), {
        code: 'P2002',
        meta: { target: 'AlertInstance_pkey' },
      });
      const create = jest.fn().mockRejectedValue(failure);
      const prisma = prismaWithTransaction({
        alertInstance: { create },
        alertTransition: { create: jest.fn() },
      });

      await expect(
        new PrismaAlertRepository(prisma).openIfAbsent(openInput),
      ).rejects.toBe(failure);
    });

    it('propagates unrelated database failures', async () => {
      const failure = new Error('database unavailable');
      const create = jest.fn().mockRejectedValue(failure);
      const prisma = prismaWithTransaction({
        alertInstance: { create },
        alertTransition: { create: jest.fn() },
      });

      await expect(
        new PrismaAlertRepository(prisma).openIfAbsent(openInput),
      ).rejects.toBe(failure);
    });

    it('is idempotent when opening the same dedupe key twice', async () => {
      const create = jest
        .fn()
        .mockResolvedValueOnce({ id: 'instance-1' })
        .mockRejectedValueOnce(
          Object.assign(new Error('unique conflict'), { code: 'P2002' }),
        );
      const prisma = prismaWithTransaction({
        alertInstance: { create },
        alertTransition: { create: jest.fn().mockResolvedValue({}) },
      });
      const repository = new PrismaAlertRepository(prisma);

      await expect(repository.openIfAbsent(openInput)).resolves.toBe('opened');
      await expect(repository.openIfAbsent(openInput)).resolves.toBe(
        'already_active',
      );
    });
  });

  describe('findActive', () => {
    it('finds and maps the active instance for a dedupe key', async () => {
      const row = {
        agentId: 'agent-1',
        dedupeKey: 'rule-1:agent-1',
        id: 'instance-1',
        observedValue: 95,
        openedAt: new Date('2026-08-21T10:00:00.000Z'),
        ruleId: 'rule-1',
        state: 'ACKNOWLEDGED',
      };
      const findFirst = jest.fn().mockResolvedValue(row);
      const prisma = {
        alertInstance: { findFirst },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRepository(prisma).findActive('rule-1:agent-1'),
      ).resolves.toEqual(row);
      expect(findFirst).toHaveBeenCalledWith({
        where: { dedupeKey: 'rule-1:agent-1', state: { not: 'RESOLVED' } },
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
    });

    it('returns null when there is no active instance', async () => {
      const prisma = {
        alertInstance: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRepository(prisma).findActive('rule-1:agent-1'),
      ).resolves.toBeNull();
    });
  });

  describe('acknowledge', () => {
    it('acknowledges an open instance and records the transition', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const transitionCreate = jest.fn().mockResolvedValue({});
      const prisma = prismaWithTransaction({
        alertInstance: { updateMany },
        alertTransition: { create: transitionCreate },
      });
      const at = new Date('2026-08-21T10:05:00.000Z');

      await expect(
        new PrismaAlertRepository(prisma).acknowledge('instance-1', at),
      ).resolves.toBe(true);

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'instance-1', state: 'OPEN' },
        data: { state: 'ACKNOWLEDGED', acknowledgedAt: at },
      });
      expect(transitionCreate).toHaveBeenCalledWith({
        data: {
          alertInstanceId: 'instance-1',
          fromState: 'OPEN',
          occurredAt: at,
          toState: 'ACKNOWLEDGED',
        },
      });
    });

    it('returns false when the instance is no longer open', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const transitionCreate = jest.fn();
      const prisma = prismaWithTransaction({
        alertInstance: { updateMany },
        alertTransition: { create: transitionCreate },
      });

      await expect(
        new PrismaAlertRepository(prisma).acknowledge('instance-1', new Date()),
      ).resolves.toBe(false);
      expect(transitionCreate).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('resolves an open instance directly', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const transitionCreate = jest.fn().mockResolvedValue({});
      const prisma = prismaWithTransaction({
        alertInstance: { updateMany },
        alertTransition: { create: transitionCreate },
      });
      const at = new Date('2026-08-21T10:10:00.000Z');

      await expect(
        new PrismaAlertRepository(prisma).resolve('instance-1', at),
      ).resolves.toBe(true);

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'instance-1', state: 'OPEN' },
        data: { state: 'RESOLVED', resolvedAt: at },
      });
      expect(transitionCreate).toHaveBeenCalledWith({
        data: {
          alertInstanceId: 'instance-1',
          fromState: 'OPEN',
          occurredAt: at,
          toState: 'RESOLVED',
        },
      });
    });

    it('falls back to resolving an acknowledged instance when it is no longer open', async () => {
      const updateMany = jest
        .fn()
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      const transitionCreate = jest.fn().mockResolvedValue({});
      const prisma = prismaWithTransaction({
        alertInstance: { updateMany },
        alertTransition: { create: transitionCreate },
      });
      const at = new Date('2026-08-21T10:15:00.000Z');

      await expect(
        new PrismaAlertRepository(prisma).resolve('instance-1', at),
      ).resolves.toBe(true);

      expect(updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'instance-1', state: 'OPEN' },
        data: { state: 'RESOLVED', resolvedAt: at },
      });
      expect(updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'instance-1', state: 'ACKNOWLEDGED' },
        data: { state: 'RESOLVED', resolvedAt: at },
      });
      expect(transitionCreate).toHaveBeenCalledWith({
        data: {
          alertInstanceId: 'instance-1',
          fromState: 'ACKNOWLEDGED',
          occurredAt: at,
          toState: 'RESOLVED',
        },
      });
    });

    it('returns false when the instance is already resolved', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const transitionCreate = jest.fn();
      const prisma = prismaWithTransaction({
        alertInstance: { updateMany },
        alertTransition: { create: transitionCreate },
      });

      await expect(
        new PrismaAlertRepository(prisma).resolve('instance-1', new Date()),
      ).resolves.toBe(false);
      expect(transitionCreate).not.toHaveBeenCalled();
    });
  });

  describe('findState', () => {
    it('returns the current state of a known instance', async () => {
      const findUnique = jest.fn().mockResolvedValue({ state: 'ACKNOWLEDGED' });
      const prisma = {
        alertInstance: { findUnique },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRepository(prisma).findState('instance-1'),
      ).resolves.toBe('ACKNOWLEDGED');
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'instance-1' },
        select: { state: true },
      });
    });

    it('returns null for an unknown instance', async () => {
      const prisma = {
        alertInstance: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRepository(prisma).findState('missing'),
      ).resolves.toBeNull();
    });
  });

  describe('listActive', () => {
    it('lists non-resolved instances joined with their rule details', async () => {
      const row = {
        acknowledgedAt: null,
        agentId: 'agent-1',
        dedupeKey: 'rule-1:agent-1',
        id: 'instance-1',
        observedValue: 95,
        openedAt: new Date('2026-08-21T10:00:00.000Z'),
        rule: { metric: 'cpuPercent', name: 'High CPU', severity: 'critical' },
        ruleId: 'rule-1',
        state: 'OPEN',
      };
      const findMany = jest.fn().mockResolvedValue([row]);
      const prisma = {
        alertInstance: { findMany },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRepository(prisma).listActive(),
      ).resolves.toEqual([
        {
          acknowledgedAt: null,
          agentId: 'agent-1',
          dedupeKey: 'rule-1:agent-1',
          id: 'instance-1',
          metric: 'cpuPercent',
          observedValue: 95,
          openedAt: row.openedAt,
          ruleId: 'rule-1',
          ruleName: 'High CPU',
          severity: 'critical',
          state: 'OPEN',
        },
      ]);
      expect(findMany).toHaveBeenCalledWith({
        where: { state: { not: 'RESOLVED' } },
        select: {
          acknowledgedAt: true,
          agentId: true,
          dedupeKey: true,
          id: true,
          observedValue: true,
          openedAt: true,
          rule: { select: { metric: true, name: true, severity: true } },
          ruleId: true,
          state: true,
        },
      });
    });

    it('returns an empty list when there are no active instances', async () => {
      const prisma = {
        alertInstance: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaClient;

      await expect(
        new PrismaAlertRepository(prisma).listActive(),
      ).resolves.toEqual([]);
    });
  });
});
