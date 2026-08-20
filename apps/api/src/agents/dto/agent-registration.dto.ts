import type { AgentRegistrationRequest } from '@nexus-monitor/contracts';
import { IsString, IsUUID, Length } from 'class-validator';

export class AgentRegistrationDto implements AgentRegistrationRequest {
  @IsUUID('4')
  public agentId!: string;

  @IsString()
  @Length(1, 32)
  public agentVersion!: string;

  @IsString()
  @Length(1, 32)
  public architecture!: string;

  @IsUUID('4')
  public hostId!: string;

  @IsString()
  @Length(1, 255)
  public hostname!: string;

  @IsString()
  @Length(1, 32)
  public platform!: string;
}
