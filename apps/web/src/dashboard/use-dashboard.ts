import type {
  DashboardAlertInstance,
  DashboardEvent,
  DashboardHost,
} from '@nexus-monitor/contracts';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  acknowledgeAlert as requestAlertAcknowledgement,
  AlertConflictError,
  DashboardUnauthorizedError,
  fetchActiveAlerts,
  fetchFleetSnapshot,
} from './api';
import { clearApiKey, loadApiKey } from './api-key';
import { createFleetState, reduceFleet } from './fleet-state';
import { openDashboardEvents } from './realtime';
import { navigateToHost, readHostRoute } from './routing';

export type LoadState = 'loading' | 'ready' | 'error' | 'unauthorized';
export type ConnectionState = 'connecting' | 'live' | 'reconnecting';

export interface DashboardState {
  readonly acknowledgeAlert: (id: string) => void;
  readonly alertAcknowledgeError: boolean;
  readonly alerts: readonly DashboardAlertInstance[];
  readonly connection: ConnectionState;
  readonly hosts: readonly DashboardHost[];
  readonly loadState: LoadState;
  readonly retry: () => void;
  readonly selectHost: (hostId: string) => void;
  readonly selectedHost: DashboardHost | null;
  readonly selectedHostId: string | null;
}

export function useDashboard(): DashboardState {
  const [fleet, dispatch] = useReducer(
    reduceFleet,
    undefined,
    createFleetState,
  );
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedHostId, setSelectedHostId] = useState(() =>
    readHostRoute(window.location.pathname),
  );
  const [alertAcknowledgeError, setAlertAcknowledgeError] = useState(false);
  const disconnected = useRef(false);
  const reconciling = useRef(false);
  const pendingAlertEvents = useRef<DashboardEvent[]>([]);
  const connectionController = useRef<AbortController | null>(null);

  const selectHost = useCallback((hostId: string) => {
    navigateToHost(hostId);
    setSelectedHostId(hostId);
  }, []);

  useEffect(() => {
    const onPopState = (): void => {
      setSelectedHostId(readHostRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    connectionController.current = controller;
    let closeEvents: (() => void) | undefined;

    if (!loadApiKey()) {
      setLoadState('unauthorized');
      return () => controller.abort();
    }

    const reconcile = async (): Promise<void> => {
      reconciling.current = true;
      try {
        const [snapshot, alerts] = await Promise.all([
          fetchFleetSnapshot(controller.signal),
          fetchActiveAlerts(controller.signal),
        ]);
        dispatch({ snapshot, type: 'snapshot' });
        dispatch({ alerts, type: 'alerts' });
        setLoadState('ready');

        const routeHostId = readHostRoute(window.location.pathname);
        if (!routeHostId && snapshot.hosts[0]) {
          navigateToHost(snapshot.hosts[0].id);
          setSelectedHostId(snapshot.hosts[0].id);
        }
      } finally {
        reconciling.current = false;
        const buffered = pendingAlertEvents.current;
        pendingAlertEvents.current = [];
        if (!controller.signal.aborted) {
          for (const event of buffered) {
            dispatch({ event, type: 'event' });
          }
        }
      }
    };

    const connect = async (): Promise<void> => {
      try {
        await reconcile();
        closeEvents = openDashboardEvents({
          onDisconnect: () => {
            disconnected.current = true;
            setConnection('reconnecting');
          },
          onEvent: (event) => {
            const isAlertTransition =
              event.type === 'alert.opened' || event.type === 'alert.resolved';
            if (reconciling.current && isAlertTransition) {
              pendingAlertEvents.current.push(event);
              return;
            }
            dispatch({ event, type: 'event' });
          },
          onReady: () => {
            if (!disconnected.current) {
              setConnection('live');
              return;
            }

            void reconcile()
              .then(() => {
                disconnected.current = false;
                setConnection('live');
              })
              .catch(() => setConnection('reconnecting'));
          },
          onUnauthorized: () => {
            clearApiKey();
            setLoadState('unauthorized');
          },
        });
      } catch (error) {
        if (error instanceof DashboardUnauthorizedError) {
          clearApiKey();
          setLoadState('unauthorized');
          return;
        }
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLoadState('error');
        }
      }
    };

    setLoadState('loading');
    setConnection('connecting');
    void connect();
    return () => {
      controller.abort();
      closeEvents?.();
    };
  }, [retryVersion]);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlertAcknowledgeError(false);
    dispatch({ id, type: 'alert-acknowledge-start' });
    void requestAlertAcknowledgement(id).catch((error: unknown) => {
      if (error instanceof DashboardUnauthorizedError) {
        dispatch({ id, type: 'alert-acknowledge-revert' });
        clearApiKey();
        setLoadState('unauthorized');
        return;
      }

      if (error instanceof AlertConflictError) {
        const signal =
          connectionController.current?.signal ?? new AbortController().signal;
        void fetchActiveAlerts(signal)
          .then((alerts) => dispatch({ alerts, type: 'alerts' }))
          .catch((refreshError: unknown) => {
            dispatch({ id, type: 'alert-acknowledge-revert' });
            if (refreshError instanceof DashboardUnauthorizedError) {
              clearApiKey();
              setLoadState('unauthorized');
            }
          });
        return;
      }

      dispatch({ id, type: 'alert-acknowledge-revert' });
      setAlertAcknowledgeError(true);
    });
  }, []);

  const selectedHost = useMemo(
    () => fleet.hosts.find((host) => host.id === selectedHostId) ?? null,
    [fleet.hosts, selectedHostId],
  );

  return {
    acknowledgeAlert,
    alertAcknowledgeError,
    alerts: fleet.alerts,
    connection,
    hosts: fleet.hosts,
    loadState,
    retry: () => setRetryVersion((version) => version + 1),
    selectHost,
    selectedHost,
    selectedHostId,
  };
}
