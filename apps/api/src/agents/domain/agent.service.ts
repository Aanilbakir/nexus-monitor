import {
  createHeartbeatResponse,
  createRegistrationResponse,
} from '@nexus-monitor/contracts';
import type {
  AgentHeartbeatRequest,
  AgentHeartbeatResponse,
  AgentRegistrationRequest,
  AgentRegistrationResponse,
} from '@nexus-monitor/contracts';

import type { CredentialService } from './credential.service.js';
import { DashboardEventPublisher } from '../../dashboard/domain/dashboard-event.publisher.js';

export interface EnrollAgentInput extends AgentRegistrationRequest {
  readonly credentialHash: string;
  readonly enrolledAt: Date;
}

export interface RecordHeartbeatInput extends AgentHeartbeatRequest {
  readonly agentId: string;
  readonly receivedAt: Date;
}

export interface AgentRepository {
  enroll(input: EnrollAgentInput): Promise<void>;
  findCredentialHash(agentId: string): Promise<string | null>;
  recordHeartbeat(input: RecordHeartbeatInput): Promise<string>;
}

export class UnauthorizedAgentError extends Error {
  public constructor() {
    super('Agent authentication failed.');
    this.name = 'UnauthorizedAgentError';
  }
}

export type Clock = () => Date;

export class AgentService {
  public constructor(
    private readonly repository: AgentRepository,
    private readonly credentials: CredentialService,
    private readonly clock: Clock = () => new Date(),
    private readonly dashboardEvents = new DashboardEventPublisher(),
  ) {}

  public async register(
    request: AgentRegistrationRequest,
    enrollmentToken: string,
  ): Promise<AgentRegistrationResponse> {
    if (!this.credentials.verifyEnrollmentToken(enrollmentToken)) {
      throw new UnauthorizedAgentError();
    }

    const registeredAt = this.clock();
    const agentToken = this.credentials.createAgentToken();

    await this.repository.enroll({
      ...request,
      credentialHash: this.credentials.hash(agentToken),
      enrolledAt: registeredAt,
    });

    return createRegistrationResponse(agentToken, registeredAt.toISOString());
  }

  public async heartbeat(
    agentId: string,
    agentToken: string,
    request: AgentHeartbeatRequest,
  ): Promise<AgentHeartbeatResponse> {
    const credentialHash = await this.repository.findCredentialHash(agentId);

    if (
      !credentialHash ||
      !this.credentials.verifyAgentToken(agentToken, credentialHash)
    ) {
      throw new UnauthorizedAgentError();
    }

    const receivedAt = this.clock();
    const hostId = await this.repository.recordHeartbeat({
      ...request,
      agentId,
      receivedAt,
    });

    this.dashboardEvents.publish({
      hostId,
      occurredAt: receivedAt.toISOString(),
      payload: {
        availability: 'online',
        lastSeenAt: receivedAt.toISOString(),
      },
      type: 'host.status',
      version: 1,
    });

    return createHeartbeatResponse(receivedAt.toISOString());
  }
}
