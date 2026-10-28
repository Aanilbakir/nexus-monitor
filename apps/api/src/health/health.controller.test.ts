import { GUARDS_METADATA } from '@nestjs/common/constants';

import { DashboardApiKeyGuard } from '../dashboard/infrastructure/dashboard-api-key.guard.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports API health using the injected clock', () => {
    const controller = new HealthController(
      () => new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(controller.getHealth()).toEqual({
      service: 'api',
      status: 'operational',
      timestamp: '2026-08-20T12:00:00.000Z',
    });
  });
});

describe('HealthController authorization', () => {
  it('is not protected by the dashboard API key guard', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, HealthController) ??
      []) as unknown[];

    expect(guards).not.toContain(DashboardApiKeyGuard);
  });
});
