import { readAgentEnvironment } from './config/environment.js';
import { createAgentReadiness } from './readiness.js';

const environment = readAgentEnvironment(process.env);
const readiness = createAgentReadiness(
  environment.agentId,
  new Date().toISOString(),
);

process.stdout.write(`${JSON.stringify(readiness)}\n`);
