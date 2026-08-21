# Phase 3 Realtime Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual command-console dashboard that loads current host state over REST and remains truthful and current through Server-Sent Events.

**Architecture:** Shared contracts define the browser-safe fleet snapshot and event envelope. A dedicated NestJS dashboard module reads current state from Prisma and exposes REST plus SSE, while agent application services publish persisted heartbeat and metric changes through an in-process event boundary. The React client owns routing, localization, snapshot reconciliation, and responsive presentation without adding a charting or global-state dependency.

**Tech Stack:** TypeScript 5.9, NestJS, Prisma, PostgreSQL, React 19, Vite 8, browser History and EventSource APIs, Jest/Vitest, Testing Library.

## Global Constraints

- Keep the dashboard unauthenticated and document that it is supported only on trusted local or self-hosted networks in Phase 3.
- Use REST for initial/current snapshots and SSE for one-way live updates.
- Preserve the existing 45-second server-derived offline threshold.
- Do not add historical charts, alert states, process data, user accounts, or remote-control behavior.
- Provide English and Turkish UI copy; detect Turkish browser locales initially and persist one global user choice locally.
- Never expose agent credential hashes, enrollment tokens, or unrelated machine information.
- Do not display cumulative network counters as transfer rates.
- Remain usable from 320px width, provide visible keyboard focus, text equivalents for status color, polite connection announcements, and reduced-motion support.
- Use the existing dark technical visual direction; do not introduce decorative gauges, gradients, or generic rounded-card styling.

---

### Task 1: Browser-safe dashboard contracts

**Files:**
- Create: `packages/contracts/src/dashboard.ts`
- Create: `packages/contracts/src/dashboard.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `HostAvailability` and system metric field semantics from existing contracts.
- Produces: `DashboardHost`, `DashboardMetric`, `DashboardFleetSnapshot`, `DashboardEvent`, `DASHBOARD_EVENT_TYPES`, and `isDashboardEvent(value: unknown): value is DashboardEvent`.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(isDashboardEvent({
  version: 1,
  type: 'host.metric',
  hostId,
  occurredAt,
  payload: metric,
})).toBe(true);
expect(isDashboardEvent({ version: 2, type: 'host.metric' })).toBe(false);
expect(JSON.stringify(metric)).not.toContain('credential');
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --filter @nexus-monitor/contracts test -- dashboard.test.ts`
Expected: FAIL because `dashboard.ts` and its exports do not exist.

- [ ] **Step 3: Implement exact public contracts and the narrow runtime event guard**

```ts
export interface DashboardMetric {
  readonly collectedAt: string;
  readonly cpuPercent: number;
  readonly memoryTotalBytes: string;
  readonly memoryUsedBytes: string;
  readonly diskTotalBytes: string;
  readonly diskUsedBytes: string;
  readonly diskFreeBytes: string;
  readonly networkReceivedBytes: string;
  readonly networkTransmittedBytes: string;
  readonly uptimeSeconds: string;
}

export interface DashboardHost {
  readonly id: string;
  readonly agentId: string;
  readonly hostname: string;
  readonly platform: string;
  readonly architecture: string;
  readonly agentVersion: string;
  readonly availability: 'online' | 'offline';
  readonly lastSeenAt: string | null;
  readonly latestMetric: DashboardMetric | null;
}

export interface DashboardFleetSnapshot {
  readonly generatedAt: string;
  readonly hosts: readonly DashboardHost[];
}

export const DASHBOARD_EVENT_TYPES = {
  metric: 'host.metric',
  status: 'host.status',
} as const;

export type DashboardEvent =
  | { readonly version: 1; readonly type: 'host.metric'; readonly hostId: string; readonly occurredAt: string; readonly payload: DashboardMetric }
  | { readonly version: 1; readonly type: 'host.status'; readonly hostId: string; readonly occurredAt: string; readonly payload: { readonly availability: 'online' | 'offline'; readonly lastSeenAt: string | null } };
```

- [ ] **Step 4: Run contract tests and build**

Run: `pnpm --filter @nexus-monitor/contracts test && pnpm --filter @nexus-monitor/contracts build`
Expected: all contract tests pass and declaration output builds.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/dashboard.ts packages/contracts/src/dashboard.test.ts packages/contracts/src/index.ts
git commit -m "feat: define realtime dashboard contracts"
```

### Task 2: Current fleet query boundary

**Files:**
- Create: `apps/api/src/dashboard/domain/dashboard-query.service.ts`
- Create: `apps/api/src/dashboard/domain/dashboard-query.service.test.ts`
- Create: `apps/api/src/dashboard/infrastructure/prisma-dashboard.repository.ts`
- Create: `apps/api/src/dashboard/infrastructure/prisma-dashboard.repository.test.ts`

**Interfaces:**
- Consumes: Prisma `Host`, `Agent`, and newest `SystemMetricSample`; existing `deriveAvailability(lastSeenAt, now)` policy.
- Produces: `DashboardRepository.listCurrentHosts()`, `DashboardRepository.findCurrentHost(hostId)`, `DashboardQueryService.listHosts()`, and `DashboardQueryService.getHost(hostId)`.

- [ ] **Step 1: Write failing service tests for mapping, BigInt serialization, latest sample, ordering, and not-found behavior**

```ts
const result = await service.listHosts();
expect(result.hosts[0]).toMatchObject({
  hostname: 'db-primary',
  availability: 'online',
  latestMetric: { memoryTotalBytes: '17179869184' },
});
expect(result.hosts[0]).not.toHaveProperty('credentialHash');
await expect(service.getHost(missingId)).resolves.toBeNull();
```

- [ ] **Step 2: Run focused service tests and confirm failure**

Run: `pnpm --filter @nexus-monitor/api test -- dashboard-query.service.test.ts`
Expected: FAIL because the query service does not exist.

- [ ] **Step 3: Implement repository records and service mapping**

```ts
export interface DashboardRepository {
  listCurrentHosts(): Promise<readonly DashboardHostRecord[]>;
  findCurrentHost(hostId: string): Promise<DashboardHostRecord | null>;
}

export class DashboardQueryService {
  public constructor(
    private readonly repository: DashboardRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  public async listHosts(): Promise<DashboardFleetSnapshot>;
  public async getHost(hostId: string): Promise<DashboardHost | null>;
}
```

Map all Prisma `bigint` metric values to decimal strings at this boundary. Sort online hosts before offline hosts, then hostname using a stable locale-independent comparison.

- [ ] **Step 4: Write failing Prisma repository tests**

Assert `findMany`/`findUnique` select only public host and agent fields and use `metricSamples: { orderBy: { collectedAt: 'desc' }, take: 1 }`.

- [ ] **Step 5: Implement the Prisma repository and run focused tests**

Run: `pnpm --filter @nexus-monitor/api test -- dashboard`
Expected: service and repository suites pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/dashboard/domain apps/api/src/dashboard/infrastructure
git commit -m "feat: query current dashboard host state"
```

### Task 3: Dashboard REST endpoints

**Files:**
- Create: `apps/api/src/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/dashboard/dashboard.controller.test.ts`
- Create: `apps/api/src/dashboard/dashboard.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/agents/agents.module.ts`

**Interfaces:**
- Consumes: `DashboardQueryService.listHosts()` and `getHost(hostId)`.
- Produces: `GET /api/v1/dashboard/hosts` and `GET /api/v1/dashboard/hosts/:hostId`.

- [ ] **Step 1: Write failing controller tests**

```ts
await request(app.getHttpServer())
  .get('/api/v1/dashboard/hosts')
  .expect(200)
  .expect(snapshot);
await request(app.getHttpServer())
  .get(`/api/v1/dashboard/hosts/${missingId}`)
  .expect(404);
await request(app.getHttpServer())
  .get('/api/v1/dashboard/hosts/not-a-uuid')
  .expect(400);
```

- [ ] **Step 2: Confirm endpoint tests fail**

Run: `pnpm --filter @nexus-monitor/api test -- dashboard.controller.test.ts`
Expected: FAIL because the controller route is absent.

- [ ] **Step 3: Implement the controller and module wiring**

Use Nest's UUID parsing for `hostId`, throw `NotFoundException('Host not found.')` only for a valid missing identifier, and export the shared Prisma provider from `AgentsModule` rather than creating a second client.

- [ ] **Step 4: Run controller tests and API typecheck**

Run: `pnpm --filter @nexus-monitor/api test -- dashboard.controller.test.ts && pnpm --filter @nexus-monitor/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/app.module.ts apps/api/src/agents/agents.module.ts apps/api/src/dashboard
git commit -m "feat: expose dashboard host snapshots"
```

### Task 4: Persisted-change event publication

**Files:**
- Create: `apps/api/src/dashboard/domain/dashboard-event.publisher.ts`
- Create: `apps/api/src/dashboard/domain/dashboard-event.publisher.test.ts`
- Modify: `apps/api/src/agents/domain/agent.service.ts`
- Modify: `apps/api/src/agents/domain/agent.service.test.ts`
- Modify: `apps/api/src/agents/domain/metric.service.ts`
- Modify: `apps/api/src/agents/domain/metric.service.test.ts`
- Modify: `apps/api/src/agents/agents.module.ts`

**Interfaces:**
- Consumes: successful heartbeat persistence and metric repository result `'inserted' | 'duplicate'`.
- Produces: `DashboardEventPublisher.publish(event)`, `subscribe(listener): () => void`, and persisted-change events.

- [ ] **Step 1: Write failing publisher and service tests**

```ts
const unsubscribe = publisher.subscribe(listener);
publisher.publish(event);
expect(listener).toHaveBeenCalledWith(event);
unsubscribe();

await metricService.ingest(agentId, token, sample);
expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'host.metric' }));
```

Also assert authentication failure, persistence failure, and duplicate metric ingestion publish nothing.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @nexus-monitor/api test -- dashboard-event.publisher.test.ts agent.service.test.ts metric.service.test.ts`
Expected: FAIL because publication is not implemented.

- [ ] **Step 3: Implement a synchronous in-process publisher and inject it into both services**

```ts
export type DashboardEventListener = (event: DashboardEvent) => void;

export class DashboardEventPublisher {
  public publish(event: DashboardEvent): void;
  public subscribe(listener: DashboardEventListener): () => void;
}
```

Publish only after repository success. Resolve the host identifier needed by metric events through the authenticated agent lookup without exposing credentials. Treat duplicate samples as acknowledged but do not republish them.

- [ ] **Step 4: Run focused tests and API typecheck**

Run: `pnpm --filter @nexus-monitor/api test -- dashboard-event.publisher.test.ts agent.service.test.ts metric.service.test.ts && pnpm --filter @nexus-monitor/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/dashboard/domain apps/api/src/agents
git commit -m "feat: publish persisted dashboard changes"
```

### Task 5: SSE stream and offline transitions

**Files:**
- Create: `apps/api/src/dashboard/dashboard-events.controller.ts`
- Create: `apps/api/src/dashboard/dashboard-events.controller.test.ts`
- Create: `apps/api/src/dashboard/domain/availability-monitor.ts`
- Create: `apps/api/src/dashboard/domain/availability-monitor.test.ts`
- Modify: `apps/api/src/dashboard/dashboard.module.ts`

**Interfaces:**
- Consumes: `DashboardEventPublisher`, `DashboardRepository`, existing offline policy.
- Produces: `GET /api/v1/dashboard/events`, keepalive comments, and exactly-once in-process offline transition publication.

- [ ] **Step 1: Write failing availability monitor tests**

Use a fake clock and explicit `check()` calls. Assert a host crossing 45 seconds publishes one offline event, repeated checks publish nothing, and a later heartbeat permits a future offline transition.

- [ ] **Step 2: Implement the monitor with a replaceable scheduler boundary**

```ts
export class AvailabilityMonitor {
  public async check(): Promise<void>;
  public start(): void;
  public stop(): void;
}
```

The production interval checks at 5-second cadence and is released on module shutdown. The monitor stores only last published availability in process memory and never modifies heartbeat rows.

- [ ] **Step 3: Write failing SSE lifecycle tests**

Assert the connection emits a ready message, serializes domain events using named SSE events, emits periodic keepalive comments, unsubscribes on disconnect, and clears timers.

- [ ] **Step 4: Implement stream lifecycle and run focused tests**

Use an RxJS `Observable<MessageEvent>` compatible with Nest `@Sse()`. Ensure teardown calls both publisher unsubscribe and keepalive cleanup.

Run: `pnpm --filter @nexus-monitor/api test -- availability-monitor.test.ts dashboard-events.controller.test.ts`
Expected: PASS with no open-handle warning.

- [ ] **Step 5: Run all API tests and commit**

Run: `pnpm --filter @nexus-monitor/api test`
Expected: all API suites pass.

```powershell
git add apps/api/src/dashboard
git commit -m "feat: stream realtime dashboard updates"
```

### Task 6: Frontend data, realtime, routing, and localization

**Files:**
- Create: `apps/web/src/dashboard/api.ts`
- Create: `apps/web/src/dashboard/api.test.ts`
- Create: `apps/web/src/dashboard/realtime.ts`
- Create: `apps/web/src/dashboard/realtime.test.ts`
- Create: `apps/web/src/dashboard/fleet-state.ts`
- Create: `apps/web/src/dashboard/fleet-state.test.ts`
- Create: `apps/web/src/dashboard/routing.ts`
- Create: `apps/web/src/dashboard/routing.test.ts`
- Create: `apps/web/src/i18n/messages.ts`
- Create: `apps/web/src/i18n/language.ts`
- Create: `apps/web/src/i18n/language.test.ts`

**Interfaces:**
- Consumes: shared dashboard contracts, `/api/v1/dashboard/hosts`, `/api/v1/dashboard/events`, browser locale and localStorage.
- Produces: `fetchFleetSnapshot(signal)`, `openDashboardEvents(handlers)`, `reduceFleet(state, action)`, `readHostRoute(pathname)`, `navigateToHost(hostId)`, `detectLanguage()`, `loadLanguage()`, and `saveLanguage(language)`.

- [ ] **Step 1: Write failing API and fleet reducer tests**

```ts
await expect(fetchFleetSnapshot(signal)).resolves.toEqual(snapshot);
expect(reduceFleet(state, { type: 'event', event: metricEvent }).hosts[0]?.latestMetric).toEqual(metric);
expect(reduceFleet(state, { type: 'event', event: unknownHostEvent })).toEqual(state);
```

- [ ] **Step 2: Implement fetch and immutable per-host reconciliation**

Throw a concise `DashboardRequestError` for non-2xx or malformed responses. Abort obsolete loads. Replace the complete snapshot after reconnection; merge only known-host events between snapshots.

- [ ] **Step 3: Write failing EventSource and language tests**

Assert named `host.metric` and `host.status` event parsing, malformed-event rejection, error callback behavior, close cleanup, route parsing/navigation/popstate behavior, Turkish locale detection, English fallback, valid stored preference, and invalid stored-value fallback.

- [ ] **Step 4: Implement realtime and localization modules**

```ts
export type Language = 'en' | 'tr';
export const LANGUAGE_STORAGE_KEY = 'nexus-monitor.language';
export function detectLanguage(languages?: readonly string[]): Language;
export function loadLanguage(storage?: Storage): Language;
export function saveLanguage(language: Language, storage?: Storage): void;
```

Use the browser History API through the focused routing module. Do not add a router, state library, i18n framework, or chart library for this two-route application.

- [ ] **Step 5: Run focused web tests and commit**

Run: `pnpm --filter @nexus-monitor/web test -- src/dashboard src/i18n`
Expected: PASS.

```powershell
git add apps/web/src/dashboard apps/web/src/i18n
git commit -m "feat: manage live bilingual fleet state"
```

### Task 7: Command-console dashboard interface

**Files:**
- Create: `apps/web/src/dashboard/use-dashboard.ts`
- Create: `apps/web/src/dashboard/use-dashboard.test.tsx`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/fleet-sidebar.tsx`
- Create: `apps/web/src/components/host-detail.tsx`
- Create: `apps/web/src/components/metric-reading.tsx`
- Create: `apps/web/src/components/dashboard-states.tsx`
- Create: `apps/web/src/components/format.ts`
- Create: `apps/web/src/components/format.test.ts`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app.test.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: fleet state modules, focused History API routing module, localized message dictionaries.
- Produces: responsive `/` and `/hosts/:hostId` UI with truthful connection and data states.

- [ ] **Step 1: Replace the foundation test with failing user-flow tests**

Test initial loading, fleet totals, search, host selection, canonical navigation, direct detail route, missing host, empty fleet, request retry, missing metrics, reconnecting/live state, EN/TR switching and persistence.

```tsx
expect(await screen.findByRole('heading', { name: 'web-prod-01' })).toBeVisible();
await user.click(screen.getByRole('button', { name: 'Türkçe' }));
expect(screen.getByText('Çevrimiçi')).toBeVisible();
expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('tr');
```

- [ ] **Step 2: Run the App tests and confirm failure**

Run: `pnpm --filter @nexus-monitor/web test -- src/app.test.tsx`
Expected: FAIL because the dashboard UI is absent.

- [ ] **Step 3: Implement the dashboard hook and semantic component structure**

The hook performs initial snapshot load, opens EventSource only after success, marks connection `connecting | live | reconnecting`, and refreshes the snapshot before returning from reconnecting to live. Components receive plain typed props and contain no network calls.

- [ ] **Step 4: Implement deterministic formatters and their tests**

```ts
export function formatBytes(value: string, language: Language): string;
export function formatDuration(seconds: string, messages: Messages): string;
export function formatTimestamp(value: string | null, language: Language): string;
export function formatPercent(value: number): string;
```

Use `Intl.NumberFormat`/`Intl.DateTimeFormat`, preserve cumulative network labels, and return localized unavailable copy for null data.

- [ ] **Step 5: Implement the approved visual system and responsive behavior**

Use CSS custom properties, bordered square panels, compact spacing, visible `:focus-visible`, status text plus icon, `aria-current` for the selected host, a polite connection-status live region, 320px layout support, and `prefers-reduced-motion`. On mobile, selecting a host shows detail with a focusable back-to-fleet control.

- [ ] **Step 6: Run web tests, typecheck, and build**

Run: `pnpm --filter @nexus-monitor/web test && pnpm --filter @nexus-monitor/web typecheck && pnpm --filter @nexus-monitor/web build`
Expected: all pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src
git commit -m "feat: build realtime command console dashboard"
```

### Task 8: Integration, documentation, and Phase 3 verification

**Files:**
- Modify: `apps/web/vite.config.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `CHANGELOG.md`
- Create: `docs/reports/phase-3-report.md`
- Test: existing and new repository test suites

**Interfaces:**
- Consumes: complete dashboard API, SSE stream, and React application.
- Produces: documented local development flow and verified Phase 3 report.

- [ ] **Step 1: Add the development API proxy and document its tested boundary**

Configure Vite `/api` proxy to the environment-controlled local API origin, including SSE. Keep production API origin configuration explicit and same-origin by default.

- [ ] **Step 2: Update public documentation**

Document the realtime dashboard, EN/TR behavior, trusted-network limitation, API plus web startup commands, and the fact that charts/alerts remain future work. Mark Phase 3 complete in `PROJECT_PLAN.md` only after verification passes.

- [ ] **Step 3: Run repository quality gates**

Run in order:

```powershell
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:format
pnpm prisma:validate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose config
```

Expected: every command exits successfully. If Docker engine access remains unavailable, `docker compose config` must still pass and the limitation must be recorded without claiming a live PostgreSQL integration run.

- [ ] **Step 4: Run local browser smoke tests**

Start the API and web app with development configuration and representative local data. Verify desktop and 320px layouts, host routing, EN/TR persistence, live metric update, offline transition, reconnecting indicator, loading/empty/error states, keyboard navigation, browser console, and network stream cleanup. Capture screenshots only for verification; public screenshot curation remains Phase 8.

- [ ] **Step 5: Write the verification report**

Record exact command outcomes, automated test counts, browser scenarios, deviations, Docker/PostgreSQL constraints, security boundary, and remaining Phase 4 concerns in `docs/reports/phase-3-report.md`.

- [ ] **Step 6: Commit documentation and report**

```powershell
git add apps/web/vite.config.ts .env.example README.md PROJECT_PLAN.md CHANGELOG.md docs/reports/phase-3-report.md
git commit -m "docs: report phase 3 verification"
```

- [ ] **Step 7: Confirm the branch is ready for manual integration**

Run: `git status --short --branch` and `git log --oneline --decorate -12`
Expected: no tracked changes, only intentional ignored local tooling files, and Phase 3 commits based on Phase 2 commit `069db1f`.
