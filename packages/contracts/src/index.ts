export {
  createServiceHealth,
  SERVICE_HEALTH_STATUS,
  type ServiceHealth,
} from './health.js';

export {
  createHeartbeatResponse,
  createRegistrationResponse,
  HEARTBEAT_INTERVAL_SECONDS,
  OFFLINE_THRESHOLD_SECONDS,
  type AgentHeartbeatRequest,
  type AgentHeartbeatResponse,
  type AgentRegistrationRequest,
  type AgentRegistrationResponse,
  type HostAvailability,
  type HostMetadata,
} from './agent.js';
