import type { AgentRegistrationRequest } from '@nexus-monitor/contracts';

import {
  AgentService,
  type AgentRepository,
  UnauthorizedAgentError,
} from './agent.service.js';
import { CredentialService } from './credential.service.js';
import { DashboardEventPublisher } from '../../dashboard/domain/dashboard-event.publisher.js';

const registration: AgentRegistrationRequest = {
  agentId: '11111111-1111-4111-8111-111111111111',
  agentVersion: '0.1.0',
  architecture: 'x64',
  hostId: '22222222-2222-4222-8222-222222222222',
  hostname: 'nexus-node',
  platform: 'win32',
};

class InMemoryAgentRepository implements AgentRepository {
  public credentialHash: string | null = null;
  public heartbeatAt: Date | null = null;

  public enroll(input: { readonly credentialHash: string }): Promise<void> {
    this.credentialHash = input.credentialHash;
    return Promise.resolve();
  }

  public findCredentialHash(): Promise<string | null> {
    return Promise.resolve(this.credentialHash);
  }

  public recordHeartbeat(input: { readonly receivedAt: Date }): Promise<string> {
    this.heartbeatAt = input.receivedAt;
    return Promise.resolve(registration.hostId);
  }
}

describe('AgentService', () => {
  const now = new Date('2026-08-21T00:00:00.000Z');

  it('enrolls an agent and persists only its credential hash', async () => {
    const repository = new InMemoryAgentRepository();
    const credentials = new CredentialService('enrollment-secret', () =>
      Buffer.alloc(32, 7),
    );
    const service = new AgentService(repository, credentials, () => now);

    const response = await service.register(registration, 'enrollment-secret');

    expect(response.agentToken).toBe(
      'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc',
    );
    expect(repository.credentialHash).toBe(
      credentials.hash(response.agentToken),
    );
    expect(repository.credentialHash).not.toBe(response.agentToken);
  });

  it('rejects an invalid enrollment token', async () => {
    const service = new AgentService(
      new InMemoryAgentRepository(),
      new CredentialService('enrollment-secret'),
      () => now,
    );

    await expect(
      service.register(registration, 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedAgentError);
  });

  it('records a heartbeat authenticated by the agent credential', async () => {
    const repository = new InMemoryAgentRepository();
    const credentials = new CredentialService('enrollment-secret', () =>
      Buffer.alloc(32, 7),
    );
    const service = new AgentService(repository, credentials, () => now);
    const registered = await service.register(
      registration,
      'enrollment-secret',
    );

    const response = await service.heartbeat(
      registration.agentId,
      registered.agentToken,
      registration,
    );

    expect(response.receivedAt).toBe('2026-08-21T00:00:00.000Z');
    expect(repository.heartbeatAt).toEqual(now);
  });

  it('publishes the persisted heartbeat as an online host event', async () => {
    const repository = new InMemoryAgentRepository();
    const credentials = new CredentialService('enrollment-secret');
    repository.credentialHash = credentials.hash('agent-secret');
    const publisher = new DashboardEventPublisher();
    const events: unknown[] = [];
    publisher.subscribe((event) => events.push(event));
    const service = new AgentService(repository, credentials, () => now, publisher);

    await service.heartbeat(registration.agentId, 'agent-secret', registration);

    expect(events).toEqual([
      {
        hostId: registration.hostId,
        occurredAt: now.toISOString(),
        payload: { availability: 'online', lastSeenAt: now.toISOString() },
        type: 'host.status',
        version: 1,
      },
    ]);
  });

  it('rejects an invalid agent credential', async () => {
    const repository = new InMemoryAgentRepository();
    repository.credentialHash = '0'.repeat(64);
    const service = new AgentService(
      repository,
      new CredentialService('enrollment-secret'),
      () => now,
    );

    await expect(
      service.heartbeat(registration.agentId, 'wrong', registration),
    ).rejects.toBeInstanceOf(UnauthorizedAgentError);
  });
});
