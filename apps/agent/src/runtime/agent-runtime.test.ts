import type { AgentState, AgentStateStore } from '../identity/agent-state.js';
import { AgentRuntime, type AgentApiClient } from './agent-runtime.js';

describe('AgentRuntime', () => {
  const identity = {
    agentId: '11111111-1111-4111-8111-111111111111',
    hostId: '22222222-2222-4222-8222-222222222222',
  };
  const metadata = {
    architecture: 'x64',
    hostname: 'workstation',
    platform: 'win32',
  };

  it('enrolls, persists credentials, and starts heartbeats', async () => {
    let stored: AgentState | null = null;
    const read = jest.fn<Promise<AgentState | null>, []>(() =>
      Promise.resolve(stored),
    );
    const write = jest.fn<Promise<void>, [AgentState]>((state) => {
      stored = state;
      return Promise.resolve();
    });
    const heartbeat = jest.fn<
      Promise<void>,
      Parameters<AgentApiClient['heartbeat']>
    >(() => Promise.resolve());
    const register = jest.fn<
      ReturnType<AgentApiClient['register']>,
      Parameters<AgentApiClient['register']>
    >(() => Promise.resolve({ agentToken: 'agent-secret' }));
    const store: AgentStateStore = {
      read,
      write,
    };
    const client: AgentApiClient = { heartbeat, register };
    let scheduled: (() => Promise<void>) | undefined;
    const runtime = new AgentRuntime(
      store,
      client,
      (task) => {
        scheduled = task;
      },
      () => identity,
    );

    await runtime.start(metadata, '0.1.0', 'enrollment-secret');

    expect(register).toHaveBeenCalledWith(
      identity,
      metadata,
      '0.1.0',
      'enrollment-secret',
    );
    expect(write).toHaveBeenCalledWith({
      ...identity,
      agentToken: 'agent-secret',
    });
    expect(heartbeat).toHaveBeenCalledTimes(1);
    await scheduled?.();
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it('reuses persisted credentials without registering again', async () => {
    const state = { ...identity, agentToken: 'agent-secret' };
    const heartbeat = jest.fn<
      Promise<void>,
      Parameters<AgentApiClient['heartbeat']>
    >(() => Promise.resolve());
    const register = jest.fn<
      ReturnType<AgentApiClient['register']>,
      Parameters<AgentApiClient['register']>
    >();
    const store: AgentStateStore = {
      read: jest.fn(() => Promise.resolve(state)),
      write: jest.fn(() => Promise.resolve()),
    };
    const client: AgentApiClient = { heartbeat, register };
    const runtime = new AgentRuntime(
      store,
      client,
      () => undefined,
      () => identity,
    );

    await runtime.start(metadata, '0.1.0', 'enrollment-secret');

    expect(register).not.toHaveBeenCalled();
    expect(heartbeat).toHaveBeenCalledWith(
      state.agentId,
      state.agentToken,
      metadata,
    );
  });
});
