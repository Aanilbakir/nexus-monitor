# Changelog

All notable changes to NEXUS Monitor are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will adopt semantic versioning when public releases begin.

## [Unreleased]

### Added

- pnpm monorepo foundation for the API, dashboard, agent, and shared contracts.
- Strict TypeScript, ESLint, Prettier, Jest, Vitest, and root quality commands.
- NestJS service health boundary with validated startup configuration.
- Agent configuration and readiness foundation without telemetry collection.
- Dark-first React foundation screen without simulated monitoring data.
- Prisma 7 and PostgreSQL 17 development infrastructure.
- GitHub Actions, Dependabot, issue forms, pull request template, and public project policies.
- Phase design, implementation plan, roadmap, and contributor documentation.
- Evidence-backed Phase 0 verification report.
- Persistent host, agent, and heartbeat models with the initial PostgreSQL migration.
- Authenticated agent enrollment with one-time credential delivery and hashed storage.
- Stable local agent identity, atomic credential persistence, and 15-second heartbeats.
- Online/offline availability derived from a 45-second heartbeat threshold.
- Versioned `/api/v1` agent registration and heartbeat endpoints.
- Machine-wide CPU, memory, fixed-disk, network, and uptime collection every 15 seconds.
- Authenticated system metric ingestion with strict numeric and timestamp validation.
- Idempotent historical metric persistence with PostgreSQL constraints and query indexes.
- Independent heartbeat and metric schedules with retry-on-next-cycle behavior.
- Clean-workspace CI ordering for generated and shared packages.
- Persisted fleet snapshots with latest host availability and system metrics.
- Typed Server-Sent Events for live metric and availability updates.
- Responsive EN/TR command-console dashboard with deep-linked host selection.
- Honest connecting, reconnecting, loading, retry, and empty dashboard states.
- Bounded historical metric queries for 1-hour through 30-day ranges with database-side aggregation.
- Accessible EN/TR CPU and memory, disk, and network charts with responsive range selection and point inspection.
- Opt-in representative 30-day PostgreSQL history-query performance verification.
