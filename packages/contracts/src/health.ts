export const SERVICE_HEALTH_STATUS = 'operational' as const;

export interface ServiceHealth {
  readonly service: string;
  readonly status: typeof SERVICE_HEALTH_STATUS;
  readonly timestamp: string;
}

export function createServiceHealth(
  service: string,
  timestamp: string,
): ServiceHealth {
  return {
    service,
    status: SERVICE_HEALTH_STATUS,
    timestamp,
  };
}
