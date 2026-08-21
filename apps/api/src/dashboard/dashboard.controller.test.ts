import { NotFoundException } from '@nestjs/common';
import type {
  DashboardFleetSnapshot,
  DashboardHost,
} from '@nexus-monitor/contracts';

import { DashboardController } from './dashboard.controller.js';
import type { DashboardQueryService } from './domain/dashboard-query.service.js';

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

    await expect(
      new DashboardController(queries).listHosts(),
    ).resolves.toEqual(snapshot);
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
});

