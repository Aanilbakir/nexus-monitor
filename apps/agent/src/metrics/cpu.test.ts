import { calculateCpuPercent } from './cpu.js';

describe('calculateCpuPercent', () => {
  it('calculates utilization from aggregate time deltas', () => {
    expect(
      calculateCpuPercent(
        { idle: 400, total: 1_000 },
        { idle: 450, total: 1_200 },
      ),
    ).toBe(75);
  });

  it('rounds utilization to two decimal places', () => {
    expect(
      calculateCpuPercent({ idle: 100, total: 200 }, { idle: 101, total: 203 }),
    ).toBe(66.67);
  });

  it('returns null without a positive total delta', () => {
    expect(
      calculateCpuPercent({ idle: 100, total: 200 }, { idle: 100, total: 200 }),
    ).toBeNull();
  });
});
