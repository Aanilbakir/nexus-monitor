import { Module } from '@nestjs/common';
import type { PrismaClient } from '@nexus-monitor/database';

import { AgentsModule, PRISMA } from '../agents/agents.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardEventsController } from './dashboard-events.controller.js';
import { AvailabilityMonitor } from './domain/availability-monitor.js';
import { DashboardEventPublisher } from './domain/dashboard-event.publisher.js';
import {
  DashboardQueryService,
  type DashboardRepository,
} from './domain/dashboard-query.service.js';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository.js';

const DASHBOARD_REPOSITORY = Symbol('DASHBOARD_REPOSITORY');

@Module({
  imports: [AgentsModule],
  controllers: [DashboardController, DashboardEventsController],
  providers: [
    {
      provide: DASHBOARD_REPOSITORY,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient): DashboardRepository =>
        new PrismaDashboardRepository(prisma),
    },
    {
      provide: DashboardQueryService,
      inject: [DASHBOARD_REPOSITORY],
      useFactory: (repository: DashboardRepository): DashboardQueryService =>
        new DashboardQueryService(repository),
    },
    {
      provide: AvailabilityMonitor,
      inject: [DashboardQueryService, DashboardEventPublisher],
      useFactory: (
        queries: DashboardQueryService,
        events: DashboardEventPublisher,
      ): AvailabilityMonitor => new AvailabilityMonitor(queries, events),
    },
  ],
})
export class DashboardModule {}
