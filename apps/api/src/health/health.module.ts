import { Module } from '@nestjs/common';

import { CLOCK, HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: CLOCK,
      useValue: () => new Date(),
    },
  ],
})
export class HealthModule {}
