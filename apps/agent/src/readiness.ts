export interface AgentReadiness {
  readonly agentId: string;
  readonly status: 'ready';
  readonly timestamp: string;
}

export function createAgentReadiness(
  agentId: string,
  timestamp: string,
): AgentReadiness {
  return {
    agentId,
    status: 'ready',
    timestamp,
  };
}
