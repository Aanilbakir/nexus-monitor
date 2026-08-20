import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAgentIdentity, FileAgentStateStore } from './agent-state.js';

describe('agent state', () => {
  it('creates stable identifiers', () => {
    const values = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];

    expect(createAgentIdentity(() => values.shift()!)).toEqual({
      agentId: '11111111-1111-4111-8111-111111111111',
      hostId: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('persists and reloads enrolled state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nexus-agent-'));
    const path = join(directory, 'state', 'agent.json');
    const store = new FileAgentStateStore(path);
    const state = {
      agentId: '11111111-1111-4111-8111-111111111111',
      agentToken: 'agent-secret',
      hostId: '22222222-2222-4222-8222-222222222222',
    };

    await expect(store.read()).resolves.toBeNull();
    await store.write(state);
    await expect(store.read()).resolves.toEqual(state);
    await expect(readFile(path, 'utf8')).resolves.toContain('agent-secret');
  });
});
