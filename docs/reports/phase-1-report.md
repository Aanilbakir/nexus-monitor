# Phase 1 Report

## Outcome

Phase 1 adds stable host and agent identities, authenticated enrollment, credential rotation, persisted heartbeats, and backend-derived online/offline status. The agent enrolls once, stores its issued credential locally, sends an immediate heartbeat, and continues every 15 seconds.

## Security model

- Initial enrollment requires the shared `AGENT_ENROLLMENT_TOKEN`.
- The API generates a random per-agent credential and returns it only during enrollment.
- PostgreSQL stores only the SHA-256 credential hash.
- Re-enrollment rotates the per-agent credential.
- Heartbeat authentication uses constant-time hash comparison.
- Authentication failures return a generic error and do not expose credentials.

## Persistence

The Prisma schema and migration add `Host`, `Agent`, and `Heartbeat` tables. Heartbeats update mutable host metadata and the agent's `lastSeenAt` value in the same transaction before appending the heartbeat record. Indexes support host lookup and recent-heartbeat queries.

## Agent runtime

The agent creates UUIDv4 host and agent identifiers on first start. Its local JSON state is written through a temporary file and atomic rename with restricted file permissions where supported. Subsequent starts reuse the stored identity and credential without enrolling again.

## API

- `POST /api/v1/agents/register`
- `POST /api/v1/agents/:agentId/heartbeat`
- `GET /api/v1/health`

Request DTOs reject unknown properties and enforce UUID and string bounds. An agent is online through the exact 45-second boundary and offline after it.

## Verification

Fresh verification on 2026-08-21 passed:

- frozen-lockfile dependency installation
- Prisma client generation, formatting, and schema validation
- Prettier formatting check
- ESLint with zero warnings
- strict TypeScript checks for every workspace
- 32 automated tests across 13 suites
- production builds for the API, agent, contracts, database package, and web application
- Docker Compose configuration validation

The Docker CLI is installed, but this execution environment denies access to the local Docker engine and its user configuration. The PostgreSQL-backed runtime lifecycle could therefore not be executed against a live container here. Lifecycle behavior is covered at the service boundary and the Prisma repository passes strict type checking and production compilation; the limitation is not represented as a passing database integration test.

## GitHub readiness

CI now generates the ignored Prisma client before linting, type checking, testing, and building. Environment examples document enrollment and agent state configuration without including usable secrets. No GitHub push was performed during this phase.
