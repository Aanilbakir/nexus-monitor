import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DashboardEventPublisher } from './dashboard-event.publisher.js';
import { DashboardQueryService } from './dashboard-query.service.js';

const CHECK_INTERVAL_MILLISECONDS = 5_000;

export class AvailabilityMonitor implements OnModuleDestroy, OnModuleInit {
  private previous = new Map<string, 'online' | 'offline'>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private checking = false;

  public constructor(
    private readonly queries: DashboardQueryService,
    private readonly events: DashboardEventPublisher,
  ) {}

  public async check(): Promise<void> {
    const snapshot = await this.queries.listHosts();
    const current = new Map<string, 'online' | 'offline'>();

    for (const host of snapshot.hosts) {
      current.set(host.id, host.availability);
      if (
        this.previous.get(host.id) === 'online' &&
        host.availability === 'offline'
      ) {
        this.events.publish({
          hostId: host.id,
          occurredAt: snapshot.generatedAt,
          payload: {
            availability: 'offline',
            lastSeenAt: host.lastSeenAt,
          },
          type: 'host.status',
          version: 1,
        });
      }
    }

    this.previous = current;
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    void this.runCheck();
    this.timer = setInterval(() => void this.runCheck(), CHECK_INTERVAL_MILLISECONDS);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public onModuleInit(): void {
    this.start();
  }

  public onModuleDestroy(): void {
    this.stop();
  }

  private async runCheck(): Promise<void> {
    if (this.checking) {
      return;
    }

    this.checking = true;
    try {
      await this.check();
    } catch (error) {
      console.error('Host availability check failed.', error);
    } finally {
      this.checking = false;
    }
  }
}

