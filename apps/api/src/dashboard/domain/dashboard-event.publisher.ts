import type { DashboardEvent } from '@nexus-monitor/contracts';

export type DashboardEventListener = (event: DashboardEvent) => void;
export type DashboardListenerErrorHandler = (error: unknown) => void;

export class DashboardEventPublisher {
  private readonly listeners = new Set<DashboardEventListener>();

  public constructor(
    private readonly onListenerError: DashboardListenerErrorHandler = defaultListenerErrorHandler,
  ) {}

  public publish(event: DashboardEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.onListenerError(error);
      }
    }
  }

  public subscribe(listener: DashboardEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

function defaultListenerErrorHandler(error: unknown): void {
  console.error('Dashboard event subscriber failed.', error);
}
