# NEXUS Monitor Phase 0 Foundation Design

## Objective

Phase 0 establishes a production-minded, public-GitHub-ready foundation for NEXUS Monitor without implementing host registration, heartbeat ingestion, metrics collection, or dashboard product features. Those capabilities begin in later phases only after explicit approval.

## Repository Strategy

NEXUS Monitor will use a single pnpm monorepo. This keeps the API, web dashboard, monitoring agent, and shared contracts independently buildable while giving contributors one installation, one quality workflow, and synchronized local development.

The repository will use the MIT license and include the community and maintenance files expected from a credible open-source project: README, contributing guide, code of conduct, security policy, changelog, issue templates, pull request template, Dependabot configuration, and CI.

## Architecture

The initial workspace boundaries are:

- `apps/api`: NestJS HTTP API and future realtime transport. It owns orchestration and application boundaries, not host-specific collection logic.
- `apps/web`: React and Vite dashboard. It consumes documented API/contracts and does not embed alert evaluation or collection behavior.
- `apps/agent`: Node.js TypeScript process that will later collect machine information and communicate with the API.
- `packages/contracts`: framework-neutral request, response, and event contracts shared between trusted first-party components.
- `packages/config`: shared TypeScript and lint configuration only where reuse improves consistency without coupling runtime code.
- `prisma`: PostgreSQL schema and migration ownership. Phase 0 introduces connectivity and tooling but no Phase 1 domain models.

No application imports another application's internal modules. Cross-boundary communication occurs through contracts and, in future phases, authenticated network protocols.

## Development Infrastructure

pnpm manages workspaces and reproducible dependency installation through a committed lockfile. TypeScript remains strict in every workspace. ESLint and Prettier enforce consistent source quality.

Docker Compose provides PostgreSQL for local development. Application processes remain runnable from the host during Phase 0 for fast iteration. Configuration is supplied through environment variables documented in `.env.example`; secrets and machine-specific files are ignored.

Prisma provides the database client and schema validation. The empty Phase 0 domain schema proves database tooling without prematurely inventing Phase 1 entities.

## Runtime Foundations

Each application exposes only the minimum behavior required to prove its boundary:

- API: starts cleanly and exposes a basic service health endpoint.
- Web: renders a restrained NEXUS Monitor foundation screen suitable for confirming the frontend pipeline, without presenting fake monitoring data.
- Agent: starts, validates its configuration, and reports its runtime readiness locally; it does not collect or transmit host data yet.

These are foundation behaviors rather than simulations of unfinished product features.

## Error Handling and Security Baseline

Environment configuration is validated at process startup and fails with concise, actionable errors. No default production secrets are embedded. The API uses a validation boundary ready for DTO validation in Phase 1. Agent authentication is not implemented in Phase 0, but the architecture reserves an explicit authenticated ingestion boundary rather than trusting arbitrary payloads.

The public repository excludes environment files, generated artifacts, logs, editor metadata, and operating-system-specific files. Security reporting instructions direct vulnerability disclosures away from public issues.

## Testing and Verification

Foundation behavior is developed test-first where behavior is introduced. Configuration-only and generated framework scaffolding are verified through their native validation commands.

Phase 0 completion requires fresh successful runs of:

- dependency installation with a committed lockfile
- lint across all workspaces
- TypeScript type checking across all workspaces
- automated tests across all workspaces
- production builds across all workspaces
- Prisma format, validation, and client generation
- Docker Compose configuration validation

CI runs the same quality checks on pushes and pull requests.

## Repository Documentation

`README.md` explains the product, planned capabilities, architecture, technology choices, local setup, environment variables, Docker usage, development commands, repository structure, roadmap, screenshots placeholder, contribution path, security policy, and license.

`PROJECT_PLAN.md` records Phases 0 through 8 and their exit criteria. `CHANGELOG.md` records repository progress using a Keep a Changelog-compatible structure.

## Phase 0 Exit Criteria

Phase 0 is complete when a new contributor can clone the repository, install dependencies, start PostgreSQL, run each application foundation, and execute all quality checks using documented commands. No Phase 1 host, agent identity, or heartbeat behavior will be included.

## Deferred Decisions

Before Phase 1, the project must decide:

- agent enrollment and credential bootstrap strategy
- host identity stability across reinstalls and hostname changes
- heartbeat interval and offline threshold
- initial API versioning convention
- whether local development permits an explicitly labeled insecure agent mode
