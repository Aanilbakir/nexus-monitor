import type { DashboardAlertInstance } from '@nexus-monitor/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { messages } from '../i18n/messages';
import { AlertsPanel } from './alerts-panel';

afterEach(() => {
  cleanup();
});

const openAlert: DashboardAlertInstance = {
  acknowledgedAt: null,
  agentId: '22222222-2222-4222-8222-222222222222',
  id: '11111111-1111-4111-8111-111111111111',
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
  id: '33333333-3333-4333-8333-333333333333',
  state: 'ACKNOWLEDGED',
};

describe('AlertsPanel', () => {
  it('renders the active alerts heading and an empty state with no alerts', () => {
    render(
      <AlertsPanel alerts={[]} copy={messages.en} onAcknowledge={vi.fn()} />,
    );

    expect(
      screen.getByRole('heading', { name: messages.en.activeAlerts }),
    ).toBeTruthy();
    expect(screen.getByText(messages.en.noActiveAlerts)).toBeTruthy();
  });

  it('lists an open alert with an acknowledge button that calls back with its id', () => {
    const onAcknowledge = vi.fn();
    render(
      <AlertsPanel
        alerts={[openAlert]}
        copy={messages.en}
        onAcknowledge={onAcknowledge}
      />,
    );

    expect(screen.getByText(openAlert.ruleName)).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: messages.en.acknowledgeAlert }),
    );

    expect(onAcknowledge).toHaveBeenCalledWith(openAlert.id);
  });

  it('does not render an acknowledge button for an already-acknowledged alert', () => {
    render(
      <AlertsPanel
        alerts={[acknowledgedAlert]}
        copy={messages.en}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: messages.en.acknowledgeAlert }),
    ).toBeNull();
  });

  it('renders Turkish copy', () => {
    render(
      <AlertsPanel alerts={[]} copy={messages.tr} onAcknowledge={vi.fn()} />,
    );

    expect(
      screen.getByRole('heading', { name: messages.tr.activeAlerts }),
    ).toBeTruthy();
  });
});
