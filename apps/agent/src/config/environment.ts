export interface AgentEnvironment {
  readonly agentVersion: string;
  readonly apiUrl: string;
  readonly enrollmentToken: string;
  readonly statePath: string;
}

export function readAgentEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): AgentEnvironment {
  const enrollmentToken = source.AGENT_ENROLLMENT_TOKEN?.trim();
  const statePath = source.NEXUS_AGENT_STATE_PATH?.trim();

  if (!enrollmentToken) {
    throw new Error(
      'Invalid AGENT_ENROLLMENT_TOKEN: expected a non-empty value.',
    );
  }

  if (!statePath) {
    throw new Error(
      'Invalid NEXUS_AGENT_STATE_PATH: expected a non-empty value.',
    );
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
    agentVersion: source.AGENT_VERSION?.trim() || '0.1.0',
    apiUrl: apiUrl.toString(),
    enrollmentToken,
    statePath,
  };
}
