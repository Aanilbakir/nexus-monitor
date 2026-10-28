import type { INestApplication } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  DashboardFleetSnapshot,
  DashboardHistoryResponse,
  DashboardHost,
} from '@nexus-monitor/contracts';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { CredentialService } from '../agents/domain/credential.service.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardQueryService } from './domain/dashboard-query.service.js';
import { DashboardApiKeyGuard } from './infrastructure/dashboard-api-key.guard.js';

const host: DashboardHost = {
  agentId: '22222222-2222-4222-8222-222222222222',
  agentVersion: '0.1.0',
  architecture: 'x64',
  availability: 'online',
  hostname: 'web-prod-01',
  id: '11111111-1111-4111-8111-111111111111',
  lastSeenAt: '2026-08-21T10:00:00.000Z',
  latestMetric: null,
  platform: 'win32',
};

describe('DashboardController', () => {
  it('returns the current fleet snapshot', async () => {
    const snapshot: DashboardFleetSnapshot = {
      generatedAt: '2026-08-21T10:00:01.000Z',
      hosts: [host],
    };
    const queries = {
      listHosts: () => Promise.resolve(snapshot),
    } as unknown as DashboardQueryService;

    await expect(new DashboardController(queries).listHosts()).resolves.toEqual(
      snapshot,
    );
  });

  it('returns one current host', async () => {
    const queries = {
      getHost: () => Promise.resolve(host),
    } as unknown as DashboardQueryService;

    await expect(
      new DashboardController(queries).getHost(host.id),
    ).resolves.toEqual(host);
  });

  it('maps a missing host to a bounded not-found response', async () => {
    const queries = {
      getHost: () => Promise.resolve(null),
    } as unknown as DashboardQueryService;

    await expect(
      new DashboardController(queries).getHost(host.id),
    ).rejects.toEqual(new NotFoundException('Host not found.'));
  });

  it('returns bounded historical metrics for a host', async () => {
    const history: DashboardHistoryResponse = {
      bucketSeconds: 900,
      endAt: '2026-08-21T10:00:00.000Z',
      hostId: host.id,
      points: [],
      range: '24h',
      startAt: '2026-08-20T10:00:00.000Z',
    };
    const queries = {
      getHistory: () => Promise.resolve(history),
    } as unknown as DashboardQueryService;

    await expect(
      new DashboardController(queries).getHistory(host.id, { range: '24h' }),
    ).resolves.toEqual(history);
  });

  it('maps missing host history to the same bounded not-found response', async () => {
    const queries = {
      getHistory: () => Promise.resolve(null),
    } as unknown as DashboardQueryService;

    await expect(
      new DashboardController(queries).getHistory(host.id, { range: '30d' }),
    ).rejects.toEqual(new NotFoundException('Host not found.'));
  });
});

describe('DashboardController authorization', () => {
  const dashboardApiKey = 'd'.repeat(32);
  let app: INestApplication;
  let baseUrl: string;
  let listHosts: jest.Mock;
  let server: Server;

  beforeEach(async () => {
    listHosts = jest.fn().mockResolvedValue({
      generatedAt: '2026-08-21T10:00:01.000Z',
      hosts: [],
    });
    const queries = { listHosts } as unknown as DashboardQueryService;

    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardQueryService, useValue: queries },
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

  it('rejects a fleet snapshot request with no authorization header', async () => {
    const response = await fetch(`${baseUrl}/dashboard/hosts`);

    expect(response.status).toBe(401);
    expect(listHosts).not.toHaveBeenCalled();
  });

  it('rejects a fleet snapshot request with the wrong key', async () => {
    const response = await fetch(`${baseUrl}/dashboard/hosts`, {
      headers: { authorization: 'Bearer wrong-key-padded-to-32-characters' },
    });

    expect(response.status).toBe(401);
    expect(listHosts).not.toHaveBeenCalled();
  });

  it('allows a fleet snapshot request with the correct key', async () => {
    const response = await fetch(`${baseUrl}/dashboard/hosts`, {
      headers: { authorization: `Bearer ${dashboardApiKey}` },
    });

    expect(response.status).toBe(200);
    expect(listHosts).toHaveBeenCalledTimes(1);
  });
});
