import type {
  DashboardAlertInstance,
  DashboardHost,
} from '@nexus-monitor/contracts';

import type { Messages } from '../i18n/messages';

export interface AlertsPanelProps {
  readonly acknowledgeError: boolean;
  readonly alerts: readonly DashboardAlertInstance[];
  readonly copy: Messages;
  readonly hosts: readonly DashboardHost[];
  readonly onAcknowledge: (id: string) => void;
}

export function AlertsPanel({
  acknowledgeError,
  alerts,
  copy,
  hosts,
  onAcknowledge,
}: AlertsPanelProps) {
  return (
    <section aria-labelledby="alerts-panel-title" className="alerts-panel">
      <h2 id="alerts-panel-title">{copy.activeAlerts}</h2>
      {acknowledgeError ? (
        <p className="alerts-panel-error" role="alert">
          {copy.acknowledgeFailed}
        </p>
      ) : null}
      <div aria-live="polite" className="alerts-panel-live">
        {alerts.length === 0 ? (
          <p>{copy.noActiveAlerts}</p>
        ) : (
          <ul>
            {alerts.map((alert) => {
              const hostname =
                hosts.find((host) => host.agentId === alert.agentId)
                  ?.hostname ?? alert.agentId;
              return (
                <li key={alert.id}>
                  <span className="alert-rule-name">{alert.ruleName}</span>
                  <span className="alert-severity">{alert.severity}</span>
                  <span className="alert-host">{hostname}</span>
                  {alert.state === 'OPEN' ? (
                    <button
                      aria-label={copy.acknowledgeAlertLabel(
                        alert.ruleName,
                        hostname,
                      )}
                      className="action-button"
                      onClick={() => onAcknowledge(alert.id)}
                      type="button"
                    >
                      {copy.acknowledgeAlert}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
