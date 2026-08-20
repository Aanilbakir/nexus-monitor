import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SystemMetricSampleDto } from './system-metric-sample.dto.js';

const validSample = {
  collectedAt: '2026-08-21T10:00:00.000Z',
  cpuPercent: 42.5,
  diskFreeBytes: 400,
  diskTotalBytes: 1_000,
  diskUsedBytes: 500,
  memoryTotalBytes: 1_000,
  memoryUsedBytes: 600,
  networkReceivedBytes: 2_000,
  networkTransmittedBytes: 1_500,
  uptimeSeconds: 3_600,
};

describe('SystemMetricSampleDto', () => {
  it('accepts a valid sample', async () => {
    await expect(
      validate(plainToInstance(SystemMetricSampleDto, validSample)),
    ).resolves.toHaveLength(0);
  });

  it.each([
    ['cpuPercent', Number.POSITIVE_INFINITY],
    ['memoryTotalBytes', -1],
    ['diskUsedBytes', 1.5],
    ['networkReceivedBytes', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects invalid %s', async (field, value) => {
    const errors = await validate(
      plainToInstance(SystemMetricSampleDto, {
        ...validSample,
        [field]: value,
      }),
    );

    expect(errors).not.toHaveLength(0);
  });

  it('rejects inconsistent memory and disk totals', async () => {
    const errors = await validate(
      plainToInstance(SystemMetricSampleDto, {
        ...validSample,
        diskFreeBytes: 600,
        diskUsedBytes: 500,
        memoryTotalBytes: 500,
        memoryUsedBytes: 600,
      }),
    );

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['diskUsedBytes', 'memoryUsedBytes']),
    );
  });
});
