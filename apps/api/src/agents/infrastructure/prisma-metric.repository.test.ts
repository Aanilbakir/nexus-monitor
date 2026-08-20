import type { PrismaClient } from '@nexus-monitor/database';

import type { InsertMetricInput } from '../domain/metric.service.js';
import { PrismaMetricRepository } from './prisma-metric.repository.js';

const input: InsertMetricInput = {
  agentId: '11111111-1111-4111-8111-111111111111',
  collectedAt: new Date('2026-08-21T09:59:59.000Z'),
  cpuPercent: 25,
  diskFreeBytes: 400n,
  diskTotalBytes: 1_000n,
  diskUsedBytes: 500n,
  memoryTotalBytes: 1_000n,
  memoryUsedBytes: 600n,
  networkReceivedBytes: 2_000n,
  networkTransmittedBytes: 1_500n,
  receivedAt: new Date('2026-08-21T10:00:00.000Z'),
  uptimeSeconds: 3_600n,
};

describe('PrismaMetricRepository', () => {
  it('maps a metric sample to Prisma storage', async () => {
    const create = jest.fn(() => Promise.resolve({ id: 1n }));
    const prisma = {
      agent: { findUnique: jest.fn() },
      systemMetricSample: { create },
    } as unknown as PrismaClient;

    await expect(
      new PrismaMetricRepository(prisma).insert(input),
    ).resolves.toBe('inserted');
    expect(create).toHaveBeenCalledWith({ data: input, select: { id: true } });
  });

  it('converts only unique conflicts to duplicate results', async () => {
    const prisma = {
      agent: { findUnique: jest.fn() },
      systemMetricSample: {
        create: jest.fn(() =>
          Promise.reject(
            Object.assign(new Error('unique conflict'), { code: 'P2002' }),
          ),
        ),
      },
    } as unknown as PrismaClient;

    await expect(
      new PrismaMetricRepository(prisma).insert(input),
    ).resolves.toBe('duplicate');
  });

  it('propagates unrelated database failures', async () => {
    const failure = new Error('database unavailable');
    const prisma = {
      agent: { findUnique: jest.fn() },
      systemMetricSample: {
        create: jest.fn(() => Promise.reject(failure)),
      },
    } as unknown as PrismaClient;

    await expect(new PrismaMetricRepository(prisma).insert(input)).rejects.toBe(
      failure,
    );
  });
});
