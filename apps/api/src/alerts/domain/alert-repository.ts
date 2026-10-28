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

export interface ActiveAlertSummary {
  readonly acknowledgedAt: Date | null;
  readonly agentId: string;
  readonly dedupeKey: string;
  readonly id: string;
  readonly metric: string;
  readonly observedValue: number;
  readonly openedAt: Date;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: string;
  readonly state: AlertInstanceState;
}

export interface AlertRepository {
  acknowledge(id: string, at: Date): Promise<boolean>;
  findActive(dedupeKey: string): Promise<ActiveAlertInstance | null>;
  /** Only implemented by repositories backing the alerts query/acknowledge API. */
  findState?(id: string): Promise<AlertInstanceState | null>;
  /** Only implemented by repositories backing the alerts query/acknowledge API. */
  listActive?(): Promise<readonly ActiveAlertSummary[]>;
  openIfAbsent(
    input: OpenAlertInstanceInput,
  ): Promise<'already_active' | 'opened'>;
  resolve(id: string, at: Date): Promise<boolean>;
}

/** The subset of {@link AlertRepository} consumers that need to list and acknowledge alerts require. */
export type QueryableAlertRepository = AlertRepository &
  Required<Pick<AlertRepository, 'findState' | 'listActive'>>;
