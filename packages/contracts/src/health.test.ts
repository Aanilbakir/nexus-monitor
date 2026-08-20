import { createServiceHealth } from './health.js';

describe('createServiceHealth', () => {
  it('creates an operational health payload with an explicit timestamp', () => {
    expect(createServiceHealth('api', '2026-08-20T12:00:00.000Z')).toEqual({
      service: 'api',
      status: 'operational',
      timestamp: '2026-08-20T12:00:00.000Z',
    });
  });
});
