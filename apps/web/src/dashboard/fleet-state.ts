import type {
  DashboardEvent,
  DashboardFleetSnapshot,
  DashboardHost,
} from '@nexus-monitor/contracts';

export interface FleetState {
  readonly generatedAt: string | null;
  readonly hosts: readonly DashboardHost[];
}

export type FleetAction =
  | { readonly snapshot: DashboardFleetSnapshot; readonly type: 'snapshot' }
  | { readonly event: DashboardEvent; readonly type: 'event' };

export function createFleetState(): FleetState {
  return { generatedAt: null, hosts: [] };
}

export function reduceFleet(state: FleetState, action: FleetAction): FleetState {
  if (action.type === 'snapshot') {
    return {
      generatedAt: action.snapshot.generatedAt,
      hosts: [...action.snapshot.hosts],
    };
  }

  const index = state.hosts.findIndex((host) => host.id === action.event.hostId);
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
  return { generatedAt: action.event.occurredAt, hosts };
}

