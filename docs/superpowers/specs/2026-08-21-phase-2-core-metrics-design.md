# NEXUS Monitor Phase 2 Core System Metrics Design

## Objective

Phase 2 collects, authenticates, validates, and stores historical machine-level CPU, memory, disk, network, and uptime samples. It extends the Phase 1 agent and API without coupling telemetry success to heartbeat availability. It does not add dashboard views, historical query endpoints, per-volume or per-interface details, aggregation, or retention jobs.

## Sampling model

The agent begins collection immediately after startup and emits one combined system metric sample every 15 seconds. Because CPU requires two readings, startup captures the baseline and the first complete sample is emitted at the first interval. All fields in a sample share one agent-generated UTC `collectedAt` timestamp. The API adds its own `receivedAt` timestamp so future phases can distinguish collection time from ingestion time.

Each sample contains:

- CPU utilization as a percentage from 0 through 100
- total and used memory in bytes
- total, used, and free fixed-disk capacity in bytes
- cumulative received and transmitted network bytes across active interfaces
- system uptime in whole seconds

Memory must satisfy `usedBytes <= totalBytes`. Disk values must satisfy `usedBytes + freeBytes <= totalBytes`; the inequality permits filesystem-reserved capacity. All counters are finite, non-negative safe integers. CPU utilization is finite and bounded. Timestamps must be valid ISO 8601 UTC strings and cannot be more than five minutes in the future relative to API receipt.

## Collection architecture

The agent uses a `SystemMetricsCollector` interface so orchestration does not depend directly on operating-system APIs. A Node collector reads CPU, memory, and uptime from Node system facilities. Disk capacity and network byte counters are isolated behind platform adapters because Node does not expose both datasets portably.

CPU utilization is calculated from the change in aggregate CPU idle and total time between two readings. The first collection primes the CPU baseline, waits for the next scheduled reading, and emits the first complete sample only after a valid delta exists. This avoids publishing a misleading lifetime average or fabricated zero.

Disk collection includes fixed local filesystems and excludes removable, optical, virtual, pseudo, and network filesystems where the platform can distinguish them. Values from eligible filesystems are summed into one machine-level total. Network collection sums cumulative byte counters from active, non-loopback interfaces. Unsupported or inaccessible sources cause that collection cycle to fail explicitly; the agent does not invent substitute values.

## Data flow

The agent sends `POST /api/v1/agents/:agentId/metrics` with its Phase 1 bearer credential. The payload contains exactly one `SystemMetricSample`. The API authenticates the agent, validates the complete payload, records `receivedAt` from the server clock, and inserts the sample. A successful request returns the accepted collection timestamp and the 15-second sampling interval.

Metrics and heartbeat use independent schedules and error paths. A collection or ingestion failure is logged without payloads or secrets and retried on the next metrics interval. It never suppresses heartbeat delivery. An authentication failure does not trigger silent re-enrollment or credential replacement.

## Persistence

Prisma adds a `SystemMetricSample` model related to `Agent`. Numeric byte counters use PostgreSQL `BIGINT`; CPU percentage uses a bounded floating-point column; timestamps use millisecond precision. The table has an index on `(agentId, collectedAt DESC)` for the bounded historical queries planned in Phase 4 and an index on `receivedAt` for operational inspection.

The API inserts each accepted sample as a historical row. Duplicate collection timestamps for the same agent are rejected by a unique constraint on `(agentId, collectedAt)`, making client retries idempotent at the database boundary. A duplicate request returns the already-accepted timestamp instead of creating a second row.

## Contracts and validation

Framework-neutral request and response shapes live in `@nexus-monitor/contracts`. NestJS DTOs provide runtime validation with an explicit whitelist. Validation rejects unknown properties, non-finite numbers, fractional byte counters, negative values, unsafe integers, inconsistent memory or disk totals, invalid timestamps, and timestamps beyond the future-skew allowance.

The transport uses JSON numbers. Phase 2 caps every byte counter at JavaScript's maximum safe integer; larger-machine support would require a versioned string or bigint representation and is outside this phase.

## Error handling

- Invalid or unknown bearer credentials return the same generic unauthorized response used by heartbeat.
- Invalid samples return a bounded validation error without echoing the full payload.
- Duplicate samples are treated as idempotent success.
- Database failures return a server error and do not acknowledge acceptance.
- Collector and network failures affect only the current metrics cycle and are retried after 15 seconds.
- Logs never include enrollment tokens, agent credentials, authorization headers, or complete metric payloads.

## Testing

Development follows test-first cycles. Pure tests cover CPU delta calculation, aggregation rules, sample invariants, timestamp skew, and scheduling independence. Collector tests use injected system and disk providers rather than the developer machine's current values. API service tests cover authentication, persistence input, duplicate idempotency, and failure propagation through a repository interface. DTO tests cover rejected malformed and inconsistent values. Prisma generation, schema validation, strict type checking, linting, all workspace tests, and production builds remain required quality gates.

A live PostgreSQL integration test should exercise the migration, insertion, duplicate handling, and indexed lookup when Docker access is available. If the execution environment still denies Docker access, the limitation must be reported and must not be represented as a passing integration test.

## Defaults and limits

- Metrics interval: 15 seconds
- Payload cardinality: one combined sample per request
- Scope: machine-wide values only
- Future timestamp allowance: five minutes
- Byte representation: non-negative JavaScript safe integers
- CPU range: 0 through 100 inclusive
- Uptime representation: whole seconds
- Authentication: existing per-agent bearer credential

## Exit criteria

Phase 2 is complete when the replaceable agent collector produces valid machine-wide samples, metrics run independently from heartbeat, the authenticated API rejects unsafe input and stores accepted samples historically without duplicates, and all available repository quality gates pass. No dashboard or GitHub push is part of this phase.
