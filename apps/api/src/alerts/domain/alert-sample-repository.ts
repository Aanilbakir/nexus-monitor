export interface AlertSampleWindowEntry {
  readonly collectedAt: Date;
  readonly value: number;
}

export interface AlertSampleRepository {
  findRecentSamples(
    agentId: string,
    metric: string,
    windowStart: Date,
  ): Promise<readonly AlertSampleWindowEntry[]>;
}
