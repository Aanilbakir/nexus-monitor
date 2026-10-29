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

export const HISTORY_RANGES = ['1h', '6h', '24h', '7d', '30d'] as const;

export type HistoryRange = (typeof HISTORY_RANGES)[number];

export interface DashboardHistoryPoint {
  readonly bucketAt: string;
  readonly cpuPercent: number | null;
  readonly diskUsedPercent: number | null;
  readonly memoryUsedPercent: number | null;
  readonly networkReceivedBytes: string;
  readonly networkTransmittedBytes: string;
}

export interface DashboardHistoryResponse {
  readonly bucketSeconds: number;
  readonly endAt: string;
  readonly hostId: string;
  readonly points: readonly DashboardHistoryPoint[];
  readonly range: HistoryRange;
  readonly startAt: string;
}

export const DASHBOARD_EVENT_TYPES = {
  alertOpened: 'alert.opened',
  alertResolved: 'alert.resolved',
  metric: 'host.metric',
  status: 'host.status',
} as const;

export type AlertInstanceState = 'ACKNOWLEDGED' | 'OPEN' | 'RESOLVED';

export interface DashboardAlertInstance {
  readonly acknowledgedAt: string | null;
  readonly agentId: string;
  readonly id: string;
  readonly metric: string;
  readonly observedValue: number;
  readonly openedAt: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: string;
  readonly state: AlertInstanceState;
}

interface DashboardAlertTransitionPayload {
  readonly agentId: string;
  readonly alertId: string;
  readonly metric: string;
  readonly observedValue: number;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: string;
}

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
    }
  | {
      readonly hostId: string;
      readonly occurredAt: string;
      readonly payload: DashboardAlertTransitionPayload;
      readonly type: typeof DASHBOARD_EVENT_TYPES.alertOpened;
      readonly version: 1;
    }
  | {
      readonly hostId: string;
      readonly occurredAt: string;
      readonly payload: DashboardAlertTransitionPayload;
      readonly type: typeof DASHBOARD_EVENT_TYPES.alertResolved;
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

  if (
    value.type === DASHBOARD_EVENT_TYPES.alertOpened ||
    value.type === DASHBOARD_EVENT_TYPES.alertResolved
  ) {
    return isAlertTransitionPayload(value.payload);
  }

  return false;
}

function isAlertTransitionPayload(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.agentId) &&
    isNonEmptyString(value.alertId) &&
    isNonEmptyString(value.metric) &&
    typeof value.observedValue === 'number' &&
    Number.isFinite(value.observedValue) &&
    isNonEmptyString(value.ruleId) &&
    isNonEmptyString(value.ruleName) &&
    isNonEmptyString(value.severity)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isDashboardHistoryResponse(
  value: unknown,
): value is DashboardHistoryResponse {
  if (
    !isRecord(value) ||
    typeof value.hostId !== 'string' ||
    value.hostId.length === 0 ||
    !isHistoryRange(value.range) ||
    !Number.isInteger(value.bucketSeconds) ||
    typeof value.bucketSeconds !== 'number' ||
    value.bucketSeconds <= 0 ||
    !isTimestamp(value.startAt) ||
    !isTimestamp(value.endAt) ||
    !Array.isArray(value.points)
  ) {
    return false;
  }

  let previousTimestamp = Number.NEGATIVE_INFINITY;
  for (const point of value.points) {
    if (!isDashboardHistoryPoint(point)) {
      return false;
    }

    const timestamp = Date.parse(point.bucketAt);
    if (timestamp <= previousTimestamp) {
      return false;
    }
    previousTimestamp = timestamp;
  }

  return true;
}

function isDashboardHistoryPoint(
  value: unknown,
): value is DashboardHistoryPoint {
  return (
    isRecord(value) &&
    isTimestamp(value.bucketAt) &&
    isPercentage(value.cpuPercent) &&
    isPercentage(value.diskUsedPercent) &&
    isPercentage(value.memoryUsedPercent) &&
    isCounter(value.networkReceivedBytes) &&
    isCounter(value.networkTransmittedBytes)
  );
}

function isHistoryRange(value: unknown): value is HistoryRange {
  return HISTORY_RANGES.some((range) => range === value);
}

function isPercentage(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100)
  );
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
