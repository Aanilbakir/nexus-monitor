import type { DashboardAlertInstance } from '@nexus-monitor/contracts';

import type { Messages } from '../i18n/messages';

export interface AlertsPanelProps {
  readonly alerts: readonly DashboardAlertInstance[];
  readonly copy: Messages;
  readonly onAcknowledge: (id: string) => void;
}

export function AlertsPanel({ alerts, copy, onAcknowledge }: AlertsPanelProps) {
  return (
    <section aria-labelledby="alerts-panel-title" className="alerts-panel">
      <h2 id="alerts-panel-title">{copy.activeAlerts}</h2>
      {alerts.length === 0 ? (
        <p>{copy.noActiveAlerts}</p>
      ) : (
        <ul>
          {alerts.map((alert) => (
            <li key={alert.id}>
              <span>{alert.ruleName}</span>
              {alert.state === 'OPEN' ? (
                <button
                  className="action-button"
                  onClick={() => onAcknowledge(alert.id)}
                  type="button"
                >
                  {copy.acknowledgeAlert}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
