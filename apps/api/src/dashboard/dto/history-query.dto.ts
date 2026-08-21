import { HISTORY_RANGES, type HistoryRange } from '@nexus-monitor/contracts';
import { IsIn } from 'class-validator';

export class HistoryQueryDto {
  @IsIn(HISTORY_RANGES)
  public range!: HistoryRange;
}
