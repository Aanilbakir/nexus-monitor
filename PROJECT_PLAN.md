# NEXUS Monitor Project Plan

Development advances one explicitly approved phase at a time. A phase is complete only after its code, tests, documentation, and relevant quality gates pass.

## Phase 0: Repository foundation

**Goal:** Establish independently buildable agent, API, dashboard, contracts, and persistence tooling in a public-GitHub-ready monorepo.

**Exit criteria:** A contributor can install dependencies, validate configuration, build every workspace, run all tests, and validate Prisma and Docker Compose from documented commands.

**Status:** Implementation complete; final verification report pending.

## Phase 1: Host registration and heartbeat

**Goal:** Persist stable host and agent identities, accept authenticated-ready heartbeat payloads, and derive online/offline status outside the UI.

**Exit criteria:** An agent can register and send validated heartbeats; the API persists them; missing heartbeats change host status; unit and integration tests cover the lifecycle.

## Phase 2: Core system metrics

**Goal:** Collect and ingest CPU, memory, disk, uptime, and network measurements with cross-platform boundaries.

**Exit criteria:** Validated samples are stored historically, unsafe or malformed input is rejected, and collection providers are replaceable and tested.

## Phase 3: Realtime dashboard

**Goal:** Display host state and live metrics through a dedicated realtime transport.

**Exit criteria:** The host list and detail view update without refresh, disconnected states are honest, and accessible loading/error/empty states are present.

## Phase 4: Historical metrics and charts

**Goal:** Query, aggregate, and visualize metrics over selectable time ranges.

**Exit criteria:** Indexed queries have bounded ranges, chart resolution matches the selected interval, and API performance is measured with representative data.

## Phase 5: Alerting

**Goal:** Evaluate extensible threshold and availability rules outside presentation components.

**Exit criteria:** Rules support pending, firing, acknowledged, and resolved lifecycles; history is persisted; duplicate events are controlled; critical paths are tested.

## Phase 6: Processes and system events

**Goal:** Add safe process snapshots, service/application status, and system events.

**Exit criteria:** Collection minimizes sensitive data, payload sizes are bounded, and users can inspect recent activity by host.

## Phase 7: Production hardening

**Goal:** Prepare deployment boundaries for untrusted networks and sustained metric volume.

**Exit criteria:** Agent authentication, rate limits, structured logging, health checks, database indexes, retention policy, error handling, and security review are complete.

## Phase 8: Public GitHub polish

**Goal:** Prepare a clear, reproducible public demonstration and release.

**Exit criteria:** Architecture diagrams, screenshots, example configuration, release notes, documentation audit, repository audit, and demo instructions are complete.
