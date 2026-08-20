import { readAgentEnvironment } from './environment.js';

describe('readAgentEnvironment', () => {
  it('reads enrollment settings', () => {
    expect(
      readAgentEnvironment({
        AGENT_ENROLLMENT_TOKEN: 'enrollment-secret',
        AGENT_VERSION: '1.2.3',
        NEXUS_AGENT_STATE_PATH: './data/agent.json',
        NEXUS_API_URL: 'http://127.0.0.1:3000',
      }),
    ).toEqual({
      agentVersion: '1.2.3',
      apiUrl: 'http://127.0.0.1:3000/',
      enrollmentToken: 'enrollment-secret',
      statePath: './data/agent.json',
    });
  });

  it('rejects a missing enrollment token', () => {
    expect(() =>
      readAgentEnvironment({
        NEXUS_AGENT_STATE_PATH: './data/agent.json',
        NEXUS_API_URL: 'http://127.0.0.1:3000',
      }),
    ).toThrow('Invalid AGENT_ENROLLMENT_TOKEN: expected a non-empty value.');
  });

  it.each(['not-a-url', 'file:///tmp/nexus'])('rejects API URL %s', (url) => {
    expect(() =>
      readAgentEnvironment({
        AGENT_ENROLLMENT_TOKEN: 'secret',
        NEXUS_AGENT_STATE_PATH: './data/agent.json',
        NEXUS_API_URL: url,
      }),
    ).toThrow('Invalid NEXUS_API_URL: expected an HTTP or HTTPS URL.');
  });
});
