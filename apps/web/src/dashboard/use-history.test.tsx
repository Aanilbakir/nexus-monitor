import type { DashboardHistoryResponse } from '@nexus-monitor/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FetchHostHistory } from './use-history';
import { useHistory } from './use-history';

const hostId = '11111111-1111-4111-8111-111111111111';

function history(
  range: DashboardHistoryResponse['range'],
): DashboardHistoryResponse {
  return {
    bucketSeconds: range === '1h' ? 60 : 900,
    endAt: '2026-08-21T10:00:00.000Z',
    hostId,
    points: [],
    range,
    startAt: '2026-08-20T10:00:00.000Z',
  };
}

describe('useHistory', () => {
  it('loads 24 hours by default and aborts the request when the range changes', async () => {
    const signals: AbortSignal[] = [];
    const loader: FetchHostHistory = vi.fn((_, range, signal) => {
      signals.push(signal);
      return Promise.resolve(history(range));
    });
    const { result } = renderHook(() => useHistory(hostId, loader));

    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.range).toBe('24h');
    expect(result.current.data).toEqual(history('24h'));

    act(() => result.current.setRange('1h'));
    await waitFor(() => expect(result.current.data?.range).toBe('1h'));
    expect(signals[0]?.aborted).toBe(true);
  });

  it('keeps a late previous response from replacing the active range', async () => {
    let resolveDay: (value: DashboardHistoryResponse) => void = () => undefined;
    const loader: FetchHostHistory = vi.fn((_, range) => {
      if (range === '24h') {
        return new Promise((resolve) => {
          resolveDay = resolve;
        });
      }
      return Promise.resolve(history(range));
    });
    const { result } = renderHook(() => useHistory(hostId, loader));

    act(() => result.current.setRange('1h'));
    await waitFor(() => expect(result.current.data?.range).toBe('1h'));
    await act(async () => resolveDay(history('24h')));
    expect(result.current.data?.range).toBe('1h');
  });

  it('exposes an error and retries the active request', async () => {
    const loader: FetchHostHistory = vi
      .fn<FetchHostHistory>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(history('24h'));
    const { result } = renderHook(() => useHistory(hostId, loader));

    await waitFor(() => expect(result.current.loadState).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.data).toEqual(history('24h'));
  });
});
