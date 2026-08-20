import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nexus-monitor/database';

import { readApiEnvironment } from '../config/environment.js';
import { AgentService, type AgentRepository } from './domain/agent.service.js';
import { CredentialService } from './domain/credential.service.js';
import { PrismaAgentRepository } from './infrastructure/prisma-agent.repository.js';
import { AgentsController } from './agents.controller.js';

const PRISMA = Symbol('PRISMA');
const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');
const CREDENTIALS = Symbol('CREDENTIALS');

@Module({
  controllers: [AgentsController],
  providers: [
    {
      provide: PRISMA,
      useFactory: (): PrismaClient => {
        const environment = readApiEnvironment(process.env);
        return createPrismaClient(environment.databaseUrl);
      },
    },
    {
      provide: AGENT_REPOSITORY,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient): AgentRepository =>
        new PrismaAgentRepository(prisma),
    },
    {
      provide: CREDENTIALS,
      useFactory: (): CredentialService =>
        new CredentialService(
          readApiEnvironment(process.env).agentEnrollmentToken,
        ),
    },
    {
      provide: AgentService,
      inject: [AGENT_REPOSITORY, CREDENTIALS],
      useFactory: (
        repository: AgentRepository,
        credentials: CredentialService,
      ): AgentService => new AgentService(repository, credentials),
    },
  ],
})
export class AgentsModule implements OnApplicationShutdown {
  public constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
