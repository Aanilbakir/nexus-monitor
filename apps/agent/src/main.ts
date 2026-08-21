import { arch, hostname, platform } from 'node:os';

import { AgentClient } from './client/agent-client.js';
import { readAgentEnvironment } from './config/environment.js';
import { FileAgentStateStore } from './identity/agent-state.js';
import { SystemInformationProvider } from './metrics/system-information-provider.js';
import { NodeSystemMetricsCollector } from './metrics/system-metrics-collector.js';
import { AgentRuntime } from './runtime/agent-runtime.js';
import { MetricsRuntime } from './runtime/metrics-runtime.js';

const environment = readAgentEnvironment(process.env);
const client = new AgentClient(environment.apiUrl);
const runtime = new AgentRuntime(
  new FileAgentStateStore(environment.statePath),
  client,
);

const state = await runtime.start(
  {
    architecture: arch(),
    hostname: hostname(),
    platform: platform(),
  },
  environment.agentVersion,
  environment.enrollmentToken,
);

await new MetricsRuntime(
  new NodeSystemMetricsCollector(new SystemInformationProvider()),
  client,
).start(state.agentId, state.agentToken);
