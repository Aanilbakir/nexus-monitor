import { arch, hostname, platform } from 'node:os';

import { AgentClient } from './client/agent-client.js';
import { readAgentEnvironment } from './config/environment.js';
import { FileAgentStateStore } from './identity/agent-state.js';
import { AgentRuntime } from './runtime/agent-runtime.js';

const environment = readAgentEnvironment(process.env);
const runtime = new AgentRuntime(
  new FileAgentStateStore(environment.statePath),
  new AgentClient(environment.apiUrl),
);

await runtime.start(
  {
    architecture: arch(),
    hostname: hostname(),
    platform: platform(),
  },
  environment.agentVersion,
  environment.enrollmentToken,
);
