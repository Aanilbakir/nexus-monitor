import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import type {
  DashboardFleetSnapshot,
  DashboardHost,
} from '@nexus-monitor/contracts';

import { DashboardQueryService } from './domain/dashboard-query.service.js';

@Controller('dashboard/hosts')
export class DashboardController {
  public constructor(private readonly queries: DashboardQueryService) {}

  @Get()
  public listHosts(): Promise<DashboardFleetSnapshot> {
    return this.queries.listHosts();
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
