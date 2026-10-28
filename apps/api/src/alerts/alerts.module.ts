import { Module } from '@nestjs/common';
import type { PrismaClient } from '@nexus-monitor/database';

import { readApiEnvironment } from '../config/environment.js';
import { CredentialService } from '../agents/domain/credential.service.js';
import { METRIC_ALERT_HOOK } from '../agents/domain/metric.service.js';
import { DashboardEventPublisher } from '../dashboard/domain/dashboard-event.publisher.js';
import { DashboardApiKeyGuard } from '../dashboard/infrastructure/dashboard-api-key.guard.js';
import { PersistenceModule, PRISMA } from '../shared/persistence.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertEvaluatorService } from './domain/alert-evaluator.service.js';
import { AlertIngestionCoordinator } from './domain/alert-ingestion.coordinator.js';
import { AlertsQueryService } from './domain/alerts-query.service.js';
import type {
  AlertRepository,
  QueryableAlertRepository,
} from './domain/alert-repository.js';
import type { AlertRuleRepository } from './domain/alert-rule-repository.js';
import type { AlertSampleRepository } from './domain/alert-sample-repository.js';
import { PrismaAlertRepository } from './infrastructure/prisma-alert.repository.js';
import { PrismaAlertRuleRepository } from './infrastructure/prisma-alert-rule.repository.js';
import { PrismaAlertSampleRepository } from './infrastructure/prisma-alert-sample.repository.js';

const ALERT_REPOSITORY = Symbol('ALERT_REPOSITORY');
const ALERT_RULE_REPOSITORY = Symbol('ALERT_RULE_REPOSITORY');
const ALERT_SAMPLE_REPOSITORY = Symbol('ALERT_SAMPLE_REPOSITORY');

@Module({
  imports: [PersistenceModule],
  controllers: [AlertsController],
  exports: [METRIC_ALERT_HOOK],
  providers: [
    {
      provide: DashboardApiKeyGuard,
      useFactory: (): DashboardApiKeyGuard =>
        new DashboardApiKeyGuard(
          new CredentialService(
            readApiEnvironment(process.env).dashboardApiKey,
          ),
        ),
    },
    {
      provide: ALERT_REPOSITORY,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient): QueryableAlertRepository =>
        new PrismaAlertRepository(prisma),
    },
    {
      provide: ALERT_RULE_REPOSITORY,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient): AlertRuleRepository =>
        new PrismaAlertRuleRepository(prisma),
    },
    {
      provide: ALERT_SAMPLE_REPOSITORY,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient): AlertSampleRepository =>
        new PrismaAlertSampleRepository(prisma),
    },
    {
      provide: AlertEvaluatorService,
      inject: [ALERT_REPOSITORY],
      useFactory: (repository: AlertRepository): AlertEvaluatorService =>
        new AlertEvaluatorService(repository),
    },
    {
      provide: AlertIngestionCoordinator,
      inject: [
        ALERT_RULE_REPOSITORY,
        ALERT_SAMPLE_REPOSITORY,
        AlertEvaluatorService,
        DashboardEventPublisher,
      ],
      useFactory: (
        rules: AlertRuleRepository,
        samples: AlertSampleRepository,
        evaluator: AlertEvaluatorService,
        dashboardEvents: DashboardEventPublisher,
      ): AlertIngestionCoordinator =>
        new AlertIngestionCoordinator(
          rules,
          samples,
          evaluator,
          dashboardEvents,
        ),
    },
    {
      provide: METRIC_ALERT_HOOK,
      useExisting: AlertIngestionCoordinator,
    },
    {
      provide: AlertsQueryService,
      inject: [ALERT_REPOSITORY],
      useFactory: (repository: QueryableAlertRepository): AlertsQueryService =>
        new AlertsQueryService(repository),
    },
  ],
})
export class AlertsModule {}
