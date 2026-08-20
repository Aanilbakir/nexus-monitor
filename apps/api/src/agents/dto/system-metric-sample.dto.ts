import type { SystemMetricSample } from '@nexus-monitor/contracts';
import {
  IsISO8601,
  IsInt,
  IsNumber,
  Max,
  Min,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';

export class SystemMetricSampleDto implements SystemMetricSample {
  @IsISO8601({ strict: true, strictSeparator: true })
  public collectedAt!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  public cpuPercent!: number;

  @SafeCounter()
  public diskFreeBytes!: number;

  @SafeCounter()
  public diskTotalBytes!: number;

  @SafeCounter()
  @ConsistentTotal('diskTotalBytes', 'diskFreeBytes')
  public diskUsedBytes!: number;

  @SafeCounter()
  public memoryTotalBytes!: number;

  @SafeCounter()
  @ConsistentTotal('memoryTotalBytes')
  public memoryUsedBytes!: number;

  @SafeCounter()
  public networkReceivedBytes!: number;

  @SafeCounter()
  public networkTransmittedBytes!: number;

  @SafeCounter()
  public uptimeSeconds!: number;
}

function SafeCounter(): PropertyDecorator {
  return function applySafeCounter(target, propertyKey): void {
    IsInt()(target, propertyKey);
    Min(0)(target, propertyKey);
    Max(Number.MAX_SAFE_INTEGER)(target, propertyKey);
  };
}

function ConsistentTotal(
  totalProperty: keyof SystemMetricSampleDto,
  additionalProperty?: keyof SystemMetricSampleDto,
): PropertyDecorator {
  return function applyConsistentTotal(target, propertyKey): void {
    registerDecorator({
      constraints: [totalProperty, additionalProperty],
      name: 'consistentTotal',
      propertyName: String(propertyKey),
      target: target.constructor,
      validator: {
        validate(value: unknown, arguments_: ValidationArguments): boolean {
          if (typeof value !== 'number') return false;
          const object = arguments_.object as Record<string, unknown>;
          const total = object[String(totalProperty)];
          const additional = additionalProperty
            ? object[String(additionalProperty)]
            : 0;
          return (
            typeof total === 'number' &&
            typeof additional === 'number' &&
            value + additional <= total
          );
        },
      },
    });
  };
}
