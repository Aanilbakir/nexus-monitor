import type {
  DashboardFleetSnapshot,
  DashboardHistoryResponse,
  DashboardHost,
  DashboardMetric,
  HistoryRange,
} from '@nexus-monitor/contracts';
import { isDashboardHistoryResponse } from '@nexus-monitor/contracts';

import { loadApiKey } from './api-key';

export class DashboardRequestError extends Error {
  public constructor() {
    super('Dashboard data is unavailable.');
    this.name = 'DashboardRequestError';
  }
}

export class DashboardUnauthorizedError extends Error {
  public constructor() {
    super('Dashboard authentication is required.');
    this.name = 'DashboardUnauthorizedError';
  }
}

function authorizationHeaders(): Record<string, string> {
  const apiKey = loadApiKey();
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

export async function fetchFleetSnapshot(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<DashboardFleetSnapshot> {
  const response = await fetcher('/api/v1/dashboard/hosts', {
    headers: authorizationHeaders(),
    signal,
  });
  if (response.status === 401) {
    throw new DashboardUnauthorizedError();
  }
  if (!response.ok) {
    throw new DashboardRequestError();
  }

  const value: unknown = await response.json();
  if (!isFleetSnapshot(value)) {
    throw new DashboardRequestError();
  }

  return value;
}

export async function fetchHostHistory(
  hostId: string,
  range: HistoryRange,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<DashboardHistoryResponse> {
  const response = await fetcher(
    `/api/v1/dashboard/hosts/${encodeURIComponent(hostId)}/history?range=${range}`,
    { headers: authorizationHeaders(), signal },
  );
  if (response.status === 401) {
    throw new DashboardUnauthorizedError();
  }
  if (!response.ok) {
    throw new DashboardRequestError();
  }

  const value: unknown = await response.json();
  if (!isDashboardHistoryResponse(value)) {
    throw new DashboardRequestError();
  }

  return value;
}

function isFleetSnapshot(value: unknown): value is DashboardFleetSnapshot {
  return (
    isRecord(value) &&
    isTimestamp(value.generatedAt) &&
    Array.isArray(value.hosts) &&
    value.hosts.every(isHost)
  );
}

function isHost(value: unknown): value is DashboardHost {
  return (
    isRecord(value) &&
    isString(value.agentId) &&
    isString(value.agentVersion) &&
    isString(value.architecture) &&
    (value.availability === 'online' || value.availability === 'offline') &&
    isString(value.hostname) &&
    isString(value.id) &&
    (value.lastSeenAt === null || isTimestamp(value.lastSeenAt)) &&
    (value.latestMetric === null || isMetric(value.latestMetric)) &&
    isString(value.platform)
  );
}

function isMetric(value: unknown): value is DashboardMetric {
  return (
    isRecord(value) &&
    isTimestamp(value.collectedAt) &&
    typeof value.cpuPercent === 'number' &&
    Number.isFinite(value.cpuPercent) &&
    isCounter(value.diskFreeBytes) &&
    isCounter(value.diskTotalBytes) &&
    isCounter(value.diskUsedBytes) &&
    isCounter(value.memoryTotalBytes) &&
    isCounter(value.memoryUsedBytes) &&
    isCounter(value.networkReceivedBytes) &&
    isCounter(value.networkTransmittedBytes) &&
    isCounter(value.uptimeSeconds)
  );
}

function isCounter(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
