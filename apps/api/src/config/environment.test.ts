import { readApiEnvironment } from './environment.js';

describe('readApiEnvironment', () => {
  it('uses safe local defaults', () => {
    expect(readApiEnvironment({})).toEqual({
      host: '127.0.0.1',
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('accepts an explicit valid port', () => {
    expect(readApiEnvironment({ API_PORT: '4100' }).port).toBe(4100);
  });

  it.each(['abc', '0', '65536'])('rejects invalid API_PORT %s', (port) => {
    expect(() => readApiEnvironment({ API_PORT: port })).toThrow(
      'Invalid API_PORT: expected an integer between 1 and 65535.',
    );
  });
});
