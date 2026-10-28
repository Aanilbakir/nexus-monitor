import { Test } from '@nestjs/testing';

import { PRISMA } from '../agents/agents.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsModule } from './alerts.module.js';
import { AlertEvaluatorService } from './domain/alert-evaluator.service.js';
import { AlertsQueryService } from './domain/alerts-query.service.js';
import { AlertIngestionCoordinator } from './domain/alert-ingestion.coordinator.js';

const DASHBOARD_API_KEY = 'd'.repeat(32);

describe('AlertsModule', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AGENT_ENROLLMENT_TOKEN = 'a-secure-enrollment-token';
    process.env.DASHBOARD_API_KEY = DASHBOARD_API_KEY;
    process.env.DATABASE_URL =
      'postgresql://nexus:local@127.0.0.1:5432/nexus_monitor';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves its controller and services using a fake Prisma client', async () => {
    const fakePrisma = {
      $disconnect: jest.fn(),
      alertInstance: { findMany: jest.fn(), findUnique: jest.fn() },
      alertRule: { findMany: jest.fn().mockResolvedValue([]) },
      systemMetricSample: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AlertsModule],
    })
      .overrideProvider(PRISMA)
      .useValue(fakePrisma)
      .compile();

    expect(moduleRef.get(AlertsController)).toBeInstanceOf(AlertsController);
    expect(moduleRef.get(AlertsQueryService)).toBeInstanceOf(
      AlertsQueryService,
    );
    expect(moduleRef.get(AlertEvaluatorService)).toBeInstanceOf(
      AlertEvaluatorService,
    );
    expect(moduleRef.get(AlertIngestionCoordinator)).toBeInstanceOf(
      AlertIngestionCoordinator,
    );

    await moduleRef.close();
  });
});
