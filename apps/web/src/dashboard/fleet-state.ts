import type { DASHBOARD_EVENT_TYPES } from '@nexus-monitor/contracts';
import {
  type AlertInstanceState,
  type DashboardAlertInstance,
  type DashboardEvent,
  type DashboardFleetSnapshot,
  type DashboardHost,
} from '@nexus-monitor/contracts';

type AlertTransitionPayload = Extract<
  DashboardEvent,
  { type: typeof DASHBOARD_EVENT_TYPES.alertOpened }
>['payload'];

export interface FleetState {
  readonly alerts: readonly DashboardAlertInstance[];
  readonly generatedAt: string | null;
  readonly hosts: readonly DashboardHost[];
}

export type FleetAction =
  | { readonly snapshot: DashboardFleetSnapshot; readonly type: 'snapshot' }
  | {
      readonly alerts: readonly DashboardAlertInstance[];
      readonly type: 'alerts';
    }
  | { readonly event: DashboardEvent; readonly type: 'event' }
  | { readonly id: string; readonly type: 'alert-acknowledge-start' }
  | { readonly id: string; readonly type: 'alert-acknowledge-revert' };

export function createFleetState(): FleetState {
  return { alerts: [], generatedAt: null, hosts: [] };
}

export function reduceFleet(
  state: FleetState,
  action: FleetAction,
): FleetState {
  if (action.type === 'snapshot') {
    return {
      alerts: state.alerts,
      generatedAt: action.snapshot.generatedAt,
      hosts: [...action.snapshot.hosts],
    };
  }

  if (action.type === 'alerts') {
    return { ...state, alerts: sortAlertsNewestFirst(action.alerts) };
  }

  if (action.type === 'alert-acknowledge-start') {
    return {
      ...state,
      alerts: setAlertState(state.alerts, action.id, 'ACKNOWLEDGED'),
    };
  }

  if (action.type === 'alert-acknowledge-revert') {
    return {
      ...state,
      alerts: setAlertState(state.alerts, action.id, 'OPEN'),
    };
  }

  if (action.event.type === 'alert.opened') {
    return {
      ...state,
      alerts: openAlert(
        state.alerts,
        action.event.occurredAt,
        action.event.payload,
      ),
    };
  }

  if (action.event.type === 'alert.resolved') {
    return {
      ...state,
      alerts: resolveAlert(state.alerts, action.event.payload),
    };
  }

  const index = state.hosts.findIndex(
    (host) => host.id === action.event.hostId,
  );
  if (index < 0) {
    return state;
  }

  const current = state.hosts[index]!;
  const updated: DashboardHost =
    action.event.type === 'host.metric'
      ? { ...current, latestMetric: action.event.payload }
      : {
          ...current,
          availability: action.event.payload.availability,
          lastSeenAt: action.event.payload.lastSeenAt,
        };
  const hosts = [...state.hosts];
  hosts[index] = updated;
  return { ...state, generatedAt: action.event.occurredAt, hosts };
}

function sortAlertsNewestFirst(
  alerts: readonly DashboardAlertInstance[],
): readonly DashboardAlertInstance[] {
  return [...alerts].sort(
    (a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt),
  );
}

function setAlertState(
  alerts: readonly DashboardAlertInstance[],
  id: string,
  nextState: AlertInstanceState,
): readonly DashboardAlertInstance[] {
  return alerts.map((alert) =>
    alert.id === id ? { ...alert, state: nextState } : alert,
  );
}

function openAlert(
  alerts: readonly DashboardAlertInstance[],
  occurredAt: string,
  payload: AlertTransitionPayload,
): readonly DashboardAlertInstance[] {
  const withoutExisting = alerts.filter(
    (alert) =>
      !(alert.ruleId === payload.ruleId && alert.agentId === payload.agentId),
  );
  const opened: DashboardAlertInstance = {
    acknowledgedAt: null,
    agentId: payload.agentId,
    id: payload.alertId,
    metric: payload.metric,
    observedValue: payload.observedValue,
    openedAt: occurredAt,
    ruleId: payload.ruleId,
    ruleName: payload.ruleName,
    severity: payload.severity,
    state: 'OPEN',
  };
  return sortAlertsNewestFirst([...withoutExisting, opened]);
}

function resolveAlert(
  alerts: readonly DashboardAlertInstance[],
  payload: AlertTransitionPayload,
): readonly DashboardAlertInstance[] {
  return alerts.filter(
    (alert) =>
      !(alert.ruleId === payload.ruleId && alert.agentId === payload.agentId),
  );
}
