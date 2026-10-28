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

export interface MetricAlertHookInput {
  readonly agentId: string;
  readonly collectedAt: Date;
  readonly hostId: string;
  readonly metrics: Readonly<Record<string, number>>;
  readonly receivedAt: Date;
}

/** Narrow post-ingestion hook so `MetricService` stays decoupled from the alerts module. */
export interface MetricAlertHook {
  afterInsert(input: MetricAlertHookInput): Promise<void>;
}

/**
 * DI token for {@link MetricAlertHook}. Declared here (the consuming domain)
 * rather than in `agents.module.ts` so `AlertsModule` can bind it without
 * importing back from `agents.module.ts`, which would create a circular
 * module import now that `AgentsModule` imports `AlertsModule` for this hook.
 */
export const METRIC_ALERT_HOOK = Symbol('METRIC_ALERT_HOOK');

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
    private readonly alertHook?: MetricAlertHook,
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

      if (this.alertHook) {
        try {
          await this.alertHook.afterInsert({
            agentId,
            collectedAt: new Date(sample.collectedAt),
            hostId: identity.hostId,
            metrics: {
              cpuPercent: sample.cpuPercent,
              diskUsedPercent: percentOf(
                sample.diskUsedBytes,
                sample.diskTotalBytes,
              ),
              memoryUsedPercent: percentOf(
                sample.memoryUsedBytes,
                sample.memoryTotalBytes,
              ),
            },
            receivedAt,
          });
        } catch (error) {
          console.error(`Alert hook failed for agent ${agentId}.`, error);
        }
      }
    }

    return createMetricIngestResponse(
      sample.collectedAt,
      receivedAt.toISOString(),
    );
  }
}

function percentOf(used: number, total: number): number {
  return total === 0 ? 0 : (used / total) * 100;
}
