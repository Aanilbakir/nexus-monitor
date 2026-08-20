import { validate } from 'class-validator';

import { AgentRegistrationDto } from './dto/agent-registration.dto.js';
import { parseBearerToken } from './transport.js';

describe('agent transport boundary', () => {
  it('accepts a valid registration payload', async () => {
    const dto = Object.assign(new AgentRegistrationDto(), {
      agentId: '11111111-1111-4111-8111-111111111111',
      agentVersion: '0.1.0',
      architecture: 'x64',
      hostId: '22222222-2222-4222-8222-222222222222',
      hostname: 'nexus-node',
      platform: 'win32',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects malformed identity and oversized metadata', async () => {
    const dto = Object.assign(new AgentRegistrationDto(), {
      agentId: 'not-a-uuid',
      agentVersion: 'x'.repeat(33),
      architecture: '',
      hostId: 'not-a-uuid',
      hostname: 'x'.repeat(256),
      platform: '',
    });

    expect(await validate(dto)).toHaveLength(6);
  });

  it('extracts only a non-empty Bearer credential', () => {
    expect(parseBearerToken('Bearer agent-secret')).toBe('agent-secret');
    expect(() => parseBearerToken('Basic agent-secret')).toThrow(
      'Agent authentication failed.',
    );
    expect(() => parseBearerToken('Bearer ')).toThrow(
      'Agent authentication failed.',
    );
  });
});
