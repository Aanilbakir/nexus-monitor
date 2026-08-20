import {
  createMetricIngestResponse,
  validateSystemMetricSample,
  type SystemMetricSample,
} from './system-metrics.js';

const now = new Date('2026-08-21T10:00:00.000Z');
const validSample: SystemMetricSample = {
  collectedAt: '2026-08-21T09:59:59.000Z',
  cpuPercent: 42.25,
  diskFreeBytes: 300,
  diskTotalBytes: 1_000,
  diskUsedBytes: 600,
  memoryTotalBytes: 1_000,
  memoryUsedBytes: 750,
  networkReceivedBytes: 2_000,
  networkTransmittedBytes: 1_500,
  uptimeSeconds: 3_600,
};

describe('validateSystemMetricSample', () => {
  it('accepts a sample at numeric and future-skew boundaries', () => {
    expect(
      validateSystemMetricSample(
        {
          ...validSample,
          collectedAt: '2026-08-21T10:05:00.000Z',
          cpuPercent: 100,
          diskFreeBytes: 400,
          memoryUsedBytes: 1_000,
        },
        now,
      ),
    ).toEqual({ valid: true });
  });

  it.each([
    ['cpuPercent', Number.NaN],
    ['cpuPercent', Number.POSITIVE_INFINITY],
    ['cpuPercent', -0.01],
    ['cpuPercent', 100.01],
    ['memoryTotalBytes', -1],
    ['memoryUsedBytes', 1.5],
    ['diskTotalBytes', Number.MAX_SAFE_INTEGER + 1],
    ['networkReceivedBytes', Number.NEGATIVE_INFINITY],
    ['uptimeSeconds', 0.5],
  ] satisfies ReadonlyArray<readonly [keyof SystemMetricSample, number]>)(
    'rejects unsafe %s value %s',
    (field, value) => {
      expect(
        validateSystemMetricSample({ ...validSample, [field]: value }, now),
      ).toEqual({ valid: false, reason: 'Metric values are invalid.' });
    },
  );

  it('rejects used memory above total memory', () => {
    expect(
      validateSystemMetricSample(
        { ...validSample, memoryTotalBytes: 100, memoryUsedBytes: 101 },
        now,
      ),
    ).toEqual({ valid: false, reason: 'Memory values are inconsistent.' });
  });

  it('rejects disk usage and free space above total capacity', () => {
    expect(
      validateSystemMetricSample(
        {
          ...validSample,
          diskFreeBytes: 401,
          diskTotalBytes: 1_000,
          diskUsedBytes: 600,
        },
        now,
      ),
    ).toEqual({ valid: false, reason: 'Disk values are inconsistent.' });
  });

  it.each(['not-a-date', '2026-08-21T10:00:00+03:00'])(
    'rejects non-UTC collection timestamp %s',
    (collectedAt) => {
      expect(
        validateSystemMetricSample({ ...validSample, collectedAt }, now),
      ).toEqual({ valid: false, reason: 'Collection timestamp is invalid.' });
    },
  );

  it('rejects a timestamp beyond the future-skew allowance', () => {
    expect(
      validateSystemMetricSample(
        { ...validSample, collectedAt: '2026-08-21T10:05:00.001Z' },
        now,
      ),
    ).toEqual({
      valid: false,
      reason: 'Collection timestamp is in the future.',
    });
  });
});

describe('createMetricIngestResponse', () => {
  it('returns accepted collection and receipt timestamps', () => {
    expect(
      createMetricIngestResponse(
        '2026-08-21T09:59:59.000Z',
        '2026-08-21T10:00:00.000Z',
      ),
    ).toEqual({
      collectedAt: '2026-08-21T09:59:59.000Z',
      metricsIntervalSeconds: 15,
      receivedAt: '2026-08-21T10:00:00.000Z',
    });
  });
});
