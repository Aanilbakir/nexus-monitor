import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import type {
  DashboardFleetSnapshot,
  DashboardHistoryResponse,
  DashboardHost,
} from '@nexus-monitor/contracts';

import { HistoryQueryDto } from './dto/history-query.dto.js';
import { DashboardQueryService } from './domain/dashboard-query.service.js';

@Controller('dashboard/hosts')
export class DashboardController {
  public constructor(private readonly queries: DashboardQueryService) {}

  @Get()
  public listHosts(): Promise<DashboardFleetSnapshot> {
    return this.queries.listHosts();
  }

  @Get(':hostId/history')
  public async getHistory(
    @Param('hostId', new ParseUUIDPipe({ version: '4' })) hostId: string,
    @Query() query: HistoryQueryDto,
  ): Promise<DashboardHistoryResponse> {
    const history = await this.queries.getHistory(hostId, query.range);
    if (!history) {
      throw new NotFoundException('Host not found.');
    }

    return history;
  }

  @Get(':hostId')
  public async getHost(
    @Param('hostId', new ParseUUIDPipe({ version: '4' })) hostId: string,
  ): Promise<DashboardHost> {
    const host = await this.queries.getHost(hostId);
    if (!host) {
      throw new NotFoundException('Host not found.');
    }

    return host;
  }
}
