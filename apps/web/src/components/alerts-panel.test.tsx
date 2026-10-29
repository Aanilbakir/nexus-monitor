import type {
  DashboardAlertInstance,
  DashboardHost,
} from '@nexus-monitor/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { messages } from '../i18n/messages';
import { AlertsPanel } from './alerts-panel';

afterEach(() => {
  cleanup();
});

const host: DashboardHost = {
  agentId: '22222222-2222-4222-8222-222222222222',
  agentVersion: '0.1.0',
  architecture: 'x64',
  availability: 'online',
  hostname: 'web-prod-01',
  id: '11111111-1111-4111-8111-111111111111',
  lastSeenAt: '2026-08-21T10:00:00.000Z',
  latestMetric: null,
  platform: 'win32',
};

const openAlert: DashboardAlertInstance = {
  acknowledgedAt: null,
  agentId: host.agentId,
  id: 'alert-1',
  metric: 'cpuPercent',
  observedValue: 95,
  openedAt: '2026-08-21T10:00:00.000Z',
  ruleId: 'rule-1',
  ruleName: 'High CPU',
  severity: 'critical',
  state: 'OPEN',
};

const acknowledgedAlert: DashboardAlertInstance = {
  ...openAlert,
  acknowledgedAt: '2026-08-21T10:05:00.000Z',
  id: 'alert-2',
  state: 'ACKNOWLEDGED',
};

describe('AlertsPanel', () => {
  it('renders the active alerts heading and an empty state with no alerts', () => {
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[]}
        copy={messages.en}
        hosts={[]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: messages.en.activeAlerts }),
    ).toBeTruthy();
    expect(screen.getByText(messages.en.noActiveAlerts)).toBeTruthy();
  });

  it('lists an open alert with its severity, resolved host name, and an acknowledge button that calls back with its id', () => {
    const onAcknowledge = vi.fn();
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[openAlert]}
        copy={messages.en}
        hosts={[host]}
        onAcknowledge={onAcknowledge}
      />,
    );

    expect(screen.getByText(openAlert.ruleName)).toBeTruthy();
    expect(screen.getByText(openAlert.severity)).toBeTruthy();
    expect(screen.getByText(host.hostname)).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: messages.en.acknowledgeAlertLabel(
          openAlert.ruleName,
          host.hostname,
        ),
      }),
    );

    expect(onAcknowledge).toHaveBeenCalledWith(openAlert.id);
  });

  it('gives each acknowledge button a distinct accessible name including the rule and host', () => {
    const otherHost: DashboardHost = {
      ...host,
      agentId: '33333333-3333-4333-8333-333333333333',
      hostname: 'db-prod-02',
      id: '44444444-4444-4444-8444-444444444444',
    };
    const otherAlert: DashboardAlertInstance = {
      ...openAlert,
      agentId: otherHost.agentId,
      id: 'alert-3',
      ruleName: 'High memory',
    };
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[openAlert, otherAlert]}
        copy={messages.en}
        hosts={[host, otherHost]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: messages.en.acknowledgeAlertLabel(
          openAlert.ruleName,
          host.hostname,
        ),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: messages.en.acknowledgeAlertLabel(
          otherAlert.ruleName,
          otherHost.hostname,
        ),
      }),
    ).toBeTruthy();
  });

  it('builds the Turkish accessible name from the rule and host as well', () => {
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[openAlert]}
        copy={messages.tr}
        hosts={[host]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: messages.tr.acknowledgeAlertLabel(
          openAlert.ruleName,
          host.hostname,
        ),
      }),
    ).toBeTruthy();
  });

  it('falls back to the raw agent id when the host is not in the fleet', () => {
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[openAlert]}
        copy={messages.en}
        hosts={[]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(screen.getByText(openAlert.agentId)).toBeTruthy();
  });

  it('does not render an acknowledge button for an already-acknowledged alert', () => {
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[acknowledgedAlert]}
        copy={messages.en}
        hosts={[host]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: messages.en.acknowledgeAlert }),
    ).toBeNull();
  });

  it('shows a concise error message when acknowledging failed', () => {
    render(
      <AlertsPanel
        acknowledgeError={true}
        alerts={[openAlert]}
        copy={messages.en}
        hosts={[host]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      messages.en.acknowledgeFailed,
    );
  });

  it('marks the alert list as a polite live region so new alerts are announced', () => {
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[openAlert]}
        copy={messages.en}
        hosts={[host]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(screen.getByRole('list').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('renders Turkish copy', () => {
    render(
      <AlertsPanel
        acknowledgeError={false}
        alerts={[]}
        copy={messages.tr}
        hosts={[]}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: messages.tr.activeAlerts }),
    ).toBeTruthy();
  });
});
