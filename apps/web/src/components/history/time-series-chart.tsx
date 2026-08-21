import type { DashboardHistoryPoint } from '@nexus-monitor/contracts';
import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import {
  createChartModel,
  type ChartScale,
  type ChartSeries,
} from './chart-model';

const WIDTH = 720;
const HEIGHT = 240;

export function TimeSeriesChart({
  description,
  formatTime,
  formatValue,
  points,
  scale,
  series,
  summaryLabels,
  title,
}: {
  readonly description: string;
  readonly formatTime: (value: string) => string;
  readonly formatValue: (value: number) => string;
  readonly points: readonly DashboardHistoryPoint[];
  readonly scale: ChartScale;
  readonly series: readonly ChartSeries[];
  readonly summaryLabels: {
    readonly latest: string;
    readonly maximum: string;
    readonly minimum: string;
  };
  readonly title: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const model = useMemo(
    () => createChartModel(points, series, scale, WIDTH, HEIGHT),
    [points, scale, series],
  );
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, points.length - 1),
  );
  const boundedActiveIndex = Math.min(
    activeIndex,
    Math.max(0, points.length - 1),
  );
  const active = model.samples[boundedActiveIndex];

  const moveActive = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    setActiveIndex((index) =>
      Math.max(0, Math.min(points.length - 1, index + direction)),
    );
  };

  const pointActive = (event: PointerEvent<HTMLDivElement>): void => {
    if (points.length === 0) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio =
      bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
    setActiveIndex(
      Math.max(
        0,
        Math.min(points.length - 1, Math.round(ratio * (points.length - 1))),
      ),
    );
  };

  return (
    <figure
      className="history-chart"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <header className="chart-heading">
        <div>
          <h3 id={titleId}>{title}</h3>
          <p id={descriptionId}>{description}</p>
        </div>
        <div className="chart-legend" aria-label={`${title} series`}>
          {series.map((definition, index) => (
            <span key={definition.key} className={`series-${index + 1}`}>
              <span aria-hidden="true" />
              {definition.label}
            </span>
          ))}
        </div>
      </header>

      <div
        aria-label={`${title} data`}
        className="chart-viewport"
        onKeyDown={moveActive}
        onPointerMove={pointActive}
        role="group"
        tabIndex={0}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-hidden="true">
          <line className="chart-grid" x1="40" x2="704" y1="16" y2="16" />
          <line className="chart-grid" x1="40" x2="704" y1="212" y2="212" />
          {model.paths.map((path, index) => (
            <path
              className={`chart-line series-${index + 1}`}
              d={path.path}
              fill="none"
              key={path.key}
              strokeDasharray={path.dashed ? '7 5' : undefined}
            />
          ))}
          {active ? (
            <line
              className="chart-cursor"
              x1={active.x}
              x2={active.x}
              y1="16"
              y2="212"
            />
          ) : null}
        </svg>
      </div>

      {active ? (
        <div className="chart-active" aria-live="polite">
          <time dateTime={active.at}>{formatTime(active.at)}</time>
          {series.map((definition, index) => (
            <span key={definition.key}>
              {definition.label}:{' '}
              {active.values[index] === null ||
              active.values[index] === undefined
                ? 'N/A'
                : formatValue(active.values[index])}
            </span>
          ))}
        </div>
      ) : null}

      <div className="chart-summaries">
        {series.map((definition, index) => {
          const values = model.samples
            .map((sample) => sample.values[index])
            .filter(
              (value): value is number => value !== null && value !== undefined,
            );
          const latest = values.at(-1);
          return (
            <dl key={definition.key}>
              <dt>{definition.label}</dt>
              <dd>
                <span>{summaryLabels.latest}</span>
                {latest === undefined ? 'N/A' : formatValue(latest)}
              </dd>
              <dd>
                <span>{summaryLabels.minimum}</span>
                {values.length === 0 ? 'N/A' : formatValue(Math.min(...values))}
              </dd>
              <dd>
                <span>{summaryLabels.maximum}</span>
                {values.length === 0 ? 'N/A' : formatValue(Math.max(...values))}
              </dd>
            </dl>
          );
        })}
      </div>
    </figure>
  );
}
