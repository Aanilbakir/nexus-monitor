import type { DashboardHost } from '@nexus-monitor/contracts';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { DashboardUnauthorizedError, fetchFleetSnapshot } from './api';
import { clearApiKey, loadApiKey } from './api-key';
import { createFleetState, reduceFleet } from './fleet-state';
import { openDashboardEvents } from './realtime';
import { navigateToHost, readHostRoute } from './routing';

export type LoadState = 'loading' | 'ready' | 'error' | 'unauthorized';
export type ConnectionState = 'connecting' | 'live' | 'reconnecting';

export interface DashboardState {
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
  const disconnected = useRef(false);

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
    let closeEvents: (() => void) | undefined;

    if (!loadApiKey()) {
      setLoadState('unauthorized');
      return () => controller.abort();
    }

    const reconcile = async (): Promise<void> => {
      const snapshot = await fetchFleetSnapshot(controller.signal);
      dispatch({ snapshot, type: 'snapshot' });
      setLoadState('ready');

      const routeHostId = readHostRoute(window.location.pathname);
      if (!routeHostId && snapshot.hosts[0]) {
        navigateToHost(snapshot.hosts[0].id);
        setSelectedHostId(snapshot.hosts[0].id);
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
          onEvent: (event) => dispatch({ event, type: 'event' }),
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

  const selectedHost = useMemo(
    () => fleet.hosts.find((host) => host.id === selectedHostId) ?? null,
    [fleet.hosts, selectedHostId],
  );

  return {
    connection,
    hosts: fleet.hosts,
    loadState,
    retry: () => setRetryVersion((version) => version + 1),
    selectHost,
    selectedHost,
    selectedHostId,
  };
}
