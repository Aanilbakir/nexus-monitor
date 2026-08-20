export interface AgentEnvironment {
  readonly agentId: string;
  readonly apiUrl: string;
}

export function readAgentEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): AgentEnvironment {
  const agentId = source.AGENT_ID?.trim();

  if (!agentId) {
    throw new Error('Invalid AGENT_ID: expected a non-empty value.');
  }

  let apiUrl: URL;

  try {
    apiUrl = new URL(source.NEXUS_API_URL ?? '');
  } catch {
    throw new Error('Invalid NEXUS_API_URL: expected an HTTP or HTTPS URL.');
  }

  if (apiUrl.protocol !== 'http:' && apiUrl.protocol !== 'https:') {
    throw new Error('Invalid NEXUS_API_URL: expected an HTTP or HTTPS URL.');
  }

  return {
    agentId,
    apiUrl: apiUrl.toString(),
  };
}
