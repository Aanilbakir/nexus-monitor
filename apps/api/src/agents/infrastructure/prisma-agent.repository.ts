import type { PrismaClient } from '@nexus-monitor/database';

import type {
  AgentRepository,
  EnrollAgentInput,
  RecordHeartbeatInput,
} from '../domain/agent.service.js';

export class PrismaAgentRepository implements AgentRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async enroll(input: EnrollAgentInput): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.host.upsert({
        where: { id: input.hostId },
        create: {
          architecture: input.architecture,
          hostname: input.hostname,
          id: input.hostId,
          platform: input.platform,
        },
        update: {
          architecture: input.architecture,
          hostname: input.hostname,
          platform: input.platform,
        },
      });

      await transaction.agent.upsert({
        where: { id: input.agentId },
        create: {
          credentialHash: input.credentialHash,
          enrolledAt: input.enrolledAt,
          hostId: input.hostId,
          id: input.agentId,
          version: input.agentVersion,
        },
        update: {
          credentialHash: input.credentialHash,
          enrolledAt: input.enrolledAt,
          hostId: input.hostId,
          version: input.agentVersion,
        },
      });
    });
  }

  public async findCredentialHash(agentId: string): Promise<string | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { credentialHash: true },
    });

    return agent?.credentialHash ?? null;
  }

  public async recordHeartbeat(input: RecordHeartbeatInput): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const agent = await transaction.agent.update({
        where: { id: input.agentId },
        data: { lastSeenAt: input.receivedAt },
        select: { hostId: true },
      });

      await transaction.host.update({
        where: { id: agent.hostId },
        data: {
          architecture: input.architecture,
          hostname: input.hostname,
          platform: input.platform,
        },
      });

      await transaction.heartbeat.create({
        data: {
          agentId: input.agentId,
          receivedAt: input.receivedAt,
        },
      });

      return agent.hostId;
    });
  }
}
