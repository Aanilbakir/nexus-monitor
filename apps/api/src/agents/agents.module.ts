import { Module } from '@nestjs/common';
import type { PrismaClient } from '@nexus-monitor/database';

import { readApiEnvironment } from '../config/environment.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { PersistenceModule, PRISMA } from '../shared/persistence.module.js';
import { AgentService, type AgentRepository } from './domain/agent.service.js';
import { CredentialService } from './domain/credential.service.js';
import {
  METRIC_ALERT_HOOK,
  MetricService,
  type MetricAlertHook,
  type MetricRepository,
} from './domain/metric.service.js';
import { PrismaAgentRepository } from './infrastructure/prisma-agent.repository.js';
import { PrismaMetricRepository } from './infrastructure/prisma-metric.repository.js';
import { AgentsController } from './agents.controller.js';
import { DashboardEventPublisher } from '../dashboard/domain/dashboard-event.publisher.js';

export { PRISMA };

const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');
const CREDENTIALS = Symbol('CREDENTIALS');
const METRIC_REPOSITORY = Symbol('METRIC_REPOSITORY');

@Module({
  imports: [PersistenceModule, AlertsModule],
  controllers: [AgentsController],
  exports: [PersistenceModule],
  providers: [
    {
      provide: METRIC_REPOSITORY,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient): MetricRepository =>
        new PrismaMetricRepository(prisma),
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
      inject: [AGENT_REPOSITORY, CREDENTIALS, DashboardEventPublisher],
      useFactory: (
        repository: AgentRepository,
        credentials: CredentialService,
        dashboardEvents: DashboardEventPublisher,
      ): AgentService =>
        new AgentService(repository, credentials, undefined, dashboardEvents),
    },
    {
      provide: MetricService,
      inject: [
        METRIC_REPOSITORY,
        CREDENTIALS,
        DashboardEventPublisher,
        METRIC_ALERT_HOOK,
      ],
      useFactory: (
        repository: MetricRepository,
        credentials: CredentialService,
        dashboardEvents: DashboardEventPublisher,
        alertHook: MetricAlertHook,
      ): MetricService =>
        new MetricService(
          repository,
          credentials,
          undefined,
          dashboardEvents,
          alertHook,
        ),
    },
  ],
})
export class AgentsModule {}
