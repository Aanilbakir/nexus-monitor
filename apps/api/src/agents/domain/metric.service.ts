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
  findCredentialHash(agentId: string): Promise<string | null>;
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
  ) {}

  public async ingest(
    agentId: string,
    agentToken: string,
    sample: SystemMetricSample,
  ): Promise<SystemMetricIngestResponse> {
    const credentialHash = await this.repository.findCredentialHash(agentId);
    if (
      !credentialHash ||
      !this.credentials.verifyAgentToken(agentToken, credentialHash)
    ) {
      throw new UnauthorizedAgentError();
    }

    const receivedAt = this.clock();
    if (!validateSystemMetricSample(sample, receivedAt).valid) {
      throw new InvalidMetricSampleError();
    }

    await this.repository.insert({
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

    return createMetricIngestResponse(
      sample.collectedAt,
      receivedAt.toISOString(),
    );
  }
}
