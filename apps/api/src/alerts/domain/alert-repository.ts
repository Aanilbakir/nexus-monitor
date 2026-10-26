export type AlertInstanceState = 'ACKNOWLEDGED' | 'OPEN' | 'RESOLVED';

export interface ActiveAlertInstance {
  readonly agentId: string;
  readonly dedupeKey: string;
  readonly id: string;
  readonly observedValue: number;
  readonly openedAt: Date;
  readonly ruleId: string;
  readonly state: AlertInstanceState;
}

export interface OpenAlertInstanceInput {
  readonly agentId: string;
  readonly dedupeKey: string;
  readonly id: string;
  readonly observedValue: number;
  readonly openedAt: Date;
  readonly ruleId: string;
}

export interface AlertRepository {
  acknowledge(id: string, at: Date): Promise<boolean>;
  findActive(dedupeKey: string): Promise<ActiveAlertInstance | null>;
  openIfAbsent(
    input: OpenAlertInstanceInput,
  ): Promise<'already_active' | 'opened'>;
  resolve(id: string, at: Date): Promise<boolean>;
}
