import { readAgentEnvironment } from './environment.js';

describe('readAgentEnvironment', () => {
  it('accepts an HTTP API URL and explicit agent identity', () => {
    expect(
      readAgentEnvironment({
        AGENT_ID: 'local-dev-agent',
        NEXUS_API_URL: 'http://127.0.0.1:3000',
      }),
    ).toEqual({
      agentId: 'local-dev-agent',
      apiUrl: 'http://127.0.0.1:3000/',
    });
  });

  it('rejects a missing agent identity', () => {
    expect(() =>
      readAgentEnvironment({ NEXUS_API_URL: 'http://127.0.0.1:3000' }),
    ).toThrow('Invalid AGENT_ID: expected a non-empty value.');
  });

  it.each(['not-a-url', 'file:///tmp/nexus'])('rejects API URL %s', (url) => {
    expect(() =>
      readAgentEnvironment({ AGENT_ID: 'agent-1', NEXUS_API_URL: url }),
    ).toThrow('Invalid NEXUS_API_URL: expected an HTTP or HTTPS URL.');
  });
});
