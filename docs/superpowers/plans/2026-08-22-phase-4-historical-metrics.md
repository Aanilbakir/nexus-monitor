# Phase 4 Historical Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded, database-aggregated historical metric queries and accessible CPU/memory, disk, and network charts to the realtime host dashboard.

**Architecture:** PostgreSQL performs fixed-resolution aggregation behind the existing dashboard repository. A domain-owned range policy maps five allow-listed ranges to bounded UTC windows and bucket sizes, while a typed REST contract carries the result. The React dashboard keeps historical requests separate from realtime fleet state and renders dependency-free responsive SVG charts.

**Tech Stack:** Node.js 24, strict TypeScript, NestJS 11, Prisma 7 raw parameterized SQL, PostgreSQL 17, React 19, SVG, Jest, Vitest, Testing Library, Playwright.

## Global Constraints

- Supported ranges are exactly `1h`, `6h`, `24h`, `7d`, and `30d`.
- Bucket durations are exactly 60, 300, 900, 7,200, and 21,600 seconds respectively.
- A response contains no more than the selected range's expected bucket count plus one boundary bucket.
- PostgreSQL performs aggregation; the API must not materialize all raw samples.
- Missing buckets remain gaps and no layer invents historical values.
- Negative network counter deltas are clamped to zero.
- The default frontend range is `24h`.
- Historical request state remains separate from Phase 3 snapshot/SSE state.
- No chart framework or new runtime dependency is added.
- All new user-facing copy is available in English and Turkish.

---

### Task 1: Historical Metrics Contract

**Files:**

- Modify: `packages/contracts/src/dashboard.ts`
- Modify: `packages/contracts/src/dashboard.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces: `HISTORY_RANGES`, `HistoryRange`, `DashboardHistoryPoint`, `DashboardHistoryResponse`, `isDashboardHistoryResponse(value: unknown): value is DashboardHistoryResponse`.

- [ ] **Step 1: Write failing contract tests**

Add tests proving that every approved range and a complete response pass, and that unknown ranges, unsorted timestamps, invalid percentages, negative byte strings, malformed timestamps, and mismatched `hostId` shapes fail.

```ts
expect(isDashboardHistoryResponse(validHistory)).toBe(true);
expect(isDashboardHistoryResponse({ ...validHistory, range: '90d' })).toBe(
  false,
);
expect(
  isDashboardHistoryResponse({
    ...validHistory,
    points: [validHistory.points[1], validHistory.points[0]],
  }),
).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `pnpm --filter @nexus-monitor/contracts test -- dashboard.test.ts`

Expected: FAIL because the history exports do not exist.

- [ ] **Step 3: Implement the strict contract**

```ts
export const HISTORY_RANGES = ['1h', '6h', '24h', '7d', '30d'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export interface DashboardHistoryPoint {
  readonly bucketAt: string;
  readonly cpuPercent: number | null;
  readonly diskUsedPercent: number | null;
  readonly memoryUsedPercent: number | null;
  readonly networkReceivedBytes: string;
  readonly networkTransmittedBytes: string;
}

export interface DashboardHistoryResponse {
  readonly bucketSeconds: number;
  readonly endAt: string;
  readonly hostId: string;
  readonly points: readonly DashboardHistoryPoint[];
  readonly range: HistoryRange;
  readonly startAt: string;
}
```

Validate ISO timestamps, finite percentages in `[0, 100]` or `null`, unsigned decimal byte strings, strictly ascending point timestamps, and positive integer `bucketSeconds`.

- [ ] **Step 4: Run contract tests, typecheck, and build**

Run:

```bash
pnpm --filter @nexus-monitor/contracts test
pnpm --filter @nexus-monitor/contracts typecheck
pnpm --filter @nexus-monitor/contracts build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src
git commit -m "feat: define historical dashboard contracts"
```

### Task 2: Range Policy and Domain Query

**Files:**

- Create: `apps/api/src/dashboard/domain/history-range.ts`
- Create: `apps/api/src/dashboard/domain/history-range.test.ts`
- Modify: `apps/api/src/dashboard/domain/dashboard-query.service.ts`
- Modify: `apps/api/src/dashboard/domain/dashboard-query.service.test.ts`

**Interfaces:**

- Consumes: `HistoryRange`, `DashboardHistoryResponse`.
- Produces: `HISTORY_RANGE_POLICIES`, `getHistoryPolicy(range: HistoryRange): HistoryRangePolicy`, `DashboardHistoryRecord`, `DashboardRepository.listHistory(agentId, startAt, endAt, bucketSeconds)`, and `DashboardQueryService.getHistory(hostId, range)`.

- [ ] **Step 1: Write failing policy and service tests**

Use a fixed clock and verify every exact mapping:

```ts
expect(HISTORY_RANGE_POLICIES).toEqual({
  '1h': {
    bucketSeconds: 60,
    durationMilliseconds: 3_600_000,
    maximumPoints: 61,
  },
  '6h': {
    bucketSeconds: 300,
    durationMilliseconds: 21_600_000,
    maximumPoints: 73,
  },
  '24h': {
    bucketSeconds: 900,
    durationMilliseconds: 86_400_000,
    maximumPoints: 97,
  },
  '7d': {
    bucketSeconds: 7_200,
    durationMilliseconds: 604_800_000,
    maximumPoints: 85,
  },
  '30d': {
    bucketSeconds: 21_600,
    durationMilliseconds: 2_592_000_000,
    maximumPoints: 121,
  },
});
```

Verify `getHistory` returns `null` for an unknown host, queries the current agent with exact UTC bounds, maps bigint byte deltas to strings, and rejects a repository result beyond `maximumPoints` with `Error('Historical metric query exceeded its point limit.')`.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --filter @nexus-monitor/api test -- history-range.test.ts dashboard-query.service.test.ts`

Expected: FAIL because the policy and query method do not exist.

- [ ] **Step 3: Implement policy and repository-facing records**

```ts
export interface HistoryRangePolicy {
  readonly bucketSeconds: number;
  readonly durationMilliseconds: number;
  readonly maximumPoints: number;
}

export interface DashboardHistoryRecord {
  readonly bucketAt: Date;
  readonly cpuPercent: number | null;
  readonly diskUsedPercent: number | null;
  readonly memoryUsedPercent: number | null;
  readonly networkReceivedBytes: bigint;
  readonly networkTransmittedBytes: bigint;
}
```

`getHistory` first resolves the current host/agent, calculates `endAt` once from the injected clock, derives `startAt`, calls `listHistory`, verifies the point bound, and maps records into the shared contract.

- [ ] **Step 4: Run focused and API tests**

Run:

```bash
pnpm --filter @nexus-monitor/api test -- history-range.test.ts dashboard-query.service.test.ts
pnpm --filter @nexus-monitor/api typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard/domain
git commit -m "feat: define bounded history query policy"
```

### Task 3: PostgreSQL Historical Aggregation

**Files:**

- Modify: `apps/api/src/dashboard/infrastructure/prisma-dashboard.repository.ts`
- Modify: `apps/api/src/dashboard/infrastructure/prisma-dashboard.repository.test.ts`

**Interfaces:**

- Consumes: `listHistory(agentId: string, startAt: Date, endAt: Date, bucketSeconds: number)`.
- Produces: chronologically ordered `DashboardHistoryRecord[]` using parameterized Prisma SQL.

- [ ] **Step 1: Write failing repository tests**

Mock `$queryRaw` and verify the repository maps decimal averages to numbers, byte deltas to bigint, preserves `null` percentages, orders points, and passes agent/time/bucket values as SQL parameters rather than interpolation. Add a SQL text assertion for `LAG`, `GREATEST`, and the bounded `collectedAt` predicates.

- [ ] **Step 2: Run the focused test and verify red**

Run: `pnpm --filter @nexus-monitor/api test -- prisma-dashboard.repository.test.ts`

Expected: FAIL because `listHistory` is missing.

- [ ] **Step 3: Implement the query**

Use a CTE with these stages:

```sql
WITH ordered AS (
  SELECT
    "collectedAt",
    "cpuPercent",
    "memoryUsedBytes",
    "memoryTotalBytes",
    "diskUsedBytes",
    "diskTotalBytes",
    GREATEST("networkReceivedBytes" - LAG("networkReceivedBytes") OVER (ORDER BY "collectedAt"), 0) AS received_delta,
    GREATEST("networkTransmittedBytes" - LAG("networkTransmittedBytes") OVER (ORDER BY "collectedAt"), 0) AS transmitted_delta
  FROM "SystemMetricSample"
  WHERE "agentId" = $1
    AND "collectedAt" >= $2
    AND "collectedAt" <= $3
), bucketed AS (
  SELECT to_timestamp(floor(extract(epoch FROM "collectedAt") / $4) * $4) AS bucket_at, *
  FROM ordered
)
SELECT bucket_at,
       AVG("cpuPercent") AS cpu_percent,
       AVG(("memoryUsedBytes"::numeric / NULLIF("memoryTotalBytes", 0)) * 100) AS memory_used_percent,
       AVG(("diskUsedBytes"::numeric / NULLIF("diskTotalBytes", 0)) * 100) AS disk_used_percent,
       COALESCE(SUM(received_delta), 0) AS network_received_bytes,
       COALESCE(SUM(transmitted_delta), 0) AS network_transmitted_bytes
FROM bucketed
GROUP BY bucket_at
ORDER BY bucket_at ASC
```

Load the SQL as a repository-local constant or express the same query with `Prisma.sql`; do not concatenate inputs into SQL text.

- [ ] **Step 4: Run repository tests and API typecheck**

Run:

```bash
pnpm --filter @nexus-monitor/api test -- prisma-dashboard.repository.test.ts
pnpm --filter @nexus-monitor/api typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard/infrastructure
git commit -m "feat: aggregate bounded historical metrics"
```

### Task 4: History REST Endpoint

**Files:**

- Create: `apps/api/src/dashboard/dto/history-query.dto.ts`
- Create: `apps/api/src/dashboard/dto/history-query.dto.test.ts`
- Modify: `apps/api/src/dashboard/dashboard.controller.ts`
- Modify: `apps/api/src/dashboard/dashboard.controller.test.ts`

**Interfaces:**

- Consumes: `DashboardQueryService.getHistory(hostId, range)`.
- Produces: `GET /dashboard/hosts/:hostId/history?range=...` beneath the existing global `/api/v1` prefix.

- [ ] **Step 1: Write failing DTO/controller tests**

Test all five accepted values, rejection of missing and unknown values, UUID validation, successful response forwarding, and `NotFoundException('Host not found.')`.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --filter @nexus-monitor/api test -- history-query.dto.test.ts dashboard.controller.test.ts`

Expected: FAIL because the DTO and controller method are absent.

- [ ] **Step 3: Implement allow-listed validation and route ordering**

```ts
export class HistoryQueryDto {
  @IsIn(HISTORY_RANGES)
  public range!: HistoryRange;
}

@Get(':hostId/history')
public async getHistory(
  @Param('hostId', new ParseUUIDPipe({ version: '4' })) hostId: string,
  @Query() query: HistoryQueryDto,
): Promise<DashboardHistoryResponse> { /* map null to 404 */ }
```

Keep the static history suffix from being captured by another route and reuse the global validation pipe.

- [ ] **Step 4: Run all API tests, typecheck, and build**

Run:

```bash
pnpm --filter @nexus-monitor/api test
pnpm --filter @nexus-monitor/api typecheck
pnpm --filter @nexus-monitor/api build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/dashboard
git commit -m "feat: expose historical metric ranges"
```

### Task 5: Frontend Historical Request State

**Files:**

- Modify: `apps/web/src/dashboard/api.ts`
- Modify: `apps/web/src/dashboard/api.test.ts`
- Create: `apps/web/src/dashboard/use-history.ts`
- Create: `apps/web/src/dashboard/use-history.test.tsx`

**Interfaces:**

- Consumes: `DashboardHistoryResponse`, `HistoryRange`, `isDashboardHistoryResponse`.
- Produces: `fetchHostHistory(hostId, range, signal)` and `useHistory(hostId)` returning `{ data, loadState, range, retry, setRange }`.

- [ ] **Step 1: Write failing fetch and hook tests**

Verify encoded host/range URL construction, signal forwarding, non-OK responses, invalid response rejection, default `24h`, abort on host/range change, stale-response protection, retry, success, error, and empty success.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --filter @nexus-monitor/web test -- src/dashboard/api.test.ts src/dashboard/use-history.test.tsx`

Expected: FAIL because history fetch/state APIs are absent.

- [ ] **Step 3: Implement the independent state boundary**

```ts
export interface HistoryState {
  readonly data: DashboardHistoryResponse | null;
  readonly loadState: 'loading' | 'ready' | 'error';
  readonly range: HistoryRange;
  readonly retry: () => void;
  readonly setRange: (range: HistoryRange) => void;
}
```

Use one effect keyed by `hostId`, `range`, and retry version. Abort on cleanup and ignore abort errors. Clear old data when the active host changes so one host's graph is never labeled as another host.

- [ ] **Step 4: Run focused tests and web typecheck**

Run:

```bash
pnpm --filter @nexus-monitor/web test -- src/dashboard/api.test.ts src/dashboard/use-history.test.tsx
pnpm --filter @nexus-monitor/web typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/dashboard
git commit -m "feat: manage historical dashboard state"
```

### Task 6: Accessible SVG Chart Primitive

**Files:**

- Create: `apps/web/src/components/history/chart-model.ts`
- Create: `apps/web/src/components/history/chart-model.test.ts`
- Create: `apps/web/src/components/history/time-series-chart.tsx`
- Create: `apps/web/src/components/history/time-series-chart.test.tsx`

**Interfaces:**

- Produces: pure `createChartModel(points, series, width, height)` and `TimeSeriesChart` with localized labels, summaries, SVG paths, and focus details.

- [ ] **Step 1: Write failing model and component tests**

Cover zero-to-100 percent scaling, automatic byte scaling, identical values, empty input, missing-value path breaks, clamping, latest/minimum/maximum summaries, accessible title/description, dashed secondary series, pointer detail, and keyboard-focus detail.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --filter @nexus-monitor/web test -- src/components/history`

Expected: FAIL because chart files do not exist.

- [ ] **Step 3: Implement pure geometry and SVG rendering**

Use a fixed `viewBox="0 0 720 240"`, chart padding, deterministic linear scales, and one path segment per contiguous non-null sequence. Render semantic text summaries outside the SVG and use `tabIndex={0}` interaction targets for the active sample details. Do not animate path geometry.

- [ ] **Step 4: Run focused tests and accessibility assertions**

Run:

```bash
pnpm --filter @nexus-monitor/web test -- src/components/history
pnpm --filter @nexus-monitor/web typecheck
```

Expected: all commands pass with no accessibility query failures.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/history
git commit -m "feat: render accessible historical charts"
```

### Task 7: Dashboard History Panel and Bilingual UX

**Files:**

- Create: `apps/web/src/components/history/history-panel.tsx`
- Create: `apps/web/src/components/history/history-panel.test.tsx`
- Modify: `apps/web/src/components/host-detail.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**

- Consumes: `useHistory`, `TimeSeriesChart`, the selected `DashboardHost`, current `Language`, and `Messages`.
- Produces: three chart groups, fixed range selector, chart-local loading/error/empty states, and responsive command-console styling.

- [ ] **Step 1: Write failing panel and application-flow tests**

Test the default 24-hour request, all five range buttons, CPU/memory pairing, disk chart, received/transmitted network pairing, retry, empty copy, host-change request, preserved current telemetry during history loading, and EN/TR labels.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm --filter @nexus-monitor/web test -- src/components/history/history-panel.test.tsx src/app.test.tsx`

Expected: FAIL because the panel and copy do not exist.

- [ ] **Step 3: Implement panel composition and copy**

Mount history below the current telemetry section. Render range controls as an accessible labelled group with `aria-pressed`. Use the existing state-view visual vocabulary for local loading/error/empty messages, but keep the host header and current metrics mounted.

- [ ] **Step 4: Add responsive styles**

Extend the existing token system. Use a one-column chart stack, compact series legends, visible keyboard focus, `min-width: 0`, and SVG `width: 100%`. At 375px the document width must remain 375px or less.

- [ ] **Step 5: Run all web checks**

Run:

```bash
pnpm --filter @nexus-monitor/web test
pnpm --filter @nexus-monitor/web typecheck
pnpm --filter @nexus-monitor/web build
```

Expected: all tests pass and Vite produces a production bundle.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat: add bilingual historical dashboard charts"
```

### Task 8: Performance Evidence, Documentation, and Phase Verification

**Files:**

- Create: `apps/api/src/dashboard/infrastructure/history-query.performance.test.ts`
- Create: `docs/reports/phase-4-report.md`
- Modify: `README.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: completed endpoint and UI.
- Produces: repeatable representative-data evidence and Phase 4 handoff documentation.

- [ ] **Step 1: Add a representative-data performance test**

Generate 172,800 logical samples (30 days at 15 seconds) without committing fixture data. Exercise the aggregation boundary with a PostgreSQL integration test when `DATABASE_URL` is available; assert at most 121 points, ascending buckets, and a bounded query plan using the `agentId, collectedAt` index. Keep the test explicitly integration-tagged and fail with a clear configuration message when invoked without a database.

- [ ] **Step 2: Run the performance verification against local PostgreSQL**

Run:

```bash
docker compose up -d postgres
pnpm exec prisma migrate deploy
pnpm --filter @nexus-monitor/api test -- history-query.performance.test.ts
```

Expected: the test reports at most 121 points and an indexed bounded plan. Record the measured duration and plan summary in `docs/reports/phase-4-report.md`.

- [ ] **Step 3: Update project documentation**

Document the history endpoint, fixed range policy, chart behavior, trusted-network boundary, and Phase 4 completion. Mark Phase 4 complete only after the performance and full verification steps pass.

- [ ] **Step 4: Run browser verification**

Serve the production web bundle with representative history responses and controlled SSE. Verify desktop 1440px and mobile 375px views, all range controls, keyboard focus details, EN/TR switching, loading/error/empty states, no horizontal overflow, and no console errors. Save verification screenshots outside the repository.

- [ ] **Step 5: Run every repository quality gate**

Run:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
docker compose config --quiet
```

Expected: every command exits zero. If the environment prevents a command, record the exact command, error, and narrower checks used; do not mark the phase complete without equivalent fresh evidence.

- [ ] **Step 6: Commit**

```bash
git add README.md PROJECT_PLAN.md CHANGELOG.md docs/reports/phase-4-report.md apps/api/src/dashboard/infrastructure/history-query.performance.test.ts
git commit -m "docs: complete phase 4 historical metrics"
```
