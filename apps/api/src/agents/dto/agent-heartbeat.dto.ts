import type { AgentHeartbeatRequest } from '@nexus-monitor/contracts';
import { IsString, Length } from 'class-validator';

export class AgentHeartbeatDto implements AgentHeartbeatRequest {
  @IsString()
  @Length(1, 32)
  public architecture!: string;

  @IsString()
  @Length(1, 255)
  public hostname!: string;

  @IsString()
  @Length(1, 32)
  public platform!: string;
}
