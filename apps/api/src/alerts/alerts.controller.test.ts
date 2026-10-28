import type { INestApplication } from '@nestjs/common';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { CredentialService } from '../agents/domain/credential.service.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsQueryService } from './domain/alerts-query.service.js';
import type { ActiveAlertSummary } from './domain/alert-repository.js';
import { DashboardApiKeyGuard } from '../dashboard/infrastructure/dashboard-api-key.guard.js';

const alert: ActiveAlertSummary = {
  acknowledgedAt: null,
  agentId: '22222222-2222-4222-8222-222222222222',
  dedupeKey: 'rule-1:agent-1',
  id: '11111111-1111-4111-8111-111111111111',
  metric: 'cpuPercent',
  observedValue: 95,
  openedAt: new Date('2026-08-21T10:00:00.000Z'),
  ruleId: 'rule-1',
  ruleName: 'High CPU',
  severity: 'critical',
  state: 'OPEN',
};

describe('AlertsController', () => {
  describe('list', () => {
    it('returns active alerts mapped to the dashboard contract', async () => {
      const service = {
        listActive: () => Promise.resolve([alert]),
      } as unknown as AlertsQueryService;

      await expect(new AlertsController(service).list()).resolves.toEqual({
        alerts: [
          {
            acknowledgedAt: null,
            agentId: alert.agentId,
            id: alert.id,
            metric: 'cpuPercent',
            observedValue: 95,
            openedAt: '2026-08-21T10:00:00.000Z',
            ruleId: 'rule-1',
            ruleName: 'High CPU',
            severity: 'critical',
            state: 'OPEN',
          },
        ],
      });
    });
  });

  describe('acknowledge', () => {
    it('acknowledges and returns the new state', async () => {
      const at = new Date('2026-08-21T10:05:00.000Z');
      const service = {
        acknowledge: () => Promise.resolve({ at, outcome: 'acknowledged' }),
      } as unknown as AlertsQueryService;

      await expect(
        new AlertsController(service).acknowledge(alert.id),
      ).resolves.toEqual({
        acknowledgedAt: at.toISOString(),
        id: alert.id,
        state: 'ACKNOWLEDGED',
      });
    });

    it('maps an unknown alert to 404', async () => {
      const service = {
        acknowledge: () => Promise.resolve({ outcome: 'not_found' }),
      } as unknown as AlertsQueryService;

      await expect(
        new AlertsController(service).acknowledge('missing'),
      ).rejects.toEqual(new NotFoundException('Alert not found.'));
    });

    it('maps a no-longer-open alert to 409', async () => {
      const service = {
        acknowledge: () => Promise.resolve({ outcome: 'conflict' }),
      } as unknown as AlertsQueryService;

      await expect(
        new AlertsController(service).acknowledge(alert.id),
      ).rejects.toEqual(
        new ConflictException('Alert can no longer be acknowledged.'),
      );
    });
  });
});

describe('AlertsController authorization', () => {
  const dashboardApiKey = 'd'.repeat(32);
  let app: INestApplication;
  let baseUrl: string;
  let listActive: jest.Mock;
  let server: Server;

  beforeEach(async () => {
    listActive = jest.fn().mockResolvedValue([]);
    const service = { listActive } as unknown as AlertsQueryService;

    const moduleRef = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        { provide: AlertsQueryService, useValue: service },
        {
          provide: DashboardApiKeyGuard,
          useFactory: () =>
            new DashboardApiKeyGuard(new CredentialService(dashboardApiKey)),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    server = app.getHttpServer() as Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    server.closeAllConnections?.();
    await app.close();
  });

  it('rejects a request with no authorization header', async () => {
    const response = await fetch(`${baseUrl}/alerts`);

    expect(response.status).toBe(401);
    expect(listActive).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong key', async () => {
    const response = await fetch(`${baseUrl}/alerts`, {
      headers: { authorization: 'Bearer wrong-key-padded-to-32-characters' },
    });

    expect(response.status).toBe(401);
    expect(listActive).not.toHaveBeenCalled();
  });

  it('allows a request with the correct key', async () => {
    const response = await fetch(`${baseUrl}/alerts`, {
      headers: { authorization: `Bearer ${dashboardApiKey}` },
    });

    expect(response.status).toBe(200);
    expect(listActive).toHaveBeenCalledTimes(1);
  });
});
