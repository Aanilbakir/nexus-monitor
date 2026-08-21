import type { DashboardHost } from '@nexus-monitor/contracts';
import type { Language } from '../i18n/language';
import type { Messages } from '../i18n/messages';
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatTimestamp,
} from './format';
import { MetricReading } from './metric-reading';

export function HostDetail({
  copy,
  host,
  language,
}: {
  readonly copy: Messages;
  readonly host: DashboardHost;
  readonly language: Language;
}) {
  const metric = host.latestMetric;
  return (
    <article className="host-detail">
      <header className="host-header">
        <div>
          <span className="eyebrow">HOST / {host.id.slice(0, 8)}</span>
          <h1>{host.hostname}</h1>
        </div>
        <div className={`availability availability-${host.availability}`}>
          <span
            className={`status-mark status-${host.availability}`}
            aria-hidden="true"
          />
          {host.availability === 'online' ? copy.online : copy.offline}
        </div>
      </header>
      <section className="system-strip" aria-labelledby="system-title">
        <h2 id="system-title">{copy.system}</h2>
        <dl>
          <div>
            <dt>OS</dt>
            <dd>{host.platform}</dd>
          </div>
          <div>
            <dt>ARCH</dt>
            <dd>{host.architecture}</dd>
          </div>
          <div>
            <dt>AGENT</dt>
            <dd>v{host.agentVersion}</dd>
          </div>
          <div>
            <dt>{copy.lastHeartbeat}</dt>
            <dd>
              {formatTimestamp(host.lastSeenAt, language, copy.unavailable)}
            </dd>
          </div>
        </dl>
      </section>
      <section className="telemetry" aria-labelledby="telemetry-title">
        <div className="section-heading">
          <h2 id="telemetry-title">{copy.metrics}</h2>
          {metric ? (
            <time dateTime={metric.collectedAt}>
              {formatTimestamp(metric.collectedAt, language, copy.unavailable)}
            </time>
          ) : null}
        </div>
        {metric ? (
          <dl className="metrics-grid">
            <MetricReading
              label={copy.cpu}
              value={formatPercent(metric.cpuPercent)}
            />
            <MetricReading
              label={copy.memory}
              value={formatPercent(
                ratio(metric.memoryUsedBytes, metric.memoryTotalBytes),
              )}
              secondary={`${formatBytes(metric.memoryUsedBytes, language)} / ${formatBytes(metric.memoryTotalBytes, language)}`}
            />
            <MetricReading
              label={copy.disk}
              value={formatPercent(
                ratio(metric.diskUsedBytes, metric.diskTotalBytes),
              )}
              secondary={`${formatBytes(metric.diskUsedBytes, language)} / ${formatBytes(metric.diskTotalBytes, language)}`}
            />
            <MetricReading
              label={copy.uptime}
              value={formatDuration(metric.uptimeSeconds, copy)}
            />
            <MetricReading
              label={copy.networkReceived}
              value={formatBytes(metric.networkReceivedBytes, language)}
            />
            <MetricReading
              label={copy.networkTransmitted}
              value={formatBytes(metric.networkTransmittedBytes, language)}
            />
          </dl>
        ) : (
          <p className="waiting-metrics">{copy.waitingMetrics}</p>
        )}
      </section>
    </article>
  );
}

function ratio(used: string, total: string): number {
  const totalValue = Number(total);
  return totalValue > 0 ? (Number(used) / totalValue) * 100 : 0;
}
