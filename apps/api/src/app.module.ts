import { Module } from '@nestjs/common';

import { AgentsModule } from './agents/agents.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [AgentsModule, DashboardModule, HealthModule],
})
export class AppModule {}
