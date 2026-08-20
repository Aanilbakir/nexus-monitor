# Phase 2 Core System Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect one safe machine-wide CPU, memory, disk, network, and uptime sample every 15 seconds and persist authenticated samples historically.

**Architecture:** Shared contracts define one combined sample. The agent separates OS access, pure aggregation, collection orchestration, and transport; `systeminformation@5.33.1` supplies portable disk and network data while Node supplies CPU, memory, uptime, and time. The API validates and authenticates each sample before a Prisma repository performs idempotent persistence.

**Tech Stack:** Node.js 24, strict TypeScript 5.9, systeminformation 5.33.1, NestJS 11, class-validator, Prisma 7, PostgreSQL 17, Jest 29, pnpm 11.

## Global Constraints

- Metrics interval is exactly 15 seconds.
- Each request contains exactly one machine-wide sample.
- Disk values aggregate fixed local filesystems; network values aggregate active non-loopback interfaces.
- Byte counters and uptime are non-negative JavaScript safe integers; CPU is finite and between 0 and 100 inclusive.
- Collection timestamps are UTC ISO 8601 and may not exceed API time by more than five minutes.
- Metrics failures never stop or delay heartbeat delivery.
- Existing per-agent bearer authentication is reused; secrets and full payloads are never logged.
- No dashboard, historical query endpoint, aggregation, retention job, per-volume data, or per-interface data is added.
- No GitHub push is performed.

---

### Task 1: Shared metric contracts and invariants

**Files:**

- Create: `packages/contracts/src/system-metrics.ts`
- Test: `packages/contracts/src/system-metrics.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces: `METRICS_INTERVAL_SECONDS`, `SystemMetricSample`, `SystemMetricIngestResponse`, `validateSystemMetricSample(sample, now)`, and `createMetricIngestResponse(collectedAt, receivedAt)`.
- Consumes: no application or framework code.

- [ ] **Step 1: Write failing contract tests** for valid boundary values, non-finite/fractional/unsafe/negative counters, CPU outside `0..100`, inconsistent memory and disk totals, malformed timestamps, and timestamps over five minutes in the future.
- [ ] **Step 2: Run `pnpm --filter @nexus-monitor/contracts test -- system-metrics.test.ts`** and confirm failure because the module and exports do not exist.
- [ ] **Step 3: Implement the exact interfaces and pure validation result** as `{ valid: true } | { valid: false; reason: string }`; use deterministic short reasons and never echo the payload.
- [ ] **Step 4: Export the contract and run contracts test/typecheck/build** until all pass.
- [ ] **Step 5: Commit** `feat: define core system metric contracts`.

### Task 2: Historical metrics persistence

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260821000200_add_system_metric_samples/migration.sql`

**Interfaces:**

- Produces: Prisma `SystemMetricSample` model related to `Agent` with `@@unique([agentId, collectedAt])`, `@@index([agentId, collectedAt(sort: Desc)])`, and `@@index([receivedAt])`.
- Consumes: Phase 1 `Agent` model.

- [ ] **Step 1: Add a schema-level verification expectation** by running Prisma validation before the model exists and recording the absence of the generated model in the database package typecheck.
- [ ] **Step 2: Add fields** `id BigInt`, `agentId UUID`, `collectedAt`, `receivedAt`, `cpuPercent Float`, eight-byte `BigInt` counters for memory/disk/network, and `uptimeSeconds BigInt`, plus the relation and indexes.
- [ ] **Step 3: Write the explicit SQL migration** with check constraints for CPU, non-negative counters, memory ordering, and disk consistency in addition to the unique key and foreign key.
- [ ] **Step 4: Run Prisma format, validate, generate, and database package typecheck/build** with the documented local verification environment.
- [ ] **Step 5: Commit** `feat: persist historical system metrics`.

### Task 3: Replaceable cross-platform collector

**Files:**

- Modify: `apps/agent/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/agent/src/metrics/cpu.ts`
- Test: `apps/agent/src/metrics/cpu.test.ts`
- Create: `apps/agent/src/metrics/system-metrics-collector.ts`
- Test: `apps/agent/src/metrics/system-metrics-collector.test.ts`
- Create: `apps/agent/src/metrics/system-information-provider.ts`

**Interfaces:**

- Produces: `CpuTimes`, `calculateCpuPercent(previous, current)`, `MetricSource`, `SystemMetricsCollector`, `NodeSystemMetricsCollector`, and `SystemInformationProvider`.
- Consumes: `SystemMetricSample` from contracts and `systeminformation@5.33.1` functions `fsSize()` and `networkStats()`.

- [ ] **Step 1: Write failing CPU delta tests** covering ordinary utilization, zero total delta, and rounding to two decimal places.
- [ ] **Step 2: Run the focused CPU test** and confirm the missing implementation failure.
- [ ] **Step 3: Implement aggregate CPU idle/total delta calculation** with a `null` result when no positive delta exists; run the focused test to green.
- [ ] **Step 4: Write failing collector tests** with a fake `MetricSource` for baseline priming, memory aggregation, fixed-local disk filtering and summation, active non-loopback network summation, safe-integer enforcement, and one shared UTC timestamp.
- [ ] **Step 5: Run the focused collector test** and confirm failure because the collector does not exist.
- [ ] **Step 6: Implement the collector and provider boundary**; map `systeminformation` filesystem entries to local/fixed eligibility and network entries to active/non-loopback eligibility before aggregation.
- [ ] **Step 7: Add the exact dependency with `pnpm --filter @nexus-monitor/agent add systeminformation@5.33.1`**, then run agent tests/typecheck/build.
- [ ] **Step 8: Commit** `feat: collect cross-platform system metrics`.

### Task 4: Authenticated metrics API domain and DTO validation

**Files:**

- Create: `apps/api/src/agents/dto/system-metric-sample.dto.ts`
- Create: `apps/api/src/agents/domain/metric.service.ts`
- Test: `apps/api/src/agents/domain/metric.service.test.ts`
- Modify: `apps/api/src/agents/domain/agent.service.ts`

**Interfaces:**

- Produces: `MetricRepository.insert(input): Promise<'inserted' | 'duplicate'>`, `MetricService.ingest(agentId, token, sample)`, and `InvalidMetricSampleError`.
- Consumes: `CredentialService`, `AgentRepository.findCredentialHash`, shared sample validation, and the server `Clock`.

- [ ] **Step 1: Write failing service tests** for valid authenticated persistence, unknown/invalid credential rejection, future timestamp rejection, duplicate idempotency, and repository error propagation.
- [ ] **Step 2: Run the focused service test** and confirm the missing module failure.
- [ ] **Step 3: Implement `MetricService`** so authentication precedes validation and persistence, `receivedAt` is server-owned, counters convert to `bigint` only after validation, and duplicates return success.
- [ ] **Step 4: Write DTO validation tests** using Nest validation utilities for unknown fields, non-integers, unsafe numbers, negatives, and inconsistent totals.
- [ ] **Step 5: Implement the DTO and a class-level consistency validator** without duplicating database or authentication behavior.
- [ ] **Step 6: Run API tests/typecheck/build** and commit `feat: validate authenticated metric ingestion`.

### Task 5: Prisma repository and HTTP endpoint

**Files:**

- Create: `apps/api/src/agents/infrastructure/prisma-metric.repository.ts`
- Test: `apps/api/src/agents/infrastructure/prisma-metric.repository.test.ts`
- Modify: `apps/api/src/agents/agents.controller.ts`
- Modify: `apps/api/src/agents/agents.module.ts`

**Interfaces:**

- Produces: `PrismaMetricRepository` and `POST /api/v1/agents/:agentId/metrics`.
- Consumes: `MetricRepository`, `MetricService`, Phase 1 bearer parsing, generated Prisma client, and `SystemMetricSampleDto`.

- [ ] **Step 1: Write a failing repository test** with a narrow fake Prisma client proving exact field mapping and Prisma unique-conflict conversion to `'duplicate'` while unrelated database errors propagate.
- [ ] **Step 2: Run the focused repository test** and confirm the missing implementation failure.
- [ ] **Step 3: Implement repository insertion** and recognize only Prisma unique constraint `P2002` for the `(agentId, collectedAt)` key.
- [ ] **Step 4: Write a failing controller test** for bearer forwarding, UUID validation boundary, successful response, generic unauthorized mapping, and bounded invalid-sample response.
- [ ] **Step 5: Add the controller route and module providers** using the existing Prisma and credential instances.
- [ ] **Step 6: Run all API tests/typecheck/build** and commit `feat: expose system metric ingestion endpoint`.

### Task 6: Agent metric transport and independent scheduler

**Files:**

- Modify: `apps/agent/src/client/agent-client.ts`
- Modify: `apps/agent/src/client/agent-client.test.ts`
- Create: `apps/agent/src/runtime/metrics-runtime.ts`
- Test: `apps/agent/src/runtime/metrics-runtime.test.ts`
- Modify: `apps/agent/src/main.ts`

**Interfaces:**

- Produces: `AgentClient.sendMetrics(agentId, token, sample)` and `MetricsRuntime.start(agentId, token)`.
- Consumes: `SystemMetricsCollector`, `SystemMetricSample`, and an injected 15-second scheduler.

- [ ] **Step 1: Add a failing client test** proving the exact metrics URL, bearer header, and JSON body.
- [ ] **Step 2: Run it and confirm failure because `sendMetrics` is absent; implement the method and rerun to green.**
- [ ] **Step 3: Write failing runtime tests** proving startup primes without sending, first scheduled collection sends, collection failure is reported and retried next interval, send failure is reported and retried, and heartbeat scheduling remains separate.
- [ ] **Step 4: Run the focused runtime test** and confirm the missing implementation failure.
- [ ] **Step 5: Implement `MetricsRuntime`** with one in-flight cycle at a time and generic error reporting; do not place metric logic inside `AgentRuntime`.
- [ ] **Step 6: Compose both runtimes in `main.ts`** after reading persisted/enrolled agent state through a minimal `AgentRuntime.start()` return value; add the failing orchestration expectation before changing that return type.
- [ ] **Step 7: Run all agent tests/typecheck/build** and commit `feat: schedule independent metric delivery`.

### Task 7: Documentation, CI compatibility, and phase report

**Files:**

- Modify: `.env.example` only if collection configuration is introduced
- Modify: `README.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `CHANGELOG.md`
- Create: `docs/reports/phase-2-report.md`

**Interfaces:**

- Consumes: final route, interval, schema, tests, and actual verification evidence.
- Produces: reproducible Phase 2 operator and contributor documentation.

- [ ] **Step 1: Update README architecture and runtime documentation** with the metrics route, interval, field units, collector dependency, and honest Docker limitation.
- [ ] **Step 2: Update changelog and mark Phase 2 status** only after behavioral verification passes.
- [ ] **Step 3: Run frozen install, Prisma generate/format/validate, format check, lint, typecheck, all tests, all builds, and Docker Compose config validation.**
- [ ] **Step 4: Attempt live Docker/PostgreSQL integration only if engine access is available**; record the exact result without converting an unavailable check into a pass.
- [ ] **Step 5: Write `phase-2-report.md` from fresh command output**, including exact suite/test totals and remaining limitations.
- [ ] **Step 6: Re-run formatting and repository-diff checks**, verify the worktree contains only intended changes, and commit `docs: report phase 2 verification`.

### Task 8: Local handoff

**Files:**

- No file changes.

**Interfaces:**

- Produces: verified local branch and manual PowerShell merge/push instructions.
- Consumes: clean `phase-2-core-metrics` branch and its commit history.

- [ ] **Step 1: Run the complete verification suite again after the report commit** and inspect its exit codes.
- [ ] **Step 2: Inspect `git status`, branch ancestry, commits, and configured remote** without fetching or pushing.
- [ ] **Step 3: Give the user exact PowerShell commands** to switch to `main`, fast-forward merge `phase-2-core-metrics`, and push `main`; do not execute them.
