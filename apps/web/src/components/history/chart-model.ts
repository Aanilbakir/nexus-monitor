import type { DashboardHistoryPoint } from '@nexus-monitor/contracts';

export type ChartScale = 'bytes' | 'percent';
export type ChartSeriesKey =
  | 'cpuPercent'
  | 'diskUsedPercent'
  | 'memoryUsedPercent'
  | 'networkReceivedBytes'
  | 'networkTransmittedBytes';

export interface ChartSeries {
  readonly dashed?: boolean;
  readonly key: ChartSeriesKey;
  readonly label: string;
}

export interface ChartSample {
  readonly at: string;
  readonly values: readonly (number | null)[];
  readonly x: number;
}

export interface ChartPath {
  readonly dashed: boolean;
  readonly key: ChartSeriesKey;
  readonly label: string;
  readonly path: string;
}

export interface ChartModel {
  readonly paths: readonly ChartPath[];
  readonly samples: readonly ChartSample[];
  readonly yMaximum: number;
}

const PADDING = { bottom: 28, left: 40, right: 16, top: 16 } as const;

export function createChartModel(
  points: readonly DashboardHistoryPoint[],
  series: readonly ChartSeries[],
  scale: ChartScale,
  width: number,
  height: number,
): ChartModel {
  const values = points.map((point) =>
    series.map((definition) => readValue(point, definition.key)),
  );
  const numericValues = values.flatMap((sample) =>
    sample.filter((value): value is number => value !== null),
  );
  const yMaximum = scale === 'percent' ? 100 : Math.max(1, ...numericValues, 0);
  const innerWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const innerHeight = Math.max(0, height - PADDING.top - PADDING.bottom);
  const xFor = (index: number): number =>
    PADDING.left +
    (points.length <= 1
      ? innerWidth / 2
      : (index / (points.length - 1)) * innerWidth);
  const yFor = (value: number): number =>
    PADDING.top +
    innerHeight -
    (clamp(value, 0, yMaximum) / yMaximum) * innerHeight;

  const samples = points.map((point, index) => ({
    at: point.bucketAt,
    values: values[index] ?? [],
    x: xFor(index),
  }));

  const paths = series.map((definition, seriesIndex) => {
    let open = false;
    const commands: string[] = [];
    values.forEach((sample, pointIndex) => {
      const value = sample[seriesIndex];
      if (value === null || value === undefined) {
        open = false;
        return;
      }

      commands.push(
        `${open ? 'L' : 'M'} ${round(xFor(pointIndex))} ${round(yFor(value))}`,
      );
      open = true;
    });

    return {
      dashed: definition.dashed ?? false,
      key: definition.key,
      label: definition.label,
      path: commands.join(' '),
    };
  });

  return { paths, samples, yMaximum };
}

function readValue(
  point: DashboardHistoryPoint,
  key: ChartSeriesKey,
): number | null {
  const value = point[key];
  return typeof value === 'string' ? Number(value) : value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
