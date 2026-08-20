# Phase 0 Report

## 1. Architecture chosen

NEXUS Monitor uses a pnpm monorepo with three independently buildable applications and one framework-neutral contracts package. The NestJS API, React dashboard, Node.js agent, PostgreSQL persistence tooling, and future realtime/alerting boundaries remain separate. No Phase 1 host registration or heartbeat behavior is included.

## 2. Folder structure

```text
apps/
  agent/       Agent runtime and startup configuration
  api/         NestJS API and health boundary
  web/         React/Vite dashboard foundation
packages/
  contracts/   Shared service contracts
prisma/        PostgreSQL schema and generated-client target
docs/
  reports/     Phase verification reports
  superpowers/ Approved designs and implementation plans
.github/       CI, maintenance, and contribution configuration
```

## 3. Files created

The phase created workspace manifests and TypeScript configurations; API, agent, web, and contract source/tests; Prisma and Docker configuration; environment examples; GitHub automation and templates; project policies; and public documentation. Generated dependencies, builds, coverage, Prisma clients, TypeScript build caches, and local environment files are excluded from Git.

## 4. Tooling and configuration

- Node.js 24 and pnpm 11 with a committed lockfile
- Strict TypeScript 5.9 settings shared from the repository root
- ESLint 9 with type-aware TypeScript rules
- Prettier 3 and EditorConfig
- Jest 29 for Node workspaces and Vitest 4 for the Vite application
- GitHub Actions quality workflow and monthly Dependabot checks

The project deliberately pins TypeScript 5.9 and Jest 29 instead of newly published major versions because the selected NestJS/Jest transformer toolchain is compatible with these stable lines.

## 5. Database setup

Prisma 7 targets PostgreSQL and generates its client into an ignored project-local directory. Phase 0 keeps the domain schema empty to avoid inventing Host and Agent models before Phase 1 identity and authentication decisions are made. `.env.example` documents local connection settings without a usable production secret.

## 6. Docker setup

`docker-compose.yml` defines PostgreSQL 17 Alpine, a named persistent volume, localhost-only port exposure, environment-driven credentials, and a `pg_isready` health check. `docker compose --env-file .env.example config --quiet` exits successfully.

The installed Docker CLI cannot access `C:\Users\Anıl\.docker\config.json` or the local Docker engine in this execution environment. Container startup and the PostgreSQL health check therefore remain runtime-unverified; this is an environment permission limitation, not a passing claim.

## 7. Test results

`pnpm test` passes with 13 tests across six suites:

- contracts: 1 test
- API: 6 tests
- agent: 5 tests
- web: 1 test

The API health endpoint was also started from its production build and returned an operational health payload. The production agent build validated its environment and returned a ready payload.

## 8. Build, lint, and type-check results

Fresh verification on 2026-08-20:

- `pnpm install --frozen-lockfile`: pass
- `pnpm format:check`: pass
- `pnpm lint`: pass with zero warnings
- `pnpm typecheck`: pass for all four workspaces
- `pnpm test`: pass, 13 tests
- `pnpm build`: pass for all four workspaces
- `pnpm prisma:format`: pass
- `pnpm prisma:validate`: pass
- `pnpm prisma:generate`: pass
- Docker Compose configuration validation: pass

## 9. Deviations from the proposed plan

- A root `tsconfig.json` was added so type-aware linting can validate `prisma.config.ts`.
- Jest tests use CommonJS transformation internally while production packages remain ESM. This avoids experimental Jest VM module requirements and does not alter runtime output.
- The current environment required a workspace-local copy of Prisma's already installed schema engine for verification because Prisma could not update its user-profile cache. The copied executable lives outside the repository and is not a project dependency.
- Docker configuration was validated, but container startup could not be verified because the environment denies Docker engine access.

## 10. Architectural concerns

- Shared contracts currently expose only service health. Phase 1 must avoid turning this package into a framework or domain dumping ground.
- Online/offline derivation must be backend domain logic based on persisted heartbeat timing, never UI state.
- Metric volume and retention are intentionally deferred; schema indexes and aggregation strategy must be designed with representative query patterns.
- Agent input remains untrusted even when future credentials are valid. Authentication and payload validation solve different risks.

## 11. Decisions needed before Phase 1

1. Agent enrollment and credential bootstrap strategy.
2. Stable host identity across reinstalls, hostname changes, and cloned machines.
3. Heartbeat interval, offline threshold, and clock-skew tolerance.
4. Initial API versioning convention.
5. Whether local development permits an explicitly labeled insecure agent mode.

Phase 1 must not begin until these decisions receive explicit approval.
