import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { DashboardEvent } from '@nexus-monitor/contracts';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { CredentialService } from '../agents/domain/credential.service.js';
import { DashboardEventsController } from './dashboard-events.controller.js';
import { DashboardEventPublisher } from './domain/dashboard-event.publisher.js';
import { DashboardApiKeyGuard } from './infrastructure/dashboard-api-key.guard.js';

const event: DashboardEvent = {
  hostId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-08-21T10:00:00.000Z',
  payload: { availability: 'online', lastSeenAt: '2026-08-21T10:00:00.000Z' },
  type: 'host.status',
  version: 1,
};

describe('DashboardEventsController', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('emits ready, domain, and keepalive events and cleans up on disconnect', () => {
    const publisher = new DashboardEventPublisher();
    const controller = new DashboardEventsController(
      publisher,
      () => new Date('2026-08-21T10:00:00.000Z'),
    );
    const received: unknown[] = [];
    const subscription = controller.events().subscribe((message) => {
      received.push(message);
    });

    publisher.publish(event);
    jest.advanceTimersByTime(20_000);
    subscription.unsubscribe();
    publisher.publish({ ...event, occurredAt: '2026-08-21T10:00:21.000Z' });
    jest.advanceTimersByTime(20_000);

    expect(received).toEqual([
      {
        type: 'ready',
        data: { connectedAt: '2026-08-21T10:00:00.000Z' },
      },
      { type: 'host.status', data: event },
      { type: 'keepalive', data: '' },
    ]);
  });
});

describe('DashboardEventsController authorization', () => {
  const dashboardApiKey = 'd'.repeat(32);
  let app: INestApplication;
  let baseUrl: string;
  let server: Server;

  beforeEach(async () => {
    const publisher = new DashboardEventPublisher();
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardEventsController],
      providers: [
        { provide: DashboardEventPublisher, useValue: publisher },
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

  it('rejects an event stream request with no authorization header', async () => {
    const response = await fetch(`${baseUrl}/dashboard/events`);

    expect(response.status).toBe(401);
  });

  it('rejects an event stream request with the wrong key', async () => {
    const response = await fetch(`${baseUrl}/dashboard/events`, {
      headers: { authorization: 'Bearer wrong-key-padded-to-32-characters' },
    });

    expect(response.status).toBe(401);
  });

  it('allows an event stream request with the correct key', async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/dashboard/events`, {
      headers: { authorization: `Bearer ${dashboardApiKey}` },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    controller.abort();
    await response.body?.cancel().catch(() => undefined);
  });
});
