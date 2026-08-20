import { BadRequestException, UnauthorizedException } from '@nestjs/common';

import { AgentsController } from './agents.controller.js';
import type { AgentService } from './domain/agent.service.js';
import { UnauthorizedAgentError } from './domain/agent.service.js';
import type { MetricService } from './domain/metric.service.js';
import { InvalidMetricSampleError } from './domain/metric.service.js';
import type { SystemMetricSampleDto } from './dto/system-metric-sample.dto.js';

const agentId = '11111111-1111-4111-8111-111111111111';
const sample: SystemMetricSampleDto = {
  collectedAt: '2026-08-21T09:59:59.000Z',
  cpuPercent: 25,
  diskFreeBytes: 400,
  diskTotalBytes: 1_000,
  diskUsedBytes: 500,
  memoryTotalBytes: 1_000,
  memoryUsedBytes: 600,
  networkReceivedBytes: 2_000,
  networkTransmittedBytes: 1_500,
  uptimeSeconds: 3_600,
};

describe('AgentsController metrics', () => {
  it('returns the accepted metric response', async () => {
    const response = {
      collectedAt: sample.collectedAt,
      metricsIntervalSeconds: 15 as const,
      receivedAt: '2026-08-21T10:00:00.000Z',
    };
    const metrics = {
      ingest: () => Promise.resolve(response),
    } as unknown as MetricService;
    const controller = new AgentsController({} as AgentService, metrics);

    await expect(
      controller.metrics(agentId, 'Bearer agent-secret', sample),
    ).resolves.toEqual(response);
  });

  it('maps authentication failure to generic unauthorized response', async () => {
    const metrics = {
      ingest: () => Promise.reject(new UnauthorizedAgentError()),
    } as unknown as MetricService;
    const controller = new AgentsController({} as AgentService, metrics);

    await expect(
      controller.metrics(agentId, 'Bearer wrong', sample),
    ).rejects.toEqual(
      new UnauthorizedException('Agent authentication failed.'),
    );
  });

  it('maps invalid samples to a bounded bad request response', async () => {
    const metrics = {
      ingest: () => Promise.reject(new InvalidMetricSampleError()),
    } as unknown as MetricService;
    const controller = new AgentsController({} as AgentService, metrics);

    await expect(
      controller.metrics(agentId, 'Bearer agent-secret', sample),
    ).rejects.toEqual(
      new BadRequestException('System metric sample is invalid.'),
    );
  });
});
