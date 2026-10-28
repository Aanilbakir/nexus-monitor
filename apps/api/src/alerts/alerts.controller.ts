import {
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { DashboardAlertInstance } from '@nexus-monitor/contracts';

import { DashboardAuthGuard } from '../dashboard/infrastructure/dashboard-api-key.guard.js';
import { AlertsQueryService } from './domain/alerts-query.service.js';
import type { ActiveAlertSummary } from './domain/alert-repository.js';

export interface ActiveAlertsResponse {
  readonly alerts: readonly DashboardAlertInstance[];
}

export interface AcknowledgeAlertResponse {
  readonly acknowledgedAt: string;
  readonly id: string;
  readonly state: 'ACKNOWLEDGED';
}

@Controller('alerts')
@UseGuards(DashboardAuthGuard)
export class AlertsController {
  public constructor(private readonly queries: AlertsQueryService) {}

  @Get()
  public async list(): Promise<ActiveAlertsResponse> {
    const alerts = await this.queries.listActive();
    return { alerts: alerts.map(toDashboardAlertInstance) };
  }

  @Post(':id/acknowledge')
  public async acknowledge(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AcknowledgeAlertResponse> {
    const result = await this.queries.acknowledge(id);

    if (result.outcome === 'not_found') {
      throw new NotFoundException('Alert not found.');
    }
    if (result.outcome === 'conflict') {
      throw new ConflictException('Alert can no longer be acknowledged.');
    }

    return {
      acknowledgedAt: result.at.toISOString(),
      id,
      state: 'ACKNOWLEDGED',
    };
  }
}

function toDashboardAlertInstance(
  alert: ActiveAlertSummary,
): DashboardAlertInstance {
  return {
    acknowledgedAt: alert.acknowledgedAt
      ? alert.acknowledgedAt.toISOString()
      : null,
    agentId: alert.agentId,
    id: alert.id,
    metric: alert.metric,
    observedValue: alert.observedValue,
    openedAt: alert.openedAt.toISOString(),
    ruleId: alert.ruleId,
    ruleName: alert.ruleName,
    severity: alert.severity,
    state: alert.state,
  };
}
