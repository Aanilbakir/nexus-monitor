import { Controller, Get, Inject } from '@nestjs/common';
import {
  createServiceHealth,
  type ServiceHealth,
} from '@nexus-monitor/contracts';

export type Clock = () => Date;

export const CLOCK = Symbol('CLOCK');

@Controller('health')
export class HealthController {
  public constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  @Get()
  public getHealth(): ServiceHealth {
    return createServiceHealth('api', this.clock().toISOString());
  }
}
