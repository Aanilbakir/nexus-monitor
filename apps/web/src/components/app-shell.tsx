import type {
  DashboardAlertInstance,
  DashboardHost,
} from '@nexus-monitor/contracts';
import type { ReactNode } from 'react';
import type { ConnectionState } from '../dashboard/use-dashboard';
import type { Language } from '../i18n/language';
import type { Messages } from '../i18n/messages';
import { AlertsPanel } from './alerts-panel';
import { FleetSidebar } from './fleet-sidebar';

export function AppShell({
  alertAcknowledgeError,
  alerts,
  children,
  connection,
  copy,
  hosts,
  language,
  onAcknowledgeAlert,
  onLanguageChange,
  onSelectHost,
  selectedHostId,
}: {
  readonly alertAcknowledgeError: boolean;
  readonly alerts: readonly DashboardAlertInstance[];
  readonly children: ReactNode;
  readonly connection: ConnectionState;
  readonly copy: Messages;
  readonly hosts: readonly DashboardHost[];
  readonly language: Language;
  readonly onAcknowledgeAlert: (id: string) => void;
  readonly onLanguageChange: (language: Language) => void;
  readonly onSelectHost: (hostId: string) => void;
  readonly selectedHostId: string | null;
}) {
  const connectionText = connection === 'live' ? copy.live : copy.reconnecting;
  return (
    <main className="console-shell">
      <header className="console-topbar">
        <a className="wordmark" href="/" aria-label="NEXUS Monitor home">
          <span aria-hidden="true">NX</span>
          <strong>NEXUS Monitor</strong>
        </a>
        <div className="topbar-tools">
          <div
            className={`connection-state connection-${connection}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-mark" aria-hidden="true" />
            {connectionText}
          </div>
          <div className="language-switch" aria-label="Language">
            <button
              aria-pressed={language === 'en'}
              aria-label="English"
              onClick={() => onLanguageChange('en')}
              type="button"
            >
              EN
            </button>
            <button
              aria-pressed={language === 'tr'}
              aria-label="Türkçe"
              onClick={() => onLanguageChange('tr')}
              type="button"
            >
              TR
            </button>
          </div>
        </div>
      </header>
      <div className="console-grid">
        <FleetSidebar
          copy={copy}
          hosts={hosts}
          onSelect={onSelectHost}
          selectedHostId={selectedHostId}
        />
        <section className="console-content">
          <AlertsPanel
            acknowledgeError={alertAcknowledgeError}
            alerts={alerts}
            copy={copy}
            hosts={hosts}
            onAcknowledge={onAcknowledgeAlert}
          />
          {children}
        </section>
      </div>
    </main>
  );
}
