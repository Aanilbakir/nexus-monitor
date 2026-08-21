import { HISTORY_RANGES, type HistoryRange } from '@nexus-monitor/contracts';

import { useHistory } from '../../dashboard/use-history';
import type { Language } from '../../i18n/language';
import type { Messages } from '../../i18n/messages';
import { formatBytes, formatPercent, formatTimestamp } from '../format';
import type { ChartSeries } from './chart-model';
import { TimeSeriesChart } from './time-series-chart';

const RANGE_LABELS: Record<HistoryRange, keyof Messages> = {
  '1h': 'range1h',
  '6h': 'range6h',
  '24h': 'range24h',
  '7d': 'range7d',
  '30d': 'range30d',
};

export function HistoryPanel({
  copy,
  hostId,
  language,
}: {
  readonly copy: Messages;
  readonly hostId: string;
  readonly language: Language;
}) {
  const history = useHistory(hostId);
  const summaryLabels = {
    latest: copy.latest,
    maximum: copy.maximum,
    minimum: copy.minimum,
  };
  const utilizationSeries: readonly ChartSeries[] = [
    { key: 'cpuPercent', label: copy.cpu },
    { dashed: true, key: 'memoryUsedPercent', label: copy.memory },
  ];
  const diskSeries: readonly ChartSeries[] = [
    { key: 'diskUsedPercent', label: copy.disk },
  ];
  const networkSeries: readonly ChartSeries[] = [
    { key: 'networkReceivedBytes', label: copy.networkReceived },
    {
      dashed: true,
      key: 'networkTransmittedBytes',
      label: copy.networkTransmitted,
    },
  ];

  return (
    <section className="history-section" aria-labelledby="history-title">
      <div className="history-toolbar">
        <div>
          <h2 id="history-title">{copy.history}</h2>
          <p>{copy.historyDescription}</p>
        </div>
        <div
          className="range-selector"
          aria-label={copy.historyRange}
          role="group"
        >
          {HISTORY_RANGES.map((range) => (
            <button
              aria-pressed={history.range === range}
              key={range}
              onClick={() => history.setRange(range)}
              type="button"
            >
              {copy[RANGE_LABELS[range]]}
            </button>
          ))}
        </div>
      </div>

      {history.loadState === 'loading' ? (
        <div className="history-state" role="status">
          <span className="status-mark status-online" aria-hidden="true" />
          {copy.historyLoading}
        </div>
      ) : history.loadState === 'error' ? (
        <div className="history-state history-error">
          <div>
            <h3>{copy.historyError}</h3>
            <p>{copy.historyErrorDescription}</p>
          </div>
          <button
            className="action-button"
            onClick={history.retry}
            type="button"
          >
            {copy.historyRetry}
          </button>
        </div>
      ) : history.data?.points.length === 0 ? (
        <div className="history-state">
          <div>
            <h3>{copy.historyEmpty}</h3>
            <p>{copy.historyEmptyDescription}</p>
          </div>
        </div>
      ) : history.data ? (
        <div className="history-charts">
          <TimeSeriesChart
            description={copy.utilizationHistoryDescription}
            formatTime={(value) =>
              formatTimestamp(value, language, copy.unavailable)
            }
            formatValue={formatPercent}
            points={history.data.points}
            scale="percent"
            series={utilizationSeries}
            summaryLabels={summaryLabels}
            title={copy.utilizationHistory}
          />
          <TimeSeriesChart
            description={copy.diskHistoryDescription}
            formatTime={(value) =>
              formatTimestamp(value, language, copy.unavailable)
            }
            formatValue={formatPercent}
            points={history.data.points}
            scale="percent"
            series={diskSeries}
            summaryLabels={summaryLabels}
            title={copy.diskHistory}
          />
          <TimeSeriesChart
            description={copy.networkHistoryDescription}
            formatTime={(value) =>
              formatTimestamp(value, language, copy.unavailable)
            }
            formatValue={(value) =>
              formatBytes(String(Math.round(value)), language)
            }
            points={history.data.points}
            scale="bytes"
            series={networkSeries}
            summaryLabels={summaryLabels}
            title={copy.networkHistory}
          />
        </div>
      ) : null}
    </section>
  );
}
