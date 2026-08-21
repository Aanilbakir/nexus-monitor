# Phase 2 Report

## Outcome

Phase 2 adds authenticated collection and historical persistence for machine-wide CPU, memory, fixed-disk, network, and uptime metrics. The agent primes its CPU baseline on startup and then collects and sends one combined sample every 15 seconds on a schedule independent from heartbeat delivery.

## Collection

- CPU percentage is derived from aggregate idle and total CPU time deltas and rounded to two decimal places.
- Memory records total and used bytes.
- Eligible fixed local filesystems are aggregated into total, used, and available bytes.
- Active non-loopback interfaces are aggregated into cumulative received and transmitted bytes.
- Uptime is recorded in whole seconds.
- All counters remain within the non-negative JavaScript safe-integer range.

The collector depends on replaceable provider interfaces. `systeminformation` supplies portable filesystem and network information. A Windows fallback discovers ready fixed drives through the .NET `DriveInfo` API and measures them through Node `statfs` when the library returns no filesystem rows.

## Ingestion and security

`POST /api/v1/agents/:agentId/metrics` reuses the Phase 1 per-agent bearer credential. Authentication occurs before sample validation and persistence. DTO and domain validation reject non-finite, negative, fractional, unsafe, inconsistent, malformed, or excessively future-dated values without echoing full payloads.

Phase 2 collects no file contents, usernames, IP addresses, or process lists. Metric and heartbeat failures are isolated; each failed metric cycle is reported without secrets and retried at the next interval.

## Persistence

The `SystemMetricSample` table stores agent and server timestamps plus the combined metric values. PostgreSQL constraints repeat critical numeric and consistency checks. A unique key on `(agentId, collectedAt)` makes retries idempotent, while descending agent/time and receipt-time indexes prepare bounded inspection and later historical queries.

## Verification

Fresh verification on 2026-08-21 passed:

- `pnpm install --frozen-lockfile`, including pnpm supply-chain policy checks for 867 lockfile entries
- Prisma client generation, formatting, and schema validation
- Prettier formatting check
- ESLint with zero warnings
- strict TypeScript checks for every workspace
- 76 automated tests across 22 suites
- production builds for the API, agent, contracts, database package, and web application
- Docker Compose configuration validation
- a real Windows collector smoke test confirming bounded CPU, detected fixed-disk capacity, safe network counters, and positive uptime

The Docker CLI remains unable to read its user configuration or connect to the local Docker engine in this execution environment. A live PostgreSQL migration and ingestion test could not run and is not represented as passing. The migration, Prisma repository, service lifecycle, validation, duplicate mapping, and generated database types are covered by the available automated and compile-time checks.

## CI and repository readiness

Clean-workspace testing exposed that API checks could begin before generated shared package output existed. Root pre-test/pre-typecheck scripts and the CI shared-package build step now make this dependency order deterministic. No GitHub push was performed during Phase 2.
