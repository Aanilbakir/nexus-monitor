import { UnauthorizedAgentError } from './domain/agent.service.js';

export function parseBearerToken(header: string | undefined): string {
  const match = /^Bearer ([^\s]+)$/.exec(header ?? '');

  if (!match?.[1]) {
    throw new UnauthorizedAgentError();
  }

  return match[1];
}
