import type { Clock } from '../../agents/domain/agent.service.js';
import type {
  ActiveAlertSummary,
  QueryableAlertRepository,
} from './alert-repository.js';

export type AcknowledgeOutcome =
  | { readonly outcome: 'conflict' }
  | { readonly outcome: 'not_found' }
  | { readonly at: Date; readonly outcome: 'acknowledged' };

export class AlertsQueryService {
  public constructor(
    private readonly repository: QueryableAlertRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  public async listActive(): Promise<readonly ActiveAlertSummary[]> {
    const alerts = await this.repository.listActive();
    return [...alerts].sort(
      (left, right) => right.openedAt.getTime() - left.openedAt.getTime(),
    );
  }

  public async acknowledge(id: string): Promise<AcknowledgeOutcome> {
    const state = await this.repository.findState(id);
    if (!state) {
      return { outcome: 'not_found' };
    }
    if (state !== 'OPEN') {
      return { outcome: 'conflict' };
    }

    const at = this.clock();
    const acknowledged = await this.repository.acknowledge(id, at);
    if (!acknowledged) {
      return { outcome: 'conflict' };
    }

    return { at, outcome: 'acknowledged' };
  }
}
