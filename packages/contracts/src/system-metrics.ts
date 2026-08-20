export const METRICS_INTERVAL_SECONDS = 15 as const;
export const MAX_FUTURE_SKEW_MILLISECONDS = 5 * 60 * 1_000;

export interface SystemMetricSample {
  readonly collectedAt: string;
  readonly cpuPercent: number;
  readonly diskFreeBytes: number;
  readonly diskTotalBytes: number;
  readonly diskUsedBytes: number;
  readonly memoryTotalBytes: number;
  readonly memoryUsedBytes: number;
  readonly networkReceivedBytes: number;
  readonly networkTransmittedBytes: number;
  readonly uptimeSeconds: number;
}

export interface SystemMetricIngestResponse {
  readonly collectedAt: string;
  readonly metricsIntervalSeconds: typeof METRICS_INTERVAL_SECONDS;
  readonly receivedAt: string;
}

export type MetricSampleValidation =
  { readonly valid: true } | { readonly reason: string; readonly valid: false };

const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function validateSystemMetricSample(
  sample: SystemMetricSample,
  now: Date,
): MetricSampleValidation {
  if (
    !isPercentage(sample.cpuPercent) ||
    !isCounter(sample.diskFreeBytes) ||
    !isCounter(sample.diskTotalBytes) ||
    !isCounter(sample.diskUsedBytes) ||
    !isCounter(sample.memoryTotalBytes) ||
    !isCounter(sample.memoryUsedBytes) ||
    !isCounter(sample.networkReceivedBytes) ||
    !isCounter(sample.networkTransmittedBytes) ||
    !isCounter(sample.uptimeSeconds)
  ) {
    return { valid: false, reason: 'Metric values are invalid.' };
  }

  if (sample.memoryUsedBytes > sample.memoryTotalBytes) {
    return { valid: false, reason: 'Memory values are inconsistent.' };
  }

  if (sample.diskUsedBytes + sample.diskFreeBytes > sample.diskTotalBytes) {
    return { valid: false, reason: 'Disk values are inconsistent.' };
  }

  if (!UTC_TIMESTAMP.test(sample.collectedAt)) {
    return { valid: false, reason: 'Collection timestamp is invalid.' };
  }

  const collectedAt = Date.parse(sample.collectedAt);
  if (!Number.isFinite(collectedAt)) {
    return { valid: false, reason: 'Collection timestamp is invalid.' };
  }

  if (collectedAt > now.getTime() + MAX_FUTURE_SKEW_MILLISECONDS) {
    return { valid: false, reason: 'Collection timestamp is in the future.' };
  }

  return { valid: true };
}

export function createMetricIngestResponse(
  collectedAt: string,
  receivedAt: string,
): SystemMetricIngestResponse {
  return {
    collectedAt,
    metricsIntervalSeconds: METRICS_INTERVAL_SECONDS,
    receivedAt,
  };
}

function isCounter(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}
