import {
  type HostMetadata,
  type RegistrationResult,
} from '../client/agent-client.js';
import {
  type AgentIdentity,
  type AgentState,
  type AgentStateStore,
  createAgentIdentity,
} from '../identity/agent-state.js';

const HEARTBEAT_INTERVAL_MS = 15_000;

export interface AgentApiClient {
  register(
    identity: AgentIdentity,
    metadata: HostMetadata,
    agentVersion: string,
    enrollmentToken: string,
  ): Promise<RegistrationResult>;
  heartbeat(
    agentId: string,
    agentToken: string,
    metadata: HostMetadata,
  ): Promise<void>;
}

export type Scheduler = (
  task: () => Promise<void>,
  intervalMilliseconds: number,
) => void;

export class AgentRuntime {
  constructor(
    private readonly store: AgentStateStore,
    private readonly client: AgentApiClient,
    private readonly schedule: Scheduler = (task, interval) => {
      setInterval(() => void task(), interval);
    },
    private readonly createIdentity: () => AgentIdentity = createAgentIdentity,
    private readonly reportError: (error: unknown) => void = (error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Heartbeat request failed.'}\n`,
      );
    },
  ) {}

  async start(
    metadata: HostMetadata,
    agentVersion: string,
    enrollmentToken: string,
  ): Promise<AgentState> {
    let state = await this.store.read();
    if (!state) {
      const identity = this.createIdentity();
      const registration = await this.client.register(
        identity,
        metadata,
        agentVersion,
        enrollmentToken,
      );
      state = { ...identity, agentToken: registration.agentToken };
      await this.store.write(state);
    }

    const heartbeat = async (): Promise<void> => {
      await this.client.heartbeat(state.agentId, state.agentToken, metadata);
    };

    await heartbeat();
    this.schedule(async () => {
      try {
        await heartbeat();
      } catch (error) {
        this.reportError(error);
      }
    }, HEARTBEAT_INTERVAL_MS);
    return state;
  }
}
