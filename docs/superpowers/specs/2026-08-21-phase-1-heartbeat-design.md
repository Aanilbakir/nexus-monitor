# NEXUS Monitor Phase 1 Host Registration and Heartbeat Design

## Objective

Phase 1 establishes trustworthy host and agent identity, authenticated enrollment, recurring heartbeat ingestion, persistence, and backend-derived online/offline status. It does not collect CPU, memory, disk, network, process, or service metrics and does not add dashboard host views.

## Identity model

A monitored installation owns two stable UUIDs: `hostId` identifies the machine record and `agentId` identifies the installed collector. The agent creates these values once and stores them in a local state file. Hostname and operating system fields are mutable metadata, never identity.

Reinstalling without the state file creates a new host and agent. Account recovery, host merging, and identity transfer are deferred because silently guessing identity from hostname or hardware fingerprints would be unreliable and privacy-sensitive.

## Enrollment and authentication

Initial enrollment calls `POST /api/v1/agents/register` with an operator-provided enrollment token, agent and host UUIDs, hostname, platform, architecture, and agent version. The API compares the enrollment token in constant time against `AGENT_ENROLLMENT_TOKEN`, upserts the host and agent identities, creates a cryptographically random agent secret, and stores only its SHA-256 hash.

The plaintext agent secret is returned once. The agent writes it to its state file. Subsequent heartbeat requests use `Authorization: Bearer <agent-secret>`. Re-enrollment rotates the agent secret and invalidates the previous value. Development does not provide an unauthenticated mode.

## Heartbeat flow

The agent sends `POST /api/v1/agents/:agentId/heartbeat` every 15 seconds. A valid heartbeat updates `Agent.lastSeenAt`, updates mutable host metadata supplied by that authenticated agent, and creates a `Heartbeat` audit row. The API returns the server timestamp and the next heartbeat interval.

An agent is online when its latest accepted heartbeat is no older than 45 seconds at evaluation time. This calculation lives in a pure backend domain function and is not persisted as a mutable boolean. Future alerting can consume the same function.

## Persistence

`Host` stores stable identity and current non-sensitive metadata. `Agent` belongs to one host, stores credential hash and last-seen timestamps, and records enrollment/rotation time. `Heartbeat` is append-only and belongs to an agent. Foreign keys cascade from Host to Agent and Agent to Heartbeat. Indexes support host-agent lookup and recent heartbeat queries.

## Contracts and validation

Framework-neutral request and response types live in `@nexus-monitor/contracts`. NestJS DTOs implement runtime validation with `class-validator`; shared TypeScript interfaces alone are not treated as runtime validation. UUIDs, lengths, enums, bearer syntax, and URL/configuration values are bounded.

## Agent runtime

The agent state path is configured by `NEXUS_AGENT_STATE_PATH` and defaults to a user-specific application data directory. Writes use a temporary file followed by rename to avoid partial state. The runtime enrolls only when no credential exists, then begins a heartbeat loop. Network behavior is isolated behind a small client interface so orchestration can be tested without a live server. Secrets are never logged.

## Error handling

Registration rejects missing or invalid enrollment credentials with a generic unauthorized response. Heartbeats reject unknown agents and invalid secrets without revealing which value failed. A failed heartbeat is logged without secrets and retried at the next interval. Enrollment failures stop startup because the agent cannot operate safely without identity.

## Testing

Pure identity, secret hashing, status, state storage, and orchestration behavior are developed test-first. API service tests use a repository interface rather than Prisma mocks. A PostgreSQL integration test covers registration, credential hashing, heartbeat persistence, and status derivation when Docker is available; otherwise the environment limitation is reported without claiming integration success.

## Defaults

- API version prefix: `/api/v1`
- Heartbeat interval: 15 seconds
- Offline threshold: 45 seconds
- Agent secret: 32 random bytes, base64url encoded
- Secret storage: SHA-256 digest only
- Authentication scheme: Bearer

## Exit criteria

Phase 1 is complete when a real agent can create stable local identity, enroll once, persist its credential, send authenticated heartbeats, and be classified online/offline by tested backend logic. All repository quality commands and Prisma validation/generation must pass. No GitHub push is performed by the implementation process.
