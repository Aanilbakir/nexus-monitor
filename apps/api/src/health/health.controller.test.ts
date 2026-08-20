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
