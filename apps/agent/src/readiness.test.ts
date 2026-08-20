import { createAgentReadiness } from './readiness.js';

describe('createAgentReadiness', () => {
  it('creates readiness output with an explicit timestamp', () => {
    expect(
      createAgentReadiness('local-dev-agent', '2026-08-20T12:00:00.000Z'),
    ).toEqual({
      agentId: 'local-dev-agent',
      status: 'ready',
      timestamp: '2026-08-20T12:00:00.000Z',
    });
  });
});
