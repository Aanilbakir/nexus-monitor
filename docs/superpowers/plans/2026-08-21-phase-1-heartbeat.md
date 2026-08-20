# NEXUS Monitor Phase 1 Host Registration and Heartbeat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement secure agent enrollment, stable local identity, authenticated heartbeat persistence, and backend-derived host availability.

**Architecture:** Shared packages define transport contracts, while pure API domain services depend on repository and credential interfaces. Prisma implements persistence at the infrastructure boundary. The agent isolates state storage, HTTP transport, and scheduling from orchestration.

**Tech Stack:** Node.js 24, TypeScript 5.9, NestJS 11, Prisma 7, PostgreSQL 17, Jest 29, pnpm 11.

## Global Constraints

- Implement Phase 1 only; do not collect system metrics or add dashboard host features.
- Enrollment requires `AGENT_ENROLLMENT_TOKEN`; no unauthenticated development mode.
- Persist only the SHA-256 hash of agent secrets.
- Use UUIDs for host and agent identity; hostname is mutable metadata.
- Heartbeat interval is 15 seconds and offline threshold is 45 seconds.
- Do not push to GitHub; create local commits only.

---

### Task 1: Persistence schema

**Files:** `prisma/schema.prisma`, `prisma/migrations/*/migration.sql`

- [ ] Add `Host`, `Agent`, and `Heartbeat` models with cascading relations and query indexes.
- [ ] Format and validate the Prisma schema.
- [ ] Generate and inspect the SQL migration without applying it to an unavailable database.
- [ ] Commit with `feat: add host heartbeat persistence model`.

### Task 2: Shared transport contracts

**Files:** `packages/contracts/src/agent.ts`, `packages/contracts/src/agent.test.ts`, `packages/contracts/src/index.ts`

- [ ] Write failing tests for registration and heartbeat response factories.
- [ ] Add readonly registration, credential, heartbeat, and status types with bounded constants.
- [ ] Run contract tests, type checking, and build.
- [ ] Commit with `feat: define agent enrollment contracts`.

### Task 3: API domain behavior

**Files:** `apps/api/src/agents/domain/*`, matching tests

- [ ] Write failing tests for constant-time enrollment verification, secret hashing, secret rotation, heartbeat authentication, and online/offline calculation.
- [ ] Implement pure credential utilities and `AgentService` against an `AgentRepository` interface.
- [ ] Keep unauthorized failures generic and never expose stored hashes.
- [ ] Run focused API tests.

### Task 4: API transport and Prisma adapter

**Files:** `apps/api/src/agents/dto/*`, `apps/api/src/agents/agents.controller.ts`, `apps/api/src/agents/agents.module.ts`, `apps/api/src/agents/infrastructure/*`, `apps/api/src/app.module.ts`, `apps/api/src/config/environment.ts`

- [ ] Write failing controller/DTO boundary tests.
- [ ] Add `/api/v1/agents/register` and `/api/v1/agents/:agentId/heartbeat`.
- [ ] Implement Prisma repository transactions and dependency injection.
- [ ] Validate `DATABASE_URL` and `AGENT_ENROLLMENT_TOKEN` at startup.
- [ ] Run API tests, type checking, and build.
- [ ] Commit with `feat: add authenticated agent heartbeat api`.

### Task 5: Agent state and client

**Files:** `apps/agent/src/identity/*`, `apps/agent/src/client/*`, matching tests

- [ ] Write failing tests for new identity creation, state reuse, atomic persistence, registration, and authenticated heartbeat requests.
- [ ] Implement UUID generation, state validation, atomic file storage, and HTTP client behavior.
- [ ] Ensure secrets never appear in errors or logs.

### Task 6: Agent orchestration

**Files:** `apps/agent/src/runtime/*`, `apps/agent/src/main.ts`, `apps/agent/src/config/environment.ts`, matching tests

- [ ] Write failing tests for enroll-once behavior, heartbeat scheduling, and retry-after-failure behavior.
- [ ] Implement orchestration with injectable clock, scheduler, client, and state store.
- [ ] Add `NEXUS_AGENT_STATE_PATH`, `AGENT_ENROLLMENT_TOKEN`, and `AGENT_VERSION` validation.
- [ ] Run agent tests, type checking, and build.
- [ ] Commit with `feat: add agent enrollment and heartbeat runtime`.

### Task 7: Integration, documentation, and verification

**Files:** `README.md`, `.env.example`, `PROJECT_PLAN.md`, `CHANGELOG.md`, `docs/reports/phase-1-report.md`, this plan

- [ ] Add a PostgreSQL-backed integration test or report the Docker engine blocker explicitly.
- [ ] Document enrollment, state storage, API routes, configuration, and manual run commands.
- [ ] Run frozen install, formatting, lint, type checking, all tests, builds, Prisma format/validate/generate, and Docker Compose configuration validation.
- [ ] Record exact results and deviations in the Phase 1 report.
- [ ] Mark execution status in this plan and commit with `docs: report phase 1 verification`.
- [ ] Stop before Phase 2 and provide PowerShell push commands without executing them.
