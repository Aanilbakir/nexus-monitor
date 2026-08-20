import {
  createHeartbeatResponse,
  createRegistrationResponse,
  HEARTBEAT_INTERVAL_SECONDS,
  OFFLINE_THRESHOLD_SECONDS,
} from './agent.js';

describe('agent contracts', () => {
  it('creates a one-time registration credential response', () => {
    expect(
      createRegistrationResponse(
        'agent-secret',
        '2026-08-21T00:00:00.000Z',
      ),
    ).toEqual({
      agentToken: 'agent-secret',
      heartbeatIntervalSeconds: 15,
      registeredAt: '2026-08-21T00:00:00.000Z',
    });
  });

  it('creates heartbeat timing guidance from shared constants', () => {
    expect(createHeartbeatResponse('2026-08-21T00:00:15.000Z')).toEqual({
      heartbeatIntervalSeconds: 15,
      receivedAt: '2026-08-21T00:00:15.000Z',
    });
    expect(HEARTBEAT_INTERVAL_SECONDS).toBe(15);
    expect(OFFLINE_THRESHOLD_SECONDS).toBe(45);
  });
});
