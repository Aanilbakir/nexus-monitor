import { Module } from '@nestjs/common';

import { AgentsModule } from './agents/agents.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [AgentsModule, HealthModule],
})
export class AppModule {}
