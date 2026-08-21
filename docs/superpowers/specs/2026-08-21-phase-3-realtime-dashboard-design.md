# Phase 3: Realtime Dashboard Design

## Objective

Phase 3 turns the existing dashboard shell into a trustworthy live operations console. It lists monitored hosts, exposes the latest stored system metrics, and updates visible state without a page refresh.

This phase does not add historical charts, alert evaluation, process data, user accounts, or remote control. Those capabilities remain in later phases of the project plan.

## Product Scope

The dashboard provides:

- fleet totals for all, online, and offline hosts;
- a searchable host list with current availability;
- a host detail view with identity, operating system, agent, and heartbeat information;
- the latest CPU, memory, disk, network, and uptime measurements;
- live updates with explicit connection freshness;
- English and Turkish interface text;
- accessible loading, empty, partial-data, error, and reconnecting states;
- responsive behavior for desktop and mobile layouts.

The dashboard is unauthenticated in Phase 3 and is intended only for trusted local or self-hosted environments. Public exposure is unsupported until the authentication and hardening work planned for Phase 7.

## Chosen Approach

The browser loads its initial snapshot through REST and receives subsequent changes through Server-Sent Events (SSE).

SSE fits the current one-way server-to-dashboard data flow, reconnects using browser primitives, and has less protocol and lifecycle complexity than WebSocket. Periodic REST polling would be simpler but would add avoidable latency and repeated full-snapshot reads. WebSocket remains an option for a future phase if the dashboard gains bidirectional commands.

## Information Architecture

The desktop layout is a command console:

- A compact top bar contains the NEXUS Monitor identity, fleet connection state, and EN/TR language control.
- A narrow left panel contains fleet totals, host search, and the persistent host list.
- The main panel contains the selected host's status, metadata, metric readings, and freshness information.
- The selected host is represented by `/hosts/:hostId`, making reloads and shared local URLs deterministic.
- `/` selects the first available host and navigates to its canonical URL. If there are no hosts, it remains on the fleet empty state.

On narrow screens, the list and detail become sequential views. Selecting a host opens its detail view, and an explicit back control returns to the list. No hover-only action is required.

## Visual Direction

The interface extends the existing dark, technical foundation instead of replacing it with a generic card dashboard.

- Square or minimally rounded panels use borders and spacing for hierarchy.
- Muted neutral text supports a restrained green online accent and a distinct offline/error accent.
- Monospaced typography is reserved for identifiers, labels, timestamps, and measured values.
- Metrics remain dense and readable without decorative gauges or fabricated charts.
- Motion is limited to meaningful connection and value transitions and respects reduced-motion preferences.
- Keyboard focus, contrast, labels, and live-region behavior are designed as first-class states.

Historical lines, sparklines, and time-range controls are excluded because Phase 4 owns historical queries and charts.

## API Design

### Initial snapshot

`GET /api/v1/dashboard/hosts` returns a bounded fleet snapshot. Each item includes:

- host and agent identifiers;
- hostname and available operating-system metadata;
- derived online/offline state and last heartbeat time;
- the latest metric sample when one exists.

The response contains current data only. It does not expose enrollment credentials, credential hashes, or unrelated machine information.

### Host detail

`GET /api/v1/dashboard/hosts/:hostId` returns the same current-state contract for one host. A missing host produces a normal not-found response that the frontend can distinguish from transport failure.

### Realtime stream

`GET /api/v1/dashboard/events` exposes an SSE stream. Events use a small versioned envelope with an event type, host identifier, occurrence time, and payload. Phase 3 publishes:

- `host.status` after an accepted heartbeat or availability-boundary transition changes a host's state;
- `host.metric` after a new metric sample is persisted;
- a lightweight connection-ready event when the stream opens.

The stream sends keepalive traffic so intermediaries and the client can detect a dead connection. It does not replay historical metric data. After reconnect, the client refreshes the REST snapshot before treating the view as current, preventing gaps from being presented as complete state.

## Backend Boundaries

Dashboard queries live in a dedicated module rather than being added to agent-ingestion controllers. A dashboard query service reads normalized current state from repositories and maps it to public response contracts.

Realtime publication is separated from persistence and controller code through a small event publisher boundary. Heartbeat and metric application services publish only after successful persistence. The SSE controller subscribes to those domain-facing notifications and serializes public events.

Availability remains derived from the existing 45-second heartbeat boundary. The frontend displays the server-derived state and does not invent a competing timeout rule.

A lightweight server-side availability monitor detects when an online host crosses that boundary and publishes one offline transition. It does not rewrite heartbeat history or create a second source of truth. A later accepted heartbeat publishes the corresponding online transition.

The Phase 3 event publisher is suitable for the current single API process. Multi-instance fan-out through Redis, PostgreSQL notifications, or another broker is intentionally deferred until deployment requirements justify it.

## Frontend Boundaries

The frontend is divided by responsibility:

- an API client validates HTTP outcomes and parses dashboard contracts;
- a realtime client owns EventSource connection and reconnection state;
- a fleet state layer merges snapshots and per-host events by stable identifier;
- routing owns canonical host selection;
- presentation components render the shell, fleet list, status, metadata, and metric values;
- localization owns typed EN/TR message dictionaries and persisted language selection.

The first language is selected from the browser locale: Turkish locales choose TR and all others choose EN. A user selection is stored locally and applies globally on later visits. Technical identifiers and values are not translated.

No charting library or general state-management dependency is introduced in this phase. React's existing primitives are sufficient for the bounded fleet state.

## Data Freshness and Failure Behavior

The UI must never imply that stale values are live.

- Initial loading uses a structural loading state with an accessible label.
- An empty fleet explains that an agent must be enrolled and connected.
- A host without samples shows “waiting for metrics” instead of zero values.
- A REST failure shows a retry action and retains no false online claim.
- An interrupted SSE connection marks the live channel as reconnecting and preserves the last-update timestamp.
- When EventSource reconnects, the client reloads the current snapshot before returning to “live.”
- A host route that no longer exists shows a not-found state and a route back to the fleet.
- Individual missing or unavailable metric fields are represented explicitly, never coerced to zero.

Network counters are displayed as cumulative received/sent totals in Phase 3 because the stored samples are cumulative. Transfer-rate calculation belongs with historical sampling in Phase 4.

## Accessibility and Responsive Behavior

- The host list uses semantic interactive elements and supports keyboard selection.
- Current host and availability are conveyed by text as well as color.
- Connection announcements use a polite live region without announcing every metric update.
- Metric terms have visible labels and machine-readable values.
- Focus is moved deliberately when mobile navigation changes between list and detail.
- Layout remains usable from 320px width upward without horizontal page scrolling.
- Reduced-motion preferences disable non-essential transitions.

## Security and Privacy

- Dashboard output is mapped through explicit contracts; Prisma records are not serialized directly.
- Agent credentials and internal credential material are never returned.
- Route parameters and query input are validated.
- Browser-facing errors do not expose stack traces or database details.
- CORS remains configuration-bound rather than permissive by default.
- Documentation states that the Phase 3 UI must remain behind a trusted network boundary.

## Testing Strategy

Backend tests cover:

- current-state query mapping and latest-sample selection;
- online/offline derivation through the existing availability policy;
- empty, found, and not-found controller behavior;
- event publication only after successful persistence;
- SSE envelope serialization and subscription cleanup;
- omission of credential and private persistence fields.

Frontend tests cover:

- initial, empty, error, not-found, and partial-metric states;
- host search and selection with canonical routing;
- snapshot loading and targeted live-event merging;
- reconnecting state and snapshot reconciliation;
- EN/TR detection, selection, and persistence;
- accessible labels, status text, focus behavior, and keyboard operation.

Verification includes format, lint, strict type checking, automated tests, production builds, and a local browser smoke test at desktop and mobile widths.

## Completion Criteria

Phase 3 is complete when:

1. A user can open the dashboard and see all persisted hosts and truthful availability.
2. Selecting or directly routing to a host shows its latest persisted system metrics.
3. Accepted heartbeats and metric samples update the dashboard without a manual refresh.
4. A realtime interruption is visible, and reconnection reconciles against a fresh snapshot.
5. English and Turkish apply consistently and persist as one global interface preference.
6. Loading, empty, missing-data, not-found, error, and mobile states are accessible.
7. All repository quality gates and the local browser smoke test pass.
