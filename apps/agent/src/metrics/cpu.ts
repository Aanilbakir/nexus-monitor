export interface CpuTimes {
  readonly idle: number;
  readonly total: number;
}

export function calculateCpuPercent(
  previous: CpuTimes,
  current: CpuTimes,
): number | null {
  const totalDelta = current.total - previous.total;
  if (totalDelta <= 0) return null;

  const idleDelta = current.idle - previous.idle;
  const utilization = (1 - idleDelta / totalDelta) * 100;
  return Math.round(Math.min(100, Math.max(0, utilization)) * 100) / 100;
}
