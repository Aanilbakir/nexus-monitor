import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { PrismaClient } from '@nexus-monitor/database';

import { readApiEnvironment } from '../config/environment.js';
import { DashboardEventPublisher } from '../dashboard/domain/dashboard-event.publisher.js';

export const PRISMA = Symbol('PRISMA');

/**
 * Providers shared between `AgentsModule` and `AlertsModule` (the Prisma
 * client and the dashboard event bus). Extracted here so both modules can
 * import it directly instead of one importing the other for these,
 * which is what left `AgentsModule` and `AlertsModule` free to form a
 * one-directional dependency (`AgentsModule` -> `AlertsModule`, for the
 * metric alert hook) without a `forwardRef`.
 *
 * The `@nexus-monitor/database` import is dynamic (rather than a static
 * top-level import) so this file never pulls in its ESM build unless the
 * factory actually runs. Tests override the `PRISMA` provider wholesale, so
 * the factory — and this import — never executes there; `ts-jest` would
 * otherwise fail to parse the package's compiled ESM output.
 */
@Module({
  exports: [DashboardEventPublisher, PRISMA],
  providers: [
    DashboardEventPublisher,
    {
      provide: PRISMA,
      useFactory: async (): Promise<PrismaClient> => {
        const { createPrismaClient } = await import('@nexus-monitor/database');
        const environment = readApiEnvironment(process.env);
        return createPrismaClient(environment.databaseUrl);
      },
    },
  ],
})
export class PersistenceModule implements OnApplicationShutdown {
  public constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
