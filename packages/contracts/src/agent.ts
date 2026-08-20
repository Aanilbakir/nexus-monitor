export const HEARTBEAT_INTERVAL_SECONDS = 15 as const;
export const OFFLINE_THRESHOLD_SECONDS = 45 as const;

export interface HostMetadata {
  readonly architecture: string;
  readonly hostname: string;
  readonly platform: string;
}

export interface AgentRegistrationRequest extends HostMetadata {
  readonly agentId: string;
  readonly agentVersion: string;
  readonly hostId: string;
}

export interface AgentRegistrationResponse {
  readonly agentToken: string;
  readonly heartbeatIntervalSeconds: typeof HEARTBEAT_INTERVAL_SECONDS;
  readonly registeredAt: string;
}

export type AgentHeartbeatRequest = HostMetadata;

export interface AgentHeartbeatResponse {
  readonly heartbeatIntervalSeconds: typeof HEARTBEAT_INTERVAL_SECONDS;
  readonly receivedAt: string;
}

export type HostAvailability = 'online' | 'offline';

export function createRegistrationResponse(
  agentToken: string,
  registeredAt: string,
): AgentRegistrationResponse {
  return {
    agentToken,
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    registeredAt,
  };
}

export function createHeartbeatResponse(
  receivedAt: string,
): AgentHeartbeatResponse {
  return {
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    receivedAt,
  };
}
