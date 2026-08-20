import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AgentHeartbeatResponse,
  AgentRegistrationResponse,
  SystemMetricIngestResponse,
} from '@nexus-monitor/contracts';

import {
  AgentService,
  UnauthorizedAgentError,
} from './domain/agent.service.js';
import { AgentHeartbeatDto } from './dto/agent-heartbeat.dto.js';
import { AgentRegistrationDto } from './dto/agent-registration.dto.js';
import {
  InvalidMetricSampleError,
  MetricService,
} from './domain/metric.service.js';
import { SystemMetricSampleDto } from './dto/system-metric-sample.dto.js';
import { parseBearerToken } from './transport.js';

@Controller('agents')
export class AgentsController {
  public constructor(
    private readonly agents: AgentService,
    private readonly metricService: MetricService,
  ) {}

  @Post('register')
  public async register(
    @Headers('authorization') authorization: string | undefined,
    @Body() request: AgentRegistrationDto,
  ): Promise<AgentRegistrationResponse> {
    try {
      return await this.agents.register(
        request,
        parseBearerToken(authorization),
      );
    } catch (error) {
      this.rethrowAuthenticationFailure(error);
    }
  }

  @Post(':agentId/heartbeat')
  @HttpCode(200)
  public async heartbeat(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() request: AgentHeartbeatDto,
  ): Promise<AgentHeartbeatResponse> {
    try {
      return await this.agents.heartbeat(
        agentId,
        parseBearerToken(authorization),
        request,
      );
    } catch (error) {
      this.rethrowAuthenticationFailure(error);
    }
  }

  @Post(':agentId/metrics')
  @HttpCode(200)
  public async metrics(
    @Param('agentId', new ParseUUIDPipe({ version: '4' })) agentId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() request: SystemMetricSampleDto,
  ): Promise<SystemMetricIngestResponse> {
    try {
      return await this.metricService.ingest(
        agentId,
        parseBearerToken(authorization),
        request,
      );
    } catch (error) {
      if (error instanceof InvalidMetricSampleError) {
        throw new BadRequestException('System metric sample is invalid.');
      }
      this.rethrowAuthenticationFailure(error);
    }
  }

  private rethrowAuthenticationFailure(error: unknown): never {
    if (error instanceof UnauthorizedAgentError) {
      throw new UnauthorizedException('Agent authentication failed.');
    }

    throw error;
  }
}
