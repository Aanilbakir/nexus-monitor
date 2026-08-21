import type { HistoryRange } from '@nexus-monitor/contracts';

export interface HistoryRangePolicy {
  readonly bucketSeconds: number;
  readonly durationMilliseconds: number;
  readonly maximumPoints: number;
}

export const HISTORY_RANGE_POLICIES = {
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
} as const satisfies Record<HistoryRange, HistoryRangePolicy>;

export function getHistoryPolicy(range: HistoryRange): HistoryRangePolicy {
  return HISTORY_RANGE_POLICIES[range];
}
