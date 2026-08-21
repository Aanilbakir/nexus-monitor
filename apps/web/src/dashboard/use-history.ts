import type {
  DashboardHistoryResponse,
  HistoryRange,
} from '@nexus-monitor/contracts';
import { useEffect, useState } from 'react';

import { fetchHostHistory } from './api';
import type { LoadState } from './use-dashboard';

export type FetchHostHistory = (
  hostId: string,
  range: HistoryRange,
  signal: AbortSignal,
) => Promise<DashboardHistoryResponse>;

export interface HistoryState {
  readonly data: DashboardHistoryResponse | null;
  readonly loadState: LoadState;
  readonly range: HistoryRange;
  readonly retry: () => void;
  readonly setRange: (range: HistoryRange) => void;
}

export function useHistory(
  hostId: string,
  loadHistory: FetchHostHistory = fetchHostHistory,
): HistoryState {
  const [data, setData] = useState<DashboardHistoryResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [range, setRange] = useState<HistoryRange>('24h');
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setData(null);
    setLoadState('loading');
    void loadHistory(hostId, range, controller.signal)
      .then((response) => {
        if (active) {
          setData(response);
          setLoadState('ready');
        }
      })
      .catch((error: unknown) => {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setLoadState('error');
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [hostId, loadHistory, range, retryVersion]);

  return {
    data,
    loadState,
    range,
    retry: () => setRetryVersion((version) => version + 1),
    setRange,
  };
}
