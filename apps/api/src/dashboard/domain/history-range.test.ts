import { HISTORY_RANGE_POLICIES, getHistoryPolicy } from './history-range.js';

describe('historical metric range policy', () => {
  it('maps every public range to a bounded duration and resolution', () => {
    expect(HISTORY_RANGE_POLICIES).toEqual({
      '1h': {
        bucketSeconds: 60,
        durationMilliseconds: 3_600_000,
        maximumPoints: 61,
      },
      '6h': {
        bucketSeconds: 300,
        durationMilliseconds: 21_600_000,
        maximumPoints: 73,
      },
      '24h': {
        bucketSeconds: 900,
        durationMilliseconds: 86_400_000,
        maximumPoints: 97,
      },
      '7d': {
        bucketSeconds: 7_200,
        durationMilliseconds: 604_800_000,
        maximumPoints: 85,
      },
      '30d': {
        bucketSeconds: 21_600,
        durationMilliseconds: 2_592_000_000,
        maximumPoints: 121,
      },
    });
    expect(getHistoryPolicy('24h')).toBe(HISTORY_RANGE_POLICIES['24h']);
  });
});
