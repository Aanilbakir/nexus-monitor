import type { PrismaClient } from '@nexus-monitor/database';

import type {
  InsertMetricInput,
  MetricRepository,
} from '../domain/metric.service.js';

export class PrismaMetricRepository implements MetricRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findCredentialHash(agentId: string): Promise<string | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { credentialHash: true },
    });
    return agent?.credentialHash ?? null;
  }

  public async insert(
    input: InsertMetricInput,
  ): Promise<'duplicate' | 'inserted'> {
    try {
      await this.prisma.systemMetricSample.create({
        data: input,
        select: { id: true },
      });
      return 'inserted';
    } catch (error) {
      if (isPrismaUniqueConflict(error)) return 'duplicate';
      throw error;
    }
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
