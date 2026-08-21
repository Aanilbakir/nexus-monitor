# NEXUS Monitor

NEXUS Monitor is an open-source system monitoring and observability platform for local and remote machines, services, applications, and infrastructure. It is designed as a serious developer tool with explicit boundaries between collection, ingestion, persistence, realtime delivery, presentation, and alert evaluation.

> [!IMPORTANT]
> The repository is currently at Phase 3. Agents can enroll, report availability, send machine-wide system metrics, and publish persisted host changes to the live dashboard.

## Screenshots

The dashboard is a responsive EN/TR command console with a host fleet sidebar, honest connection state, and current system telemetry. Repository screenshots remain part of the Phase 8 public-release polish.

## Architecture

```text
Monitoring Agent  ->  NestJS API  ->  PostgreSQL
                           |
                           +------> REST snapshot + SSE
                                      |
                                      v
                                React dashboard
```

The agent, API, persistence layer, realtime transport, dashboard, and alert logic remain separate system boundaries. Applications cannot import another application's internal modules. Shared network and event shapes belong in `packages/contracts`.

## Planned capabilities

- CPU, memory, disk, network, uptime, and operating system monitoring
- Local and remote host status
- Process and service health visibility
- Historical metrics and time-range queries
- Realtime dashboard updates
- Threshold and heartbeat alerts
- System events and health timelines
- Extensible foundations for containers, databases, API checks, logs, and incident analysis

## Technology

- Node.js 24 and strict TypeScript
- NestJS API
- React 19 and Vite dashboard
- Independent Node.js monitoring agent
- Cross-platform system collection through systeminformation
- Prisma and PostgreSQL
- Jest and Vitest
- pnpm workspaces
- Docker Compose
- GitHub Actions

## Requirements

- Node.js 24 or newer
- pnpm 11 or newer
- Docker with Compose support for local PostgreSQL

## Local installation

```bash
git clone <repository-url>
cd nexus-monitor
pnpm install
```

Copy `.env.example` to `.env`, then replace the example database password and enrollment token. The API and agent must use the same `AGENT_ENROLLMENT_TOKEN` for first enrollment.

```bash
docker compose up -d postgres
pnpm prisma:validate
pnpm prisma:generate
pnpm exec prisma migrate deploy
```

## Development

Run all development processes:

```bash
pnpm dev
```

Or run a single boundary:

```bash
pnpm --filter @nexus-monitor/api dev
pnpm --filter @nexus-monitor/web dev
pnpm --filter @nexus-monitor/agent dev
```

The agent requires `AGENT_ENROLLMENT_TOKEN`, `NEXUS_AGENT_STATE_PATH`, and `NEXUS_API_URL`. On first start it creates stable UUIDs, enrolls through `POST /api/v1/agents/register`, stores its issued credential locally, and sends authenticated heartbeats every 15 seconds. The API considers an agent offline after 45 seconds without a heartbeat.

After priming its CPU baseline, the agent also sends one combined metric sample every 15 seconds. Samples contain machine-wide CPU percentage; total and used memory; total, used, and free fixed-disk bytes; cumulative received and transmitted network bytes; uptime; and collection time. File contents, usernames, IP addresses, and process lists are not collected in Phase 2. Metric collection and heartbeat delivery use independent schedules.

The API exposes `GET /api/v1/health`, `POST /api/v1/agents/register`, `POST /api/v1/agents/:agentId/heartbeat`, `POST /api/v1/agents/:agentId/metrics`, `GET /api/v1/dashboard/hosts`, and `GET /api/v1/dashboard/events`. Enrollment rotates the agent credential; only its SHA-256 hash is stored in PostgreSQL. Metric samples use the same per-agent bearer credential and duplicate timestamps are idempotent.

The dashboard fetches a persisted fleet snapshot, then consumes Server-Sent Events for metric and availability changes. During local development, Vite proxies `/api` to `http://127.0.0.1:3000`. Production deployments should serve the dashboard and API from the same origin or provide an equivalent reverse proxy. Phase 3 assumes a trusted local or self-hosted network; dashboard authentication is scheduled for production hardening.

## Quality commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
```

## Repository structure

```text
apps/
  agent/       Independent monitoring agent runtime
  api/         NestJS API and realtime boundary
  web/         React dashboard
packages/
  contracts/   Framework-neutral shared contracts
prisma/        PostgreSQL schema and generated client target
docs/
  reports/     Completed phase reports
  superpowers/ Approved designs and implementation plans
.github/       CI, dependency updates, and contribution templates
```

## Roadmap

- Phase 0: repository and runtime foundation (complete)
- Phase 1: host registration and heartbeat (complete)
- Phase 2: core system metrics (complete)
- Phase 3: realtime dashboard (complete)
- Phase 4: historical metrics and charts
- Phase 5: alerting
- Phase 6: processes and system events
- Phase 7: production hardening
- Phase 8: public release polish

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for phase goals and exit criteria.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

NEXUS Monitor is available under the [MIT License](LICENSE).
