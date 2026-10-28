import { readApiEnvironment } from './environment.js';

describe('readApiEnvironment', () => {
  const required = {
    AGENT_ENROLLMENT_TOKEN: 'a-secure-enrollment-token',
    DASHBOARD_API_KEY: 'd'.repeat(32),
    DATABASE_URL: 'postgresql://nexus:local@127.0.0.1:5432/nexus_monitor',
  };

  it('uses safe local defaults', () => {
    expect(readApiEnvironment(required)).toEqual({
      agentEnrollmentToken: 'a-secure-enrollment-token',
      dashboardApiKey: 'd'.repeat(32),
      databaseUrl: 'postgresql://nexus:local@127.0.0.1:5432/nexus_monitor',
      host: '127.0.0.1',
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('accepts an explicit valid port', () => {
    expect(readApiEnvironment({ ...required, API_PORT: '4100' }).port).toBe(
      4100,
    );
  });

  it.each(['abc', '0', '65536'])('rejects invalid API_PORT %s', (port) => {
    expect(() => readApiEnvironment({ ...required, API_PORT: port })).toThrow(
      'Invalid API_PORT: expected an integer between 1 and 65535.',
    );
  });

  it.each(['AGENT_ENROLLMENT_TOKEN', 'DASHBOARD_API_KEY', 'DATABASE_URL'])(
    'rejects missing %s',
    (key) => {
      expect(() =>
        readApiEnvironment({ ...required, [key]: undefined }),
      ).toThrow(`Invalid ${key}: expected a non-empty value.`);
    },
  );

  it.each(['abc', 'd'.repeat(31)])(
    'rejects a DASHBOARD_API_KEY shorter than 32 characters',
    (shortKey) => {
      expect(() =>
        readApiEnvironment({ ...required, DASHBOARD_API_KEY: shortKey }),
      ).toThrow('Invalid DASHBOARD_API_KEY: expected at least 32 characters.');
    },
  );
});
