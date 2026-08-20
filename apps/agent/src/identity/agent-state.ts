import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface AgentIdentity {
  readonly agentId: string;
  readonly hostId: string;
}

export interface AgentState extends AgentIdentity {
  readonly agentToken: string;
}

export interface AgentStateStore {
  read(): Promise<AgentState | null>;
  write(state: AgentState): Promise<void>;
}

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAgentIdentity(
  generateId: () => string = randomUUID,
): AgentIdentity {
  return { agentId: generateId(), hostId: generateId() };
}

export class FileAgentStateStore implements AgentStateStore {
  constructor(private readonly path: string) {}

  async read(): Promise<AgentState | null> {
    let contents: string;

    try {
      contents = await readFile(this.path, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }

    const state: unknown = JSON.parse(contents);
    if (!isAgentState(state)) {
      throw new Error('Agent state file is invalid.');
    }

    return state;
  }

  async write(state: AgentState): Promise<void> {
    const directory = dirname(this.path);
    const temporaryPath = `${this.path}.tmp`;
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, this.path);
  }
}

function isAgentState(value: unknown): value is AgentState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.agentId === 'string' &&
    UUID_V4.test(state.agentId) &&
    typeof state.hostId === 'string' &&
    UUID_V4.test(state.hostId) &&
    typeof state.agentToken === 'string' &&
    state.agentToken.length > 0
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
