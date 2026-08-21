import type { DashboardHistoryPoint } from '@nexus-monitor/contracts';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TimeSeriesChart } from './time-series-chart';

afterEach(cleanup);

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
    bucketAt: '2026-08-21T10:00:00.000Z',
    cpuPercent: 30,
    diskUsedPercent: 60,
    memoryUsedPercent: 40,
    networkReceivedBytes: '3000',
    networkTransmittedBytes: '1000',
  },
];

describe('TimeSeriesChart', () => {
  it('renders labelled series, summaries, and an accessible description', () => {
    render(
      <TimeSeriesChart
        description="CPU and memory history"
        formatTime={(value) => value.slice(11, 16)}
        formatValue={(value) => `${value}%`}
        points={points}
        scale="percent"
        series={[
          { key: 'cpuPercent', label: 'CPU' },
          { dashed: true, key: 'memoryUsedPercent', label: 'Memory' },
        ]}
        summaryLabels={{
          latest: 'Latest',
          maximum: 'Maximum',
          minimum: 'Minimum',
        }}
        title="Utilization"
      />,
    );

    expect(screen.getByRole('figure', { name: 'Utilization' })).toHaveAttribute(
      'aria-describedby',
    );
    expect(screen.getByText('CPU and memory history')).toBeVisible();
    const legend = screen.getByLabelText('Utilization series');
    expect(within(legend).getByText('CPU')).toBeVisible();
    expect(within(legend).getByText('Memory')).toBeVisible();
    expect(screen.getByText('10%')).toBeVisible();
    expect(screen.getAllByText('30%').length).toBeGreaterThan(0);
    expect(document.querySelector('[stroke-dasharray]')).not.toBeNull();
  });

  it('moves the active sample with keyboard arrows', () => {
    render(
      <TimeSeriesChart
        description="CPU history"
        formatTime={(value) => value.slice(11, 16)}
        formatValue={(value) => `${value}%`}
        points={points}
        scale="percent"
        series={[{ key: 'cpuPercent', label: 'CPU' }]}
        summaryLabels={{
          latest: 'Latest',
          maximum: 'Maximum',
          minimum: 'Minimum',
        }}
        title="CPU"
      />,
    );

    const chart = screen.getByRole('group', { name: 'CPU data' });
    expect(screen.getByText('10:00')).toBeVisible();
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(screen.getByText('09:00')).toBeVisible();
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(screen.getByText('10:00')).toBeVisible();
  });
});
