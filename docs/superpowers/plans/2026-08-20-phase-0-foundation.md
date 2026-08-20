# NEXUS Monitor Phase 0 Foundation Implementation Plan

> **Execution status (2026-08-20):** Tasks 1-9 are complete. All code quality gates pass. Docker Compose configuration validation passes, while container startup remains unverified because the current machine denies access to the Docker engine.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a buildable, tested, documented, public-GitHub-ready monorepo foundation for the NEXUS Monitor API, web dashboard, monitoring agent, shared contracts, and PostgreSQL persistence tooling.

**Architecture:** A pnpm workspace keeps three independently buildable applications under `apps/` and framework-neutral shared code under `packages/`. NestJS owns the central API boundary, React/Vite owns presentation, the Node.js agent remains a separate process, and Prisma owns PostgreSQL access without introducing Phase 1 domain models.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript strict mode, NestJS, React, Vite, Prisma, PostgreSQL, Jest, Vitest, ESLint, Prettier, Docker Compose, GitHub Actions.

## Global Constraints

- Implement Phase 0 only; do not add host registration, heartbeat, metric collection, alerts, or realtime product features.
- Keep application internals isolated; shared runtime types belong in `packages/contracts`.
- Do not hardcode secrets or commit `.env` files.
- Keep TypeScript strict and avoid `any`.
- Use test-first development for new runtime behavior.
- Use the MIT license and English public documentation.
- All root quality commands must work from a clean dependency installation.

## File Map

- Root configuration: workspace scripts, package manager settings, linting, formatting, TypeScript defaults, environment example, Docker Compose, Prisma configuration.
- `apps/api`: NestJS bootstrap, configuration validation, and service health endpoint.
- `apps/web`: React/Vite bootstrap and honest foundation screen with no simulated monitoring data.
- `apps/agent`: Node process bootstrap and validated startup configuration.
- `packages/contracts`: framework-neutral health contract exported as a stable package boundary.
- `.github`: CI, Dependabot, issue forms, and pull request template.
- Public documentation: README, roadmap/project plan, changelog, contributing, conduct, security, and license.

---

### Task 1: Repository and Workspace Foundation

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.npmrc`

**Interfaces:**

- Consumes: Node.js 24 and pnpm 11 installed on the contributor machine.
- Produces: root commands `build`, `lint`, `typecheck`, `test`, `format:check`, `prisma:validate`, and `prisma:generate`.

- [ ] **Step 1: Add workspace metadata and deterministic package-manager configuration**

Define a private ESM root package, pin the pnpm major through `packageManager`, declare Node.js 24 as the supported engine, and include only `apps/*` and `packages/*` in the workspace.

- [ ] **Step 2: Add strict shared TypeScript configuration**

Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`, and consistent casing. Keep the base config emission-neutral so each workspace selects its own module and output settings.

- [ ] **Step 3: Add lint, format, editor, and ignore rules**

Configure ESLint for TypeScript and React, Prettier for repository formatting, LF line endings through EditorConfig, and exclusions for dependencies, builds, coverage, Prisma-generated files, environment files, logs, and local IDE/OS metadata.

- [ ] **Step 4: Install dependencies and commit the lockfile**

Run: `pnpm install`

Expected: exit code 0 and a new `pnpm-lock.yaml`.

- [ ] **Step 5: Verify root configuration parsing**

Run: `pnpm exec prettier --check package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.mjs .prettierrc.json .prettierignore .editorconfig .gitignore .npmrc
git commit -m "chore: establish pnpm workspace"
```

### Task 2: Shared Contracts Package

**Files:**

- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/tsconfig.build.json`
- Create: `packages/contracts/src/health.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/health.test.ts`

**Interfaces:**

- Consumes: root TypeScript and test configuration.
- Produces: `ServiceHealth`, `SERVICE_HEALTH_STATUS`, and `createServiceHealth(service, timestamp)` from `@nexus-monitor/contracts`.

- [ ] **Step 1: Write a failing contract behavior test**

```ts
import { createServiceHealth } from './health.js';

describe('createServiceHealth', () => {
  it('creates an operational health payload with an explicit timestamp', () => {
    expect(createServiceHealth('api', '2026-08-20T12:00:00.000Z')).toEqual({
      service: 'api',
      status: 'operational',
      timestamp: '2026-08-20T12:00:00.000Z',
    });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing implementation failure**

Run: `pnpm --filter @nexus-monitor/contracts test`

Expected: FAIL because `./health.js` does not exist.

- [ ] **Step 3: Implement the minimal framework-neutral health contract**

Create a readonly `ServiceHealth` interface, an `operational` status constant, and a pure `createServiceHealth` function matching the test. Export them from `src/index.ts`.

- [ ] **Step 4: Run contract tests, type checking, and build**

Run: `pnpm --filter @nexus-monitor/contracts test && pnpm --filter @nexus-monitor/contracts typecheck && pnpm --filter @nexus-monitor/contracts build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat: add shared service health contract"
```

### Task 3: NestJS API Foundation

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/config/environment.ts`
- Create: `apps/api/src/config/environment.test.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.test.ts`
- Create: `apps/api/src/health/health.module.ts`

**Interfaces:**

- Consumes: `createServiceHealth` from `@nexus-monitor/contracts` and environment variables `API_HOST`, `API_PORT`, `NODE_ENV`.
- Produces: `GET /health` returning `ServiceHealth`; `readApiEnvironment(source)` returning validated API startup configuration.

- [ ] **Step 1: Write failing environment validation tests**

Cover the defaults `127.0.0.1:3000`, a supplied valid port, and rejection of a non-numeric or out-of-range port. Run the focused test and confirm failure because `readApiEnvironment` is missing.

- [ ] **Step 2: Implement minimal API environment parsing**

Return a typed immutable configuration object. Reject invalid ports with `Invalid API_PORT: expected an integer between 1 and 65535.`

- [ ] **Step 3: Run environment tests and confirm they pass**

Run: `pnpm --filter @nexus-monitor/api test -- environment.test.ts`

Expected: PASS.

- [ ] **Step 4: Write a failing health controller test**

Inject a fixed clock and assert that `getHealth()` returns `{ service: 'api', status: 'operational', timestamp }`. Confirm failure before creating the controller.

- [ ] **Step 5: Implement the health module and application bootstrap**

Implement only the tested controller behavior. Bootstrap NestJS with global validation configured to whitelist properties, reject unknown properties, and transform validated inputs. Listen using validated host and port values.

- [ ] **Step 6: Run API tests, type checking, and build**

Run: `pnpm --filter @nexus-monitor/api test && pnpm --filter @nexus-monitor/api typecheck && pnpm --filter @nexus-monitor/api build`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat: establish api health boundary"
```

### Task 4: Monitoring Agent Foundation

**Files:**

- Create: `apps/agent/package.json`
- Create: `apps/agent/tsconfig.json`
- Create: `apps/agent/tsconfig.build.json`
- Create: `apps/agent/src/config/environment.ts`
- Create: `apps/agent/src/config/environment.test.ts`
- Create: `apps/agent/src/readiness.ts`
- Create: `apps/agent/src/readiness.test.ts`
- Create: `apps/agent/src/main.ts`

**Interfaces:**

- Consumes: environment variables `NEXUS_API_URL` and `AGENT_ID`; no network calls in Phase 0.
- Produces: `readAgentEnvironment(source)` and `createAgentReadiness(agentId, timestamp)`.

- [ ] **Step 1: Write failing agent configuration tests**

Assert acceptance of an HTTP(S) API URL and non-empty agent ID. Assert rejection of missing IDs, malformed URLs, and non-HTTP protocols. Confirm the test fails because the parser is absent.

- [ ] **Step 2: Implement strict agent configuration parsing**

Return a typed configuration object and concise errors. Do not provide a default credential or silently synthesize an agent identity.

- [ ] **Step 3: Write and verify a failing readiness test**

Assert an explicit readiness payload containing agent ID, `ready` status, and the supplied timestamp.

- [ ] **Step 4: Implement the readiness payload and startup entry point**

Validate configuration, produce one structured readiness log, and exit normally. Do not collect host information or contact the API.

- [ ] **Step 5: Run agent tests, type checking, and build**

Run: `pnpm --filter @nexus-monitor/agent test && pnpm --filter @nexus-monitor/agent typecheck && pnpm --filter @nexus-monitor/agent build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/agent
git commit -m "feat: establish agent runtime foundation"
```

### Task 5: React Dashboard Foundation

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.app.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.tsx`
- Create: `apps/web/src/app.test.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/vite-env.d.ts`

**Interfaces:**

- Consumes: browser runtime only; no API or fake metric dependency in Phase 0.
- Produces: a responsive foundation page identifying NEXUS Monitor and clearly labeling the repository as the monitoring platform foundation.

- [ ] **Step 1: Write a failing accessibility-focused render test**

Assert a single `NEXUS Monitor` level-one heading, a `Foundation online` status label, and explanatory copy that does not claim live hosts or metrics. Confirm failure because `App` is absent.

- [ ] **Step 2: Implement the minimal application structure**

Create semantic landmark regions and the exact tested content. Keep the screen dense, dark-first, restrained, and responsive without gradients, excessive cards, or simulated metric charts.

- [ ] **Step 3: Add the visual system**

Use CSS custom properties for neutral surfaces, status colors, typography, spacing, focus visibility, and reduced-motion support. Use system and monospace font stacks so no network font is required.

- [ ] **Step 4: Run web tests, type checking, and production build**

Run: `pnpm --filter @nexus-monitor/web test && pnpm --filter @nexus-monitor/web typecheck && pnpm --filter @nexus-monitor/web build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: establish dashboard foundation"
```

### Task 6: Prisma and Docker Development Infrastructure

**Files:**

- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `docker-compose.yml`
- Create: `.env.example`

**Interfaces:**

- Consumes: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` from local environment configuration.
- Produces: validated Prisma client configuration and a health-checked local PostgreSQL service.

- [ ] **Step 1: Define environment examples without usable production secrets**

Document local-only example values for PostgreSQL, API host/port, agent ID, and API URL. Explain that contributors copy the file to `.env` and choose their own local password.

- [ ] **Step 2: Add an empty-domain Prisma schema**

Configure the PostgreSQL datasource and generated client. Do not add Host, Agent, or other Phase 1 models.

- [ ] **Step 3: Add the PostgreSQL Compose service**

Use PostgreSQL 17 with a named volume, parameterized environment values, a `pg_isready` health check, and localhost-only port binding.

- [ ] **Step 4: Validate Prisma and Compose configuration**

Run: `pnpm prisma:format && pnpm prisma:validate && pnpm prisma:generate`

Run: `docker compose --env-file .env.example config --quiet`

Expected: all commands exit 0. If Docker cannot read its user configuration, report the environment limitation and separately validate the YAML structure without claiming Docker success.

- [ ] **Step 5: Commit**

```bash
git add prisma prisma.config.ts docker-compose.yml .env.example package.json pnpm-lock.yaml
git commit -m "chore: add postgres development infrastructure"
```

### Task 7: Public GitHub Governance and Automation

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`

**Interfaces:**

- Consumes: root pnpm quality commands.
- Produces: pull-request validation and standard public contribution/reporting paths.

- [ ] **Step 1: Add CI with least-privilege permissions**

Run checkout and pnpm setup, select Node.js 24, install with `--frozen-lockfile`, then run format checking, linting, type checking, tests, build, Prisma validation, and Prisma generation. Set workflow permissions to read repository contents only.

- [ ] **Step 2: Add dependency maintenance configuration**

Configure monthly pnpm and GitHub Actions update checks with conservative open-PR limits.

- [ ] **Step 3: Add structured contribution templates**

Issue forms must request reproduction details or problem/use-case context. The pull request template must require scope, verification, screenshots when visual, and a secrets check.

- [ ] **Step 4: Add project policies**

Use the MIT license, Contributor Covenant 2.1, concise contribution setup, and private vulnerability reporting guidance with no invented email address. Point reporters to GitHub private vulnerability reporting when enabled.

- [ ] **Step 5: Validate formatting and workflow syntax structure**

Run: `pnpm exec prettier --check .github CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md LICENSE`

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add .github LICENSE CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md
git commit -m "docs: add open source project governance"
```

### Task 8: Project Documentation and Phase Tracking

**Files:**

- Create: `README.md`
- Create: `PROJECT_PLAN.md`
- Create: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-08-20-phase-0-foundation.md`

**Interfaces:**

- Consumes: the exact commands and structure created by Tasks 1-7.
- Produces: complete contributor onboarding, roadmap, and auditable Phase 0 progress.

- [ ] **Step 1: Write the public README**

Cover product purpose, honest current status, screenshots placeholder, architecture, planned features, technology stack, prerequisites, local installation, environment setup, Docker, development commands, repository structure, roadmap, contributing, security, and license.

- [ ] **Step 2: Write the phased project plan**

Record Phases 0-8 from the approved brief, refine each with goals and exit criteria, and mark only verified Phase 0 items complete.

- [ ] **Step 3: Initialize the changelog**

Use Keep a Changelog structure with an Unreleased section describing only completed foundation work.

- [ ] **Step 4: Update this implementation checklist with actual status**

Mark completed steps and leave failed or deferred work unchecked with a concise explanation.

- [ ] **Step 5: Verify all documentation references real files and commands**

Run each documented non-server root quality command and search documentation for stale package names, nonexistent paths, `TBD`, and unfinished `TODO` markers.

- [ ] **Step 6: Commit**

```bash
git add README.md PROJECT_PLAN.md CHANGELOG.md docs/superpowers/plans/2026-08-20-phase-0-foundation.md
git commit -m "docs: document phase 0 foundation"
```

### Task 9: Full Verification and Phase 0 Report

**Files:**

- Create: `docs/reports/phase-0-report.md`
- Modify: `CHANGELOG.md` only if verification reveals a documented deviation.

**Interfaces:**

- Consumes: every Phase 0 deliverable and root quality command.
- Produces: evidence-backed Phase 0 results and decisions required before Phase 1.

- [ ] **Step 1: Run clean installation verification**

Run: `pnpm install --frozen-lockfile`

Expected: exit code 0 with an unchanged lockfile.

- [ ] **Step 2: Run all quality gates independently**

Run each command separately and retain its exit code:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
docker compose --env-file .env.example config --quiet
```

- [ ] **Step 3: Inspect repository hygiene**

Run: `git status --short`, `git ls-files`, and a targeted tracked-file search for environment files, private keys, tokens, passwords outside `.env.example`, build output, and dependency directories.

- [ ] **Step 4: Write the Phase 0 report**

Document architecture, folder structure, created files, tooling, database setup, Docker setup, exact test/build/lint/type-check results, deviations, concerns, and the five deferred Phase 1 decisions from the approved design.

- [ ] **Step 5: Re-run checks affected by report changes**

Run: `pnpm format:check && git diff --check`

Expected: exit code 0.

- [ ] **Step 6: Commit the verified report**

```bash
git add docs/reports/phase-0-report.md CHANGELOG.md docs/superpowers/plans/2026-08-20-phase-0-foundation.md
git commit -m "docs: report phase 0 verification"
```

- [ ] **Step 7: Stop before Phase 1**

Report Phase 0 results and request explicit approval before implementing host registration or heartbeat behavior.
