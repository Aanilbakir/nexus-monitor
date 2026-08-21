import type { HostAvailability } from './agent.js';

export interface DashboardMetric {
  readonly collectedAt: string;
  readonly cpuPercent: number;
  readonly diskFreeBytes: string;
  readonly diskTotalBytes: string;
  readonly diskUsedBytes: string;
  readonly memoryTotalBytes: string;
  readonly memoryUsedBytes: string;
  readonly networkReceivedBytes: string;
  readonly networkTransmittedBytes: string;
  readonly uptimeSeconds: string;
}

export interface DashboardHost {
  readonly agentId: string;
  readonly agentVersion: string;
  readonly architecture: string;
  readonly availability: HostAvailability;
  readonly hostname: string;
  readonly id: string;
  readonly lastSeenAt: string | null;
  readonly latestMetric: DashboardMetric | null;
  readonly platform: string;
}

export interface DashboardFleetSnapshot {
  readonly generatedAt: string;
  readonly hosts: readonly DashboardHost[];
}

export const DASHBOARD_EVENT_TYPES = {
  metric: 'host.metric',
  status: 'host.status',
} as const;

export type DashboardEvent =
  | {
      readonly hostId: string;
      readonly occurredAt: string;
      readonly payload: DashboardMetric;
      readonly type: typeof DASHBOARD_EVENT_TYPES.metric;
      readonly version: 1;
    }
  | {
      readonly hostId: string;
      readonly occurredAt: string;
      readonly payload: {
        readonly availability: HostAvailability;
        readonly lastSeenAt: string | null;
      };
      readonly type: typeof DASHBOARD_EVENT_TYPES.status;
      readonly version: 1;
    };

export function isDashboardEvent(value: unknown): value is DashboardEvent {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.hostId !== 'string' ||
    value.hostId.length === 0 ||
    !isTimestamp(value.occurredAt) ||
    !isRecord(value.payload)
  ) {
    return false;
  }

  if (value.type === DASHBOARD_EVENT_TYPES.metric) {
    return isDashboardMetric(value.payload);
  }

  if (value.type === DASHBOARD_EVENT_TYPES.status) {
    return (
      isAvailability(value.payload.availability) &&
      (value.payload.lastSeenAt === null ||
        isTimestamp(value.payload.lastSeenAt))
    );
  }

  return false;
}

function isDashboardMetric(value: Record<string, unknown>): boolean {
  return (
    isTimestamp(value.collectedAt) &&
    typeof value.cpuPercent === 'number' &&
    Number.isFinite(value.cpuPercent) &&
    value.cpuPercent >= 0 &&
    value.cpuPercent <= 100 &&
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

function isAvailability(value: unknown): value is HostAvailability {
  return value === 'online' || value === 'offline';
}

function isCounter(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

