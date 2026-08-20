import { getHostAvailability } from './availability.js';

describe('getHostAvailability', () => {
  const now = new Date('2026-08-21T00:01:00.000Z');

  it('is online at the 45 second boundary', () => {
    expect(getHostAvailability(new Date('2026-08-21T00:00:15.000Z'), now)).toBe(
      'online',
    );
  });

  it('is offline after 45 seconds or without a heartbeat', () => {
    expect(getHostAvailability(new Date('2026-08-21T00:00:14.999Z'), now)).toBe(
      'offline',
    );
    expect(getHostAvailability(null, now)).toBe('offline');
  });
});
