import {
  createMetricIngestResponse,
  validateSystemMetricSample,
} from '@nexus-monitor/contracts';
import type {
  SystemMetricIngestResponse,
  SystemMetricSample,
} from '@nexus-monitor/contracts';

import { UnauthorizedAgentError, type Clock } from './agent.service.js';
import type { CredentialService } from './credential.service.js';
import { DashboardEventPublisher } from '../../dashboard/domain/dashboard-event.publisher.js';

export interface AgentMetricIdentity {
  readonly credentialHash: string;
  readonly hostId: string;
}

export interface InsertMetricInput {
  readonly agentId: string;
  readonly collectedAt: Date;
  readonly cpuPercent: number;
  readonly diskFreeBytes: bigint;
  readonly diskTotalBytes: bigint;
  readonly diskUsedBytes: bigint;
  readonly memoryTotalBytes: bigint;
  readonly memoryUsedBytes: bigint;
  readonly networkReceivedBytes: bigint;
  readonly networkTransmittedBytes: bigint;
  readonly receivedAt: Date;
  readonly uptimeSeconds: bigint;
}

export interface MetricRepository {
  findAgentIdentity(agentId: string): Promise<AgentMetricIdentity | null>;
  insert(input: InsertMetricInput): Promise<'duplicate' | 'inserted'>;
}

export class InvalidMetricSampleError extends Error {
  public constructor() {
    super('System metric sample is invalid.');
    this.name = 'InvalidMetricSampleError';
  }
}

export class MetricService {
  public constructor(
    private readonly repository: MetricRepository,
    private readonly credentials: CredentialService,
    private readonly clock: Clock = () => new Date(),
    private readonly dashboardEvents = new DashboardEventPublisher(),
  ) {}

  public async ingest(
    agentId: string,
    agentToken: string,
    sample: SystemMetricSample,
  ): Promise<SystemMetricIngestResponse> {
    const identity = await this.repository.findAgentIdentity(agentId);
    if (
      !identity ||
      !this.credentials.verifyAgentToken(agentToken, identity.credentialHash)
    ) {
      throw new UnauthorizedAgentError();
    }

    const receivedAt = this.clock();
    if (!validateSystemMetricSample(sample, receivedAt).valid) {
      throw new InvalidMetricSampleError();
    }

    const insertResult = await this.repository.insert({
      agentId,
      collectedAt: new Date(sample.collectedAt),
      cpuPercent: sample.cpuPercent,
      diskFreeBytes: BigInt(sample.diskFreeBytes),
      diskTotalBytes: BigInt(sample.diskTotalBytes),
      diskUsedBytes: BigInt(sample.diskUsedBytes),
      memoryTotalBytes: BigInt(sample.memoryTotalBytes),
      memoryUsedBytes: BigInt(sample.memoryUsedBytes),
      networkReceivedBytes: BigInt(sample.networkReceivedBytes),
      networkTransmittedBytes: BigInt(sample.networkTransmittedBytes),
      receivedAt,
      uptimeSeconds: BigInt(sample.uptimeSeconds),
    });

    if (insertResult === 'inserted') {
      this.dashboardEvents.publish({
        hostId: identity.hostId,
        occurredAt: receivedAt.toISOString(),
        payload: {
          collectedAt: sample.collectedAt,
          cpuPercent: sample.cpuPercent,
          diskFreeBytes: String(sample.diskFreeBytes),
          diskTotalBytes: String(sample.diskTotalBytes),
          diskUsedBytes: String(sample.diskUsedBytes),
          memoryTotalBytes: String(sample.memoryTotalBytes),
          memoryUsedBytes: String(sample.memoryUsedBytes),
          networkReceivedBytes: String(sample.networkReceivedBytes),
          networkTransmittedBytes: String(sample.networkTransmittedBytes),
          uptimeSeconds: String(sample.uptimeSeconds),
        },
        type: 'host.metric',
        version: 1,
      });
    }

    return createMetricIngestResponse(
      sample.collectedAt,
      receivedAt.toISOString(),
    );
  }
}
