import type { DashboardHistoryPoint } from '@nexus-monitor/contracts';
import { describe, expect, it } from 'vitest';

import { createChartModel, type ChartSeries } from './chart-model';

const points: DashboardHistoryPoint[] = [
  {
    bucketAt: '2026-08-21T09:00:00.000Z',
    cpuPercent: 10,
    diskUsedPercent: 50,
    memoryUsedPercent: 20,
    networkReceivedBytes: '1000',
    networkTransmittedBytes: '500',
  },
  {
    bucketAt: '2026-08-21T09:01:00.000Z',
    cpuPercent: null,
    diskUsedPercent: 51,
    memoryUsedPercent: 30,
    networkReceivedBytes: '2000',
    networkTransmittedBytes: '750',
  },
  {
    bucketAt: '2026-08-21T09:02:00.000Z',
    cpuPercent: 30,
    diskUsedPercent: 52,
    memoryUsedPercent: 40,
    networkReceivedBytes: '3000',
    networkTransmittedBytes: '1000',
  },
];

const cpu: ChartSeries = { key: 'cpuPercent', label: 'CPU' };

describe('createChartModel', () => {
  it('uses a fixed zero-to-100 percent scale and breaks paths at gaps', () => {
    const model = createChartModel(points, [cpu], 'percent', 720, 240);

    expect(model.yMaximum).toBe(100);
    expect(model.paths[0]?.path.match(/M/g)).toHaveLength(2);
    expect(model.samples[0]?.values).toEqual([10]);
    expect(model.samples[1]?.values).toEqual([null]);
  });

  it('uses the largest byte value as a non-zero automatic scale', () => {
    const received: ChartSeries = {
      key: 'networkReceivedBytes',
      label: 'Received',
    };

    expect(
      createChartModel(points, [received], 'bytes', 720, 240).yMaximum,
    ).toBe(3000);
    expect(
      createChartModel(
        [{ ...points[0], networkReceivedBytes: '0' }],
        [received],
        'bytes',
        720,
        240,
      ).yMaximum,
    ).toBe(1);
  });

  it('returns an empty but renderable model without samples', () => {
    expect(createChartModel([], [cpu], 'percent', 720, 240)).toMatchObject({
      paths: [{ key: 'cpuPercent', path: '' }],
      samples: [],
      yMaximum: 100,
    });
  });
});
