# Phase 4 Historical Metrics and Charts Design

## Objective

Phase 4 adds bounded historical metric queries and accessible time-series charts to the Phase 3 host dashboard. Operators can inspect CPU, memory, disk, and network behavior over fixed time ranges without weakening the existing realtime path or loading unbounded raw samples into the API.

## Scope

The phase includes five fixed ranges: one hour, six hours, 24 hours, seven days, and 30 days. It adds a typed history endpoint, database-side aggregation, a cancellable frontend query boundary, and three responsive SVG charts.

Custom date ranges, zoom and pan, exports, host comparison, alert overlays, retention management, and precomputed rollup tables remain outside Phase 4.

## Historical Query Contract

The API exposes:

```text
GET /api/v1/dashboard/hosts/:hostId/history?range=1h|6h|24h|7d|30d
```

The response contains:

- the host identifier;
- the selected range;
- the UTC start and end timestamps used by the query;
- the bucket duration in seconds;
- chronologically ordered metric points.

Each point contains its bucket timestamp, average CPU percentage, average memory-used percentage, average disk-used percentage, received network bytes, and transmitted network bytes. Numeric values crossing the JSON safe-integer boundary use the repository's existing decimal-string convention.

Only the five named ranges are accepted. Callers cannot provide raw timestamps or arbitrary bucket sizes. An invalid range returns `400`; an unknown host returns `404`.

## Range and Resolution Policy

| Range    | Bucket duration | Maximum expected buckets |
| -------- | --------------: | -----------------------: |
| 1 hour   |        1 minute |                       60 |
| 6 hours  |       5 minutes |                       72 |
| 24 hours |      15 minutes |                       96 |
| 7 days   |         2 hours |                       84 |
| 30 days  |         6 hours |                      120 |

The service calculates one request-scoped UTC end time and derives the start time from it. Repository queries are bounded by host, start time, and end time and use the existing host/time metric index. Results must never exceed the range's maximum expected bucket count plus one boundary bucket.

## Aggregation

Aggregation runs in PostgreSQL rather than loading raw samples into Node.js. Samples are ordered within the bounded window, network deltas are calculated with the previous sample through a window function, and samples are then assigned to fixed epoch-aligned buckets using the approved bucket duration.

Each bucket calculates:

- average CPU percentage;
- average of `memoryUsedBytes / memoryTotalBytes * 100`;
- average of `diskUsedBytes / diskTotalBytes * 100`;
- sum of non-negative received-byte deltas from the cumulative counter;
- sum of non-negative transmitted-byte deltas from the cumulative counter.

Zero-sized totals are excluded from percentage averages. The first sample in the requested window has no earlier in-window baseline and contributes zero network bytes. Network counter resets do not produce negative traffic: a negative delta is clamped to zero. Buckets without samples are omitted and remain visible as gaps in the chart; neither API nor UI invents values.

The SQL remains isolated behind the dashboard repository interface. The domain service owns range policy, time-bound calculation, response mapping, and host-not-found behavior. The controller owns transport validation only.

## Frontend Data Flow

Historical state remains independent from the Phase 3 fleet snapshot and Server-Sent Events state.

1. The selected host and range identify a history request.
2. Changing either aborts the previous request through `AbortController`.
3. The latest successful response is rendered only if it belongs to the active host and range.
4. Loading, error, retry, and empty states are confined to the chart region; current telemetry and fleet navigation remain usable.
5. Phase 3 SSE events continue to update current metric cards. They do not mutate historical chart points.

The default range is 24 hours. Range selection is reflected in component state but not added to the URL in Phase 4. English and Turkish labels extend the existing global language system.

## Chart Design

The history section appears below current telemetry and contains a compact range selector followed by three charts:

1. CPU and memory percentage lines share a zero-to-100 percent scale.
2. Disk-used percentage uses its own zero-to-100 percent chart.
3. Received and transmitted network-byte deltas share an automatically scaled byte chart.

Charts use focused, dependency-free SVG components so the project controls rendering, responsive behavior, and accessibility without introducing a charting framework. The existing dark command-console visual language remains unchanged.

SVG paths break across missing buckets. Hover and keyboard focus expose the timestamp and series values. Each chart has an accessible title and description plus visible latest, minimum, and maximum summaries. Color is not the only series distinction: labels, line styles, and focus details identify each series.

Mobile charts retain the same information hierarchy, use a horizontally constrained SVG viewport, and never introduce page-level horizontal scrolling.

## Error Handling and Security

- Range input is allow-listed before repository access.
- Host identifiers continue through the existing route validation conventions.
- All history queries have fixed time and result bounds.
- Database failures flow through the existing NestJS error boundary without exposing SQL details.
- An empty successful result is distinct from a failed request.
- Dashboard history remains within the Phase 3 trusted local/self-hosted security boundary. Authentication and authorization remain Phase 7 work.

## Testing and Performance Evidence

Contract tests validate every range and reject malformed history responses. Repository tests verify SQL parameters, ordering, percentage aggregation, counter resets, and output mapping. Service and controller tests cover time bounds, resolution selection, `400`, `404`, empty history, and successful responses.

Frontend unit tests cover scales, path gaps, number/time formatting, abort behavior, stale-response protection, retry, and EN/TR copy. Application tests cover host changes, range changes, loading, error, and empty chart states. Browser verification covers desktop and mobile rendering, keyboard interaction, language switching, and horizontal overflow.

A representative 30-day dataset at the 15-second collection cadence is used to record query behavior. Verification must demonstrate that the database performs bounded aggregation, the returned point count stays within policy, and the endpoint does not materialize all raw samples in application memory.

## Completion Criteria

Phase 4 is complete when all five ranges return correctly aggregated and bounded data, the three chart groups render accessible historical trends, request and empty states are honest, existing realtime behavior remains intact, performance evidence is documented, and repository-wide format, lint, typecheck, test, build, Prisma, Docker Compose, and desktop/mobile browser checks pass.
