import type { AgentIdentity } from '../identity/agent-state.js';

export interface HostMetadata {
  readonly architecture: string;
  readonly hostname: string;
  readonly platform: string;
}

export interface RegistrationResult {
  readonly agentToken: string;
}

export type HttpTransport = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class AgentRequestError extends Error {
  constructor(operation: string, status: number) {
    super(`${operation} request failed with status ${status}.`);
  }
}

export class AgentClient {
  constructor(
    private readonly apiUrl: string,
    private readonly transport: HttpTransport = fetch,
  ) {}

  async register(
    identity: AgentIdentity,
    metadata: HostMetadata,
    agentVersion: string,
    enrollmentToken: string,
  ): Promise<RegistrationResult> {
    const response = await this.post(
      'api/v1/agents/register',
      enrollmentToken,
      { ...identity, ...metadata, agentVersion },
    );
    const body: unknown = await response.json();
    if (!isRegistrationResult(body)) {
      throw new Error('Registration response is invalid.');
    }
    return body;
  }

  async heartbeat(
    agentId: string,
    agentToken: string,
    metadata: HostMetadata,
  ): Promise<void> {
    await this.post(
      `api/v1/agents/${encodeURIComponent(agentId)}/heartbeat`,
      agentToken,
      { ...metadata },
    );
  }

  private async post(
    path: string,
    token: string,
    body: Record<string, string>,
  ): Promise<Response> {
    const response = await this.transport(
      new URL(path, this.apiUrl).toString(),
      {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    if (!response.ok) {
      throw new AgentRequestError(path, response.status);
    }
    return response;
  }
}

function isRegistrationResult(value: unknown): value is RegistrationResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return typeof result.agentToken === 'string' && result.agentToken.length > 0;
}
