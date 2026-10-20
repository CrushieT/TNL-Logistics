# TNL Logistics — Master Build Plan

## Count-free personal history [IN PROGRESS]

- Add opt-in count-free personal history while preserving the default exact Page contract; mobile and realistic simulation request `includeTotals=false`.
- History functional assertions [COMPLETED]: 66 focused backend tests and 268 mobile Node tests passed; Android/iOS production exports passed. Full backend suite run: 523 tests, zero failures/errors, five existing skips, Maven exit 0; separate test-fork shutdown timeout is isolated to the SSE test baseline. History diff audit found no findings. Evidence: `load-tests/count-free-history-results.md`.
- Simulation backend rebuild and benchmark comparison [COMPLETED]: seed skipping confirmed; business counts, MySQL container, and volume preserved. Single sequential diagnostic benchmark comparison: Mobile Couriers p95 dropped to 358.02 ms (<500 ms gate) and Dispatch to 252.99 ms (<500 ms gate); MySQL CPU dropped from 86.91% to 63.52%. Receiving (aggregate p95 680.20 ms, /shipments p95 750.34 ms vs 500 ms gate) and Admin (aggregate p95 2,165.15 ms, /dashboard/summary p95 2,425.61 ms vs 1,500 ms gate) still miss their gates. Earlier plans identify broad aggregation and counting costs; query/read consolidation requires further measurement, and no new index is justified by this comparison.
- Dashboard optimization remains a separate slice; resource limits, schema, and workload gates are unchanged. Physical-device scrolling and refresh verification remain [UPCOMING].

## Merge blocker corrections [COMPLETED]

- SSE session ownership [COMPLETED]: each production stream attempt captures connection identity, verified user ID, session generation, and token. Obsolete responses, event chunks, cleanup, and timers cannot block a newer session, clear its connection, or create duplicate reconnects. Verified session changes recover connections; genuine current-session 401/403 still halt retries. Existing exponential backoff, subscriber teardown, and invalidation behavior are preserved.
- Acceptance runner status [COMPLETED]: save k6's native exit status immediately, collect reports, and return that saved code. Reporting/sanitization/missing-summary/monitor-cleanup failures also return nonzero while preserving an existing benchmark failure. Summary sanitization and monitor/environment cleanup run on failure paths. Resource samples stream from the monitoring job, which stops when k6 returns instead of waiting out its full monitoring window.
- Verification [COMPLETED]: 67 focused frontend tests passed (`node --test tests/sseClient.test.mjs tests/progressiveLoadingFlows.test.mjs tests/authSlidingSession.test.mjs`); all 251 frontend tests passed (`node --test tests/*.test.mjs`); production export passed (`npx.cmd --no-install expo export --platform web`), run from `frontend-web`. PowerShell parsing and 11 mocked runner cases passed (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File load-tests/tests/run-acceptance.Tests.ps1`, from the repository root). `git diff --check` passed. No live benchmark, database operation, container rebuild/restart, dependency/resource change, or Git write operation was performed for these corrections.
- User-reported browser acceptance [COMPLETED]: the user confirmed completing the preceding browser checklist, including repeated hard reloads on Dashboard/Tracking Logs and login recovery. This supersedes the earlier pending browser notes for that checklist. The new SSE races are verified through deferred-response production-client tests; no additional interactive browser run is claimed for this correction.
- Performance acceptance remains [IN PROGRESS]: no limits or existing open gates changed. Preserve 1 CPU / 1 GiB per container, five Hikari connections, 60-second warm-up plus 600 measured seconds, admin p95 below 1,500 ms, Reports p95 below 5,000 ms, mobile p95 below 500 ms, and measured failure rate below 1%. Runner exit-status tests do not constitute performance acceptance.

## Admin Pages Optimization [IN PROGRESS]

- Implementation plan: `.review/admin-pages-optimization-plan.md`. Eliminates entity hydration and OOM risks across Reports, Dashboard, Admin Tracking Logs, and Weekly Collections under 50,000-shipment load. Represents a verified improvement with open acceptance gates, not full performance acceptance.
- Slice A: Reports memory and query work [COMPLETED] — Replaced period shipment, parcel, payment, and lifetime unpaid entity loading with bounded database aggregates and projections. Passed 17 ReportIntegrationTest regression, completion-rate semantics, MockMvc HTTP 503 error contract, and date-dimension memory checks.
- Slice B: Weekly Collections and Dashboard [COMPLETED] — Replaced itemized response hydration in Dashboard with shared internal CollectionTotals read and consolidated CycleShipmentSummary projection. Preserved all financial invariants (per-client balance clamping, pre-aggregated payments, deductions, previous balances, late payments, blank ID handling, SOA-only clients). Replaced exception swallowing with structured HTTP 503 (COLLECTIONS_UNAVAILABLE, CYCLES_UNAVAILABLE, DASHBOARD_UNAVAILABLE). Completely eliminated frontend fallback client/shipment pagination aggregator in collectionsApi.js, disabled dependent SOA actions when data is unavailable, and added stale-data warning with timestamp. Verified via 16 backend integration tests (CollectionsIntegrationTest, CollectionsAggregationIntegrationTest, DashboardIntegrationTest), 156 frontend web tests (including collectionsFallbackRemoval.test.mjs), and production Expo web export.
- Slice C: Admin Tracking Logs [COMPLETED] — Implemented ID-first admin pagination selecting event IDs with equivalent predicates, eliminating joins for unfiltered, date-bounded, and status-bounded queries. Bounded entity and relationship hydration strictly to paged IDs (joining parcelUnit, shipment, staff, and vehicle) with deterministic order preservation (eventTimestamp DESC, eventId DESC). Enforced page/size clamping (negative pages to 0, size clamped to 1-500, preserving 500-item CSV exports) and exact totals beyond the last page. Preserved company-wide admin access, 6-field substring/lowercase/wildcard search without courier actor restrictions, and isolated courier history (/tracking-events/mine). Consolidated today's operational metrics into a single SQL aggregate (TodayTrackingMetricsSummary) preserving active courier/dispatch roles, business-day boundaries, and operational status rules. Verified via 21 TrackingLogIntegrationTest, 20 PersonalTrackingHistoryIntegrationTest, and 13 AdminConsoleAuthorization/FourRoleAuthorization tests with 0 failures.
- Slice D: Request lifecycle and outage handling [COMPLETED] — Implemented shared plain-JavaScript request coordinator (requestCoordinator.mjs and useRequestCoordinator.js) managing deterministic key derivation, in-flight request overlap prevention, AbortController cancellation on key change/unmount, generational response guarding to eliminate stale response overwrites, at most one queued follow-up refresh to coalesce duplicate triggers, 300ms event burst debouncing, and tab inactivity / hidden route suspension with at most one catch-up refresh on resume. Hardened shared SSE client with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s ceiling with bounded jitter), reset on successful stream opening, immediate stop on 401/403 or session invalidation, and single connection guarantee without parallel attempts. Integrated across Reports, Dashboard, Tracking Logs, and Weekly Collections. Verified via 171 passing frontend web tests (including requestCoordinator.test.mjs and sseClient.test.mjs) and clean production Expo web export. Slice C pre-inversion date contract corrected to restore pre-Slice C empty-result behavior for reversed dates.
- Slice E: Progressive loading and bounded memory cache [COMPLETED] — Immediate page layout rendering with section skeletons (MetricCardSkeleton, ChartSkeleton, TableRowSkeleton, ActivityRowSkeleton, ReportsKpiSkeleton, CollectionSummarySkeleton) replacing content-wide loading spinners across Dashboard, Weekly Collections, Reports, and Tracking Logs. Bounded browser-memory cache with 6 slots, exact user/session/query matching, 5-minute preview TTL, 1 MiB per-entry limit, 4 MiB total limit, and oldest-entry eviction. Action gating blocks dependent financial exports/generation during loading, preview, or stale states. Full cache and preview invalidation on session logout/change while preserving sliding token renewals. Verified via 18 response cache and session lifecycle tests (responseCache.test.mjs, responseCacheSession.test.mjs), 187 total frontend web tests passing with 0 failures, and clean production Expo web export.
- Slice F: Database connection lifecycle & Open-In-View hardening [COMPLETED] — Diagnosed and eliminated HikariCP connection starvation triggered by rapid browser hard reloads on SSE endpoints. Demonstrated in isolated reproduction (SseOpenInViewRetainedConnectionTest) that open-in-view=true held physical JDBC connections across asynchronous request threads without transaction commit boundaries, exhausting the 5-connection pool (active=5, idle=0) and generating HTTP 500 connection acquisition timeouts. Hardened backend configuration with spring.jpa.open-in-view=false and @Transactional(readOnly = true) on AppUserRepository.findSseAuthorizationState. Verified via SseConnectionLeakIntegrationTest (3/3 passed asserting 0 borrowed connections with 5 concurrent streams, 10 rapid reload cycles, and bounded heartbeat pruning) and regression suites across Security (29), Reports (18), Collections/SOA (19), Payments (7), Waybills (18), Dashboard (11), Tracking Logs (26), and Shipments (34) with zero failures. Growth backend container rebuilt and redeployed on port 8084 under 1 CPU / 1 GiB / 5-connection pool limit; verified live on port 8084 with 10 rapid SSE connect/abort cycles leaving MySQL process count bounded (3 idle connections) and ordinary requests immediately responsive (First Boot Status 8 ms, Tracking Logs 164 ms, Dashboard Summary 1,343 ms). Manual interactive browser acceptance [COMPLETED] following user confirmation of rapid reload and login checks.
- Concurrent Performance Acceptance [IN PROGRESS] — Evaluated via 10-minute measured k6 runs across Normal 50k, Peak 50k, and Growth 100k workloads with distinct role and courier sessions under 1 CPU / 1 GiB limits and 5 Hikari connections. 50k Peak passed all 12 measured gates (< 1,500 ms admin, < 5,000 ms reports, < 500 ms mobile). 50k Normal failed the receiving shipment-list gate (566.7 ms vs 500 ms limit). 100k Growth had insufficient admin samples (21-22 vs 30 minimum) and missed multiple latency targets. Tracking metrics under concurrent load was tested on an empty day; populated-day SQL probe was an isolated diagnostic. Live SSE outage/recovery check remains [UPCOMING] pending container-stop approval. Open acceptance gates remain.

## Pre-Hydration Loading Shell and Browser Refresh Improvement [COMPLETED]

- Eliminated white-screen blank interval during browser refresh prior to React bundle execution and mount.
- Implemented lightweight, self-contained loading shell directly in `frontend-web/public/index.html` matching application canvas background (`#F3F2ED`), with tracking brand logo, "ADMIN CONSOLE" badge, accessible CSS spinner, loading announcement (`role="status"`, `aria-live="polite"`), and structured `<noscript>` alert.
- Positioned `#app-loading-shell` outside `#root` container to prevent React hydration or DOM mount interference.
- Added `frontend-web/src/utils/loadingShell.js` and wired isomorphic layout effect in `frontend-web/src/app/_layout.js` to dismiss the shell with a smooth 160ms fade-out only after `#root` contains committed child DOM nodes.
- Preserved existing page skeletons, session synchronization, and routing behavior on direct refreshes.
- Automated verification [COMPLETED]: 15 unit tests in `loadingShell.test.mjs` and all 330 frontend-web unit tests passed (`node --test tests/*.test.mjs`); production web export passed (`npx --no-install expo export --platform web`); `git diff --check` passed cleanly.
- Browser performance screenshot measurement [PENDING]: dedicated automated browser performance screenshot tooling is not available in the current CLI environment; manual visual verification pending.


## Statements Dropdown SOA Search [COMPLETED]

- Generated statements in the selected collection cycle show their SOA number in bold beneath the client name and support full/partial, trimmed, case-insensitive number searches.
- Client name, code, contact, and email searches remain supported; Weekly Collections keeps the default dropdown behavior. No backend or database changes.
- Automated verification [COMPLETED]: 11 focused component/screen tests and all 117 web tests passed (`node --test tests/*.test.mjs src/features/waybills/services/waybillPrint.test.mjs`, from `frontend-web`); production web export passed (`node node_modules/expo/bin/cli export --platform web --output-dir ../.review/soa-dropdown-web-export`).
- Browser acceptance [UPCOMING]: check dropdown readability, SOA searches, selection, and cycle switching against generated statements.

**System Architecture:** Unified Modular Monolith (Spring Boot 3.4 + MySQL 8.0 + React Native / Expo Web & Mobile). Single shared database where every transaction encoded on PC or mobile is immediately available across all platforms in real time.

**4 Independent Status Concepts (Rule 19):**
* **Tracking Status (6-state):** `Registered` -> `QR Generated` -> `Loaded on Truck` -> `Outload / Arrive TNL` -> `Loaded to Hauler` -> `Completed`
* **Payment Status:** `Unpaid` → `Partially Paid` → `Paid` (and `For Collection` during Thursday batch)
* **Label Status:** `Not Printed` -> `Printed` -> `Reprinted`
* **Waybill Status (4-state):** `Not Generated` -> `Generated` -> `Sent to Hauler` -> `Signed / Completed`

## Admin-only Lost Parcel Workflow [IN PROGRESS]

- Separate implementation plan: `.review/lost-parcel-plan.md`. Admin loss/recovery, immutable manifests, explicit all-lost closure, exception-aware return QR completion, and recovery reopening; billing remains unchanged. Completed demo work remains closed.
- Loss/recovery foundation and Admin confirmation UI [COMPLETED]: V39 additive persistence, append-only history, active-Admin authorization, revision and request-ID guards, and loss-aware scans/generation.
- Waybill reconciliation [COMPLETED]: mixed returned-waybill completion, explicit all-lost Admin closure, original-waybill reopening, preserved closure history, and fresh manifest revision confirmation.
- Cross-platform visibility and automated verification [COMPLETED]: delivered/lost summaries, active-cargo exclusions, report/dashboard Lost distribution, retained manifest reprints, backend integration and migration checks, 99 web tests, 232 mobile tests, and Admin web plus mobile web/Android/iOS production exports. Evidence and audit: `.review/lost-parcel-evidence.md`.
- Browser and physical-phone acceptance [UPCOMING]: Admin modals, Dispatch loss review, reopened waybill, and stale-QR recovery require hands-on checks.
- Local startup and test schema recovery [COMPLETED]: after a restorable local backup and successful restored-copy V39 startup, V34 Flyway checksum was reconciled on local dev and test schemas. Flyway migration validation remains strictly enabled (`validate-on-migrate=true`). The complete backend test suite (429 tests, 0 failures, 0 errors) passed cleanly across legacy upgrade, primary key migration, and parcel loss workflows. Deployed-database recovery states remain pending.
- Admin shipment status presentation [COMPLETED]: the shipment detail Parcel Units table no longer uses a Label column; its heading always displays the loss count, including `0 Lost`. Shipment directory summaries show counts such as `2 Lost`, and each affected parcel shows a primary Lost badge with its last confirmed position beneath it. Label printing and audit details remain in the parcel view. The 99-test web suite and production web export passed; browser acceptance remains [UPCOMING].

## Mobile Account-Switch Hardening [COMPLETED]

- Password-update cleanup recovery [COMPLETED]: distinguishes a successful server password change from failed local cleanup, retains B password-login navigation and username, clears sensitive fields, and permits access-only cleanup retry without falling back to A PIN. Latest UI-only verification: 217 mobile tests, web/Android/iOS exports, and scoped audit passed. Prior user-reported Phase 6 phone acceptance remains recorded; this follow-up's targeted phone check is [UPCOMING].

- Password-change cancellation [COMPLETED]: clears B access/password fields, retains A binding, and explicitly opens password login. Approved cleanup-failure remediation prevents fallback to A PIN and preserves B username for retry. Mobile: 212 passing; all-platform exports and scoped audit passed; physical acceptance [COMPLETED], reported by the user on 2026-10-10.

- Extends the completed demo milestones with confirmed password-based phone transfer, binding-scoped JWT revocation, provisional onboarding, and stale-client-response protection.
- Implementation, threat model, regression coverage, and scoped audit [COMPLETED]. Backend: 402 tests, zero failures/errors, five pre-existing skips. Mobile: 212 passing (latest UI-only run; backend/web counts are historical). Web: 78 passing. Web/Android/iOS production exports passed.
- Physical-device acceptance [COMPLETED], reported by the user on 2026-10-10. The account-switch hardening milestone is [COMPLETED]. Printer acceptance remains deferred; no assistant-run phone verification is claimed.
- Evidence and agreed security controls: `.review/mobile-account-switch-evidence.md`.

---

## Progress Overview

Post-client-demo implementation plan closeout [COMPLETED] on 2026-10-12 at the user's request. `.review/client-demo-change-plan.md` now records the delivered scope merged into `dev` via #72 and the V34 MySQL compatibility follow-up via #73. Pending pricing/retry browser/phone checks, targeted password-cleanup phone verification, deployment smoke checks, and deferred physical-printer acceptance remain separate release follow-ups; this closeout does not claim they passed.

| Phase | Description | Status |
| :--- | :--- | :---: |
| **Phase 0** | Foundation (Skeleton, Flyway Migrations V1-V6, JPA Entities, JWT Auth & Roles) | [COMPLETED] |
| **Phase 1** | Register Shipment (`SHP-YYYY-XXX`, `TRK-YYYY-XXXXXX`), $m^3$ Volume, Vector QR Labels & Paginated Table | [COMPLETED] |
| **Phase 2.1** | Backend: 6-State Status Flow Engine & Sequential Scan Validation (`POST /tracking-events/scan`) | [COMPLETED] |
| **Phase 2.2** | Backend: Vehicle Fleet Management (`VH-XXX` generator & CRUD endpoints) | [COMPLETED] |
| **Phase 2.3** | Real-Time Live Auto-Updates (Server-Sent Events streaming pipeline `GET /api/v1/events/stream`) | [COMPLETED] |
| **Phase 2.4** | Web: Vehicle Fleet Management UI (`/vehicles` list & register modal — Desktop Screens 13/14) | [COMPLETED] |
| **Phase 2.5** | Web & Backend: Client Management Directory & Profile View (`/clients`, `/clients/[id]` — Screens 15/16) | [COMPLETED] |
| **Phase 3** | Core Waybill Generation & Initial Manifest Flow | [COMPLETED] |
| **Phase 4.1** | Backend: Payments & Collections Engine (`POST /api/v1/payments`, Balance Recalculation, Multi-Search & Audit) | [COMPLETED] |
| **Phase 4.2** | Backend: Thursday Weekly Collections Consolidation & SOA Generator (3 Deductions, Net Remittance) | [COMPLETED] |
| **Phase 4.3** | Web: Billing, Collections & Printable SOA (Desktop Screens 18–22) | [COMPLETED] |
| **Phase 5** | Web Console: Live Dashboard, Tracking Logs Stream, Reports, Users, Settings & First Boot Setup (Screens 01, 02, 17, 26–28) | [COMPLETED] |
| **Phase 6** | Role-Aware Mobile Courier Portal (Screens 29–56) | [COMPLETED] |
| ↳ **Phase 6.1** | Mobile Credential & PIN Workflow & Role-Aware Shell (Screens 29–33) | [COMPLETED] |
| ↳ **Phase 6.2** | Office Staff: Shipment Generation & Past Shipments Directory (Screens 34–40) | [COMPLETED] |
| ↳ **Phase 6.3a** | Software Label Printing, Virtual Driver Isolation & Audit Hardening (Screens 41–44) | [COMPLETED] |
| ↳ **Phase 6.3b** | Physical Bluetooth Integration & Brother RJ-2035B On-Device Validation | [UPCOMING] |
| ↳ **Phase 6.4** | Field Staff: Camera QR Scanner & Status Flow Engine (Screens 45–48) | [COMPLETED] |
| ↳ **Phase 6.5** | Field Staff: Personal Scan & Tracking History (Screens 49–52) | [COMPLETED] |
| ↳ **Phase 6.6** | Mobile Staff Account, Security & 4-Digit PIN Settings (Screens 53–55) | [COMPLETED] |
| **Phase 7** | Post-Demo Client Changes & System Enhancements | [COMPLETED] |
| ↳ **Phase 7.1** | Per-Unit Registration, Dynamic Rates & Settings-Based Pricing | [COMPLETED] |
| ↳ **Phase 7.2** | Configurable SOA Bank Details & Formatted Statement Printing | [COMPLETED] |
| ↳ **Phase 7.3** | Split Waybills, Hauler Console & 15-Item Manifest Printing | [COMPLETED] |
| ↳ **Phase 7.4** | Online-Only Mobile Scanner, Ergonomics & Access Hardening | [COMPLETED] |
| ↳ **Phase 7.5** | Mobile Discovery Rails & Query Recommendations | [COMPLETED] |
| ↳ **Phase 7.6** | High-Volume Load Testing, Synthetic Seeder & Dev Fixtures | [COMPLETED] |
| ↳ **Phase 7.7** | Four-Role Authorization Model & Staff-Type Retirement | [COMPLETED] |

---

## Phase 0 — Foundation [COMPLETED]
*Backend and database foundation.*

**0.1 — Project Skeleton & Database** — **[COMPLETED]**
- Spring Boot 3.4 with Java 21, Flyway migration versioning `V1` through `V6`.
- MySQL connection pooling with HikariCP.

**0.2 — Core JPA Entities & Schemas** — **[COMPLETED]**
- `Client`, `Shipment`, `ParcelUnit`, `AppUser`, `Vehicle`, `TrackingEvent`, `PrintEvent`, `Payment`, `Waybill`, `SoaStatement`.
- Physical dimensions ($L \times W \times H\text{ cm}$), auto-volume calculation ($m^3$), and volumetric weight divisor ($5000$).
- Verified via `RepositoryIntegrationTest` suite.

**0.3 — Security, JWT & RBAC** — **[COMPLETED]**
- HMAC-SHA256 stateless JWT token provider with BCrypt password hashing and immutable user ID binding.
- Differentiated token lifecycle architecture: 30-minute inactivity sliding renewal window bounded by a 12-hour absolute shift ceiling for Web Administrator (`ADMIN`) in browser `localStorage`, and 10-day TTL for Mobile Staff (`OFFICE_STAFF`, `FIELD_STAFF`) in hardware `SecureStore` with PIN unlock; configurable via `jwt.expiration.admin-minutes` (default 30) and `jwt.expiration.staff-days`.
- Dynamic renewal and ceiling enforcement in `JwtTokenProvider.validateToken`: enforces inactivity window (`now - iat < 30m`), 12-hour shift ceiling (`now - auth_time < 12h`), monotonic token renewal via `X-Renewed-Token`, and instant invalidation of role mismatches and legacy tokens without `auth_time`.
- 3 distinct system roles: `ADMIN`, `OFFICE_STAFF`, `FIELD_STAFF`.
- Instant session revocation on credential changes via `tokenVersion` claims.
- Method security (`@PreAuthorize`) and `SecurityIntegrationTest` suite.

---

## Phase 1 — Register Shipment & Labels (Office Staff, PC-First) [COMPLETED]
*First complete vertical slice.*

**1.1 — Backend: Registration Engine & Sequential ID Generation** — **[COMPLETED]**
- `POST /api/v1/shipments` — client + recipient + shipment/charges + $N$ parcel units.
- Sequential ID generators: `SHP-YYYY-XXX` and `TRK-YYYY-XXXXXX`.
- Pricing models: `FLAT` vs `PER_PARCEL` charge calculations (Rule 08).
- Auto-payment created if `paidAtRegistration = true`. Initial `REGISTERED` & `QR_GENERATED` scan events logged.
- Verified via `ShipmentIntegrationTest` suite (5 passing tests).

**1.2 — Web: Shipment Registration Screen (Desktop Screens 03–05)** — **[COMPLETED]**
- Matches client prototype (client selector + inline `+ New Client` toggle, recipient fields, charges, live total).
- Implemented `ShipmentResultView` with summary grid, parcel table, and live label preview.
- Implemented `PrintLabelsModal` with printable vector QR cards for all units.

**1.3 — Web: Shipments Table & Package Tracking View (Desktop Screens 06–12)** — **[COMPLETED]**
- Paginated master shipments table (`GET /api/v1/shipments`) with search and status filters, including Completed in the web status dropdown.
- Live Shipment Details view (`GET /api/v1/shipments/{shipmentId}`).
- Single Parcel Inspection screen (`GET /api/v1/parcel-units/{trackingId}`) with dimensions, volume ($m^3$), completed-only orange tracking history, single grey next pending status, and label reprint tracking.

---

## Phase 2 — Status Flow, Vehicle Fleet & Real-Time Sync [COMPLETED]

**2.1 — Backend: 6-State Status Flow Engine** — **[COMPLETED]**
- Status lifecycle: `REGISTERED` -> `QR_GENERATED` -> `LOADED_ON_TRUCK` -> `ARRIVED_AT_TNL` -> `LOADED_TO_HAULER` -> `COMPLETED`.
- Strict sequential transition validation; invalid skips rejected with HTTP 400 Bad Request.
- `POST /api/v1/tracking-events/scan` (single) and `POST /api/v1/tracking-events/batch-scan` (batch).
- Dynamic shipment rollup status derivation (Rule 09).

**2.2 — Backend: Vehicle Fleet Management Engine** — **[COMPLETED]**
- Sequential Vehicle ID generator: `VH-001`, `VH-002`, `VH-003`...
- CRUD endpoints: `POST /api/v1/vehicles`, `GET /api/v1/vehicles` (active fleet), `PUT /api/v1/vehicles/{id}`, `DELETE /api/v1/vehicles/{id}`.
- Mandatory active vehicle assignment on `LOADED_ON_TRUCK` and auto-clearing upon `ARRIVED_AT_TNL` (Rule 18).

**2.3 — Real-Time Live Auto-Updates (Server-Sent Events)** — **[COMPLETED]**
- `SseService` with thread-safe client connection registry and 25-second keep-alive heartbeats.
- `GET /api/v1/events/stream` HTTP streaming endpoint.
- Web tables, status badges, and parcel timelines update silently in place with 0ms latency upon scan events.

**2.4 — Web: Vehicle Fleet Management UI (Desktop Screens 13/14)** — **[COMPLETED]**
- `frontend-web/src/app/vehicles.js` — Fleet list (Vehicle ID, Plate number, Type, Status badge, Remarks).
- Register Vehicle Modal with auto-generated ID, plate number validation, and vehicle type selector.

**2.5 — Web & Backend: Client Management Directory & Profile View (Desktop Screens 15/16)** — **[COMPLETED]**
- Flyway `V9__add_client_fields_and_performance_indexes.sql` with `default_rate_type`, `active`, `date_registered`, and composite indexes.
- Sequential ID generator `CL-001`, `CL-002`... with zero N+1 batch financial aggregations (`totalShipments`, `totalCharges`, `totalPaid`, `outstandingBalance`).
- Hybrid smart deletion (permanent hard delete for unused clients, soft deactivation for clients with shipment history).
- `frontend-web/src/app/clients/index.js` (Screen 15: Client Directory Table with search, persistent status pills `All`, `Active`, `Inactive`, and pagination).
- `frontend-web/src/app/clients/[id].js` (Screen 16: Single Client Profile View with 3-metric balance rollup and embedded shipment tracking history).
- Register & Edit Client modals, and inactive client filtering in shipment registration.
- Client detail response accurately reflects completed deliveries count and COMPLETED parcel rollup.

---

## Phase 3 — Core Waybill Flow & Initial Manifest Generation [COMPLETED]

**3.1 — Core Waybill Entity & Handoff Engine** — **[COMPLETED]**
- Waybill entity, repositories, and sequential generator `WYB-YYYY-XXXX`.
- 4-state lifecycle: `NOT_GENERATED` -> `GENERATED` -> `SENT_TO_HAULER` -> `SIGNED_COMPLETED`.
- Initial shipment-to-waybill generation assigning loaded parcels to a hauler waybill document.
- Verified via backend waybill integration tests. *(Advanced multi-manifest splitting, dedicated hauler console, and 15-item printing are consolidated in Phase 7.3)*.

---

## Phase 4 — Billing, Weekly Collections & Statement of Account (Desktop Screens 18–22) [COMPLETED]
*Financial accounting and client billing.*

**4.1 — Backend: Payments & Collections Engine** — **[COMPLETED]**
- Flyway `V12__enhance_payment_schema.sql`: added `staff_id` (FK to `app_user`), `remarks`, and composite index on `(payment_date, method)`.
- Flyway `V26__expand_payment_methods.sql`: expanded `payment.method` enum to include `CHEQUE` and `OTHER`.
- Financial balance calculation and validation: strictly positive payment amounts, overpayment prevention exceeding remaining balance.
- Automatic payment status updates: `Unpaid` → `Partially Paid` → `Paid` (with running `totalPaid` and `balance` updates).
- REST Endpoints:
  - `POST /api/v1/payments` — Record payment against shipment (`ADMIN`, `OFFICE_STAFF`).
  - `GET /api/v1/payments/shipment/{shipmentId}` — Itemized shipment payment history and balance overview.
  - `GET /api/v1/payments` — Paginated company-wide payments directory with multi-field search (shipment ID, client, recipient, ref no, method, date range).
- Real-time Server-Sent Events (SSE) integration via `broadcastPaymentRecorded`.
- Verified via `PaymentIntegrationTest` suite (18/18 tests passing).

**4.2 — Backend: Thursday Weekly Collections Consolidation & SOA Generator** — **[COMPLETED]**
- Flyway `V13`, `V14`, `V15`, `V16`: enhanced `soa`, created `soa_deduction` table, composite indexes, and complete cascading foreign keys.
- Thursday Weekly Collection Consolidation Engine (Rule 13): groups unbilled shipments (`statement_id IS NULL`) and client balances.
- Sequential SOA ID Generator: `SOA-YYYY-XXXX` (e.g. `SOA-2026-0001`).
- 3 Business Deduction categories: `BAD_ORDER`, `DISCREPANCY`, and `CLAIM`.
- Mathematical Net Remittance & Outstanding Balance derivation:
  $\text{Outstanding Balance} = \text{Current Charges} + \text{Previous Balance} - \text{Deductions} - \text{Total Paid}$.
- Immutability Lock: updates `statement_id = soa_no` on all included shipments and payments upon SOA creation.
- REST Endpoints:
  - `GET /api/v1/collections/weekly` — Active Thursday weekly collections overview.
  - `GET /api/v1/collections/preview/{clientId}` — Live unbilled shipments preview for a client.
  - `POST /api/v1/soa/generate` — Single SOA generation with itemized deductions.
  - `POST /api/v1/soa/generate-batch` — Bulk SOA generation for collection cycle.
  - `GET /api/v1/soa/{soaNo}` — Complete statement details and breakdown.
  - `GET /api/v1/soa` — Paginated directory of generated SOAs.
- Real-time SSE broadcasting via `broadcastSoaGenerated`.
- Verified via `SoaIntegrationTest` suite (21/21 total backend tests passing).

**4.3 — Web: Billing, Collections & Printable SOA (Desktop Screens 18, 19, 20, 21, 22)** — **[COMPLETED]**
- **Payment Management (Screen 18) — [COMPLETED]:**
  - `/payments` directory table with payment status filter (`Unpaid`, `Partial`, `Paid`), multi-search (Shipment ID, Client Name, Recipient), and real-time outstanding balance metric card.
  - "Record Payment" modal with real-time balance ceiling restriction, dynamic reference validation (`*` for `GCASH`, `BANK`, `CHEQUE`), and SSE live refresh.
  - "Payment History" modal (`View` action) with itemized compounding installment ledger, date stamps, staff attribution, and financial summary.
  - Fixed-slot action column layout (`View`, `Record →`, `Settled`) to eliminate horizontal row jitter.
- **Weekly Collections (Screen 19) — [COMPLETED]:**
  - `/weekly-collections` Thursday consolidation dashboard matching prototype layout with 3 metric cards (`CLIENTS`, `TOTAL DUE`, `OUTSTANDING`).
  - Active Thursday cycle selector targeting the current closing week with dynamic endpoint integration (`GET /api/v1/collections/cycles`) to filter out empty weeks.
  - Searchable client dropdown with outside-click dismissal and client table status filters (`All`, `Ready for SOA`, `SOA Generated`, `Settled`).
  - Table with `CLIENT`, `SHIPMENTS`, `TOTAL CHARGES`, `PAID`, `DEDUCTIONS`, `BALANCE`, `STATUS`, and action buttons (`Generate SOA →` and `View SOA`).
  - Batch SOA Modal with bulk generation trigger and informative notice when all SOAs for a cycle are generated.
  - Pure on-demand Server-Sent Events (SSE) live updates with clean disconnect handling.
- **Consolidated SOA Preview (Screen 20) — [COMPLETED]:**
  - `/statements` itemized unbilled shipment breakdown for the billing cycle with itemized table, total charges, total paid, and deductions input card (`DeductionsInputCard.js`).
  - Real-time deduction calculation and notes input (supporting Bad Orders, Discrepancies, Claims) with immediate backend persistence.
- **Detailed Statement View (Screen 21) — [COMPLETED]:**
  - `/statements` full digital multi-page Statement of Account with client info header, sequential `SOA-YYYY-XXX-WXX` number, multi-page continuation headers, page numbering (`Page X of Y`), deduction rollup directly below Total Paid, and authorized collector assignment.
- **Printable SOA & Batch Export (Screen 22) — [COMPLETED]:**
  - Dedicated isolated print route at `/statements/print` with `@page { margin: 0; }` browser header suppression, uniform `10mm` sheet padding across pages, signature blocks (Prepared by, Collected by, Date collected), and smart batch generation on `/weekly-collections`.
  - Hardened two-copy multi-page sequence (`statementPrintModel.mjs`) repeating every physical sheet with independent page counters (`Page X of Y`).
  - Configurable SOA settlement bank details (bank name, account name, account number) managed under System Settings (`V33__add_soa_bank_details.sql`) with print preflight validation.
  - Optimized wide aspect ratio company letterhead and refined itemized shipments table layout with combined charges display.

---

## Phase 5 — Web Console: Dashboard, Reports & Administration (Desktop Screens 01, 02, 17, 26–28) [COMPLETED]
*Operational dashboards and administrative controls.*

**5.1 — Desktop Login & Route Protection (Screen 01)** — **[COMPLETED]**
- Standalone production login screen with `TC & CT INTEGRATED LOGISTICS` artwork branding (`/login`).
- Username/password authentication, JWT storage, and `FIELD_STAFF` desktop blocking.
- Route guarding across all web console paths with return URL redirection (`?redirect=<path>`).
- Dynamic sidebar session display with user avatar initials, role, and functional `SIGN OUT` action.
- Responsive desktop card layout (`maxWidth: 500px`), optimized transparent brand logo, and viewport height adaptations.
- Built-in in-memory login rate limiter (5 failed attempts per 60s, 60s lockout) with on-demand lazy eviction, HTTP 429 `Retry-After`, and reactive frontend countdown lock.
- Adaptive `+not-found.js` catch-all route (inside AppShell for authenticated operators, standalone for visitors) and RBAC route guarding for `/users` and `/settings`.

**5.2 — Dashboard Live Metrics (Screen 02)** — **[COMPLETED]**
- Live operational cards: Shipments & parcel count, Today's Shipments, Unpaid Transactions, and Thursday Weekly Collection rollup.
- Visual chart cards: Parcel Units by Status (Donut Chart), Weekly Shipment Volume (Monday–Sunday Bar Chart), and Outstanding vs Collected financial comparison bars.
- Live recent activity feed with formatted tracking scans, staff attribution, and link to `/tracking-logs`.
- Backend live aggregation endpoint `GET /api/v1/dashboard/summary` and real-time Server-Sent Events (SSE) synchronization.

**5.3 — Global Tracking Logs Audit Feed (Screen 17)** — **[COMPLETED]**
- Company-wide real-time audit stream showing every parcel scan, timestamp, acting staff member, and vehicle assignment.
- 4-card live operational metrics bar (Today's Total Scans, Active Couriers, Loaded on Truck Today, Handed to Hauler Today).
- Multi-field search (tracking ID, shipment ID, staff name) with persistent status filter pills matching prototype aesthetic.
- Server-side paginated audit table with configurable page sizes (10, 25, 50), clickable parcel inspection links, and CSV export.
- Optimized Server-Sent Events (SSE) synchronization: smart in-place prepend on Page 1 and non-intrusive floating pill on Page > 1.
- REST endpoints `GET /api/v1/tracking-events` and `GET /api/v1/tracking-events/metrics` protected by RBAC (`ADMIN`, `OFFICE_STAFF`), verified via `TrackingLogIntegrationTest`.

**5.4 — Operational & Financial Reports (Screen 26)** — **[COMPLETED]**
- Implemented complete reporting hub (`frontend-web/src/app/reports.js`) with grouped dual-bar chart (charges vs collections), Thursday collection cycle summary card, and top 5 KPI cards with period filtering (`Today`, `This Week`, `This Month`, `Last 30 Days`, `Custom`).
- Multi-domain reporting tabs: Financial & Revenue (`FinancialRevenueTab.js`), Operational Volume (`OperationalVolumeTab.js`), and Client Receivables Aging (`ReceivablesAgingTab.js`).
- Interactive `[✓] Hide empty days` toggle on the Daily Operations Timeline (enabled by default), with reverse chronological date ordering (latest date at top) and dynamic grand total label (`Total (X active days)` vs `Total (X days)`).
- Standardized pagination footer across all report tables and Tracking Logs matching the canonical `Showing N of T · Page X of Y [N / page ▾] [← Previous] [Next →]` pattern established in Shipments, Vehicles, and Payments.
- CSV export per tab and browser A4 printable document modal (`PrintableReportModal.js`).
- Real-time SSE synchronization (`STATUS_UPDATE`, `SHIPMENT_CREATED`, `PAYMENT_RECORDED`, `SOA_GENERATED`) with 300ms debounced silent reloads and window focus re-sync.
- Backend aggregation endpoints `GET /api/v1/reports/summary` and `GET /api/v1/reports/kpis` protected by `@PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")`, verified via `ReportIntegrationTest` (5/5 passing).

**5.5 — User & Staff Management (Screen 27)** — **[COMPLETED]**
- Staff directory (`/users`) with server-side pagination, search by name, username, and ID, role and status filtering, platform access chips, and responsive design.
- Credential management suite: auto-generated temporary passwords (`TNL-XXXX`) with clipboard copy feedback and re-roll button; mobile PIN setup (Option A "Require PIN setup on first mobile login" default + Option B collapsible manual 4-digit override); dedicated `ResetPasswordModal` and `ResetPinModal`.
- Instant session revocation via `tokenVersion` claims and Flyway migrations `V17__add_user_pin_and_indexes.sql` and `V18__add_user_token_version.sql`.
- Destructive action safety: `ConfirmActionModal` requiring typed User ID verification for deletion; soft-deactivation (`active = false`) for staff with linked operational audit history.
- Single Administrator System Invariant: disallow creating additional admin accounts, prevent promoting staff to admin, prevent altering admin role, and protect the system owner (`USR-ADMIN`) from deletion across UI and backend services.
- Full REST endpoints in `UserController.java` (`POST /api/v1/users`, `GET /api/v1/users`, `PUT /api/v1/users/{id}`, `DELETE /api/v1/users/{id}`, `PUT /api/v1/users/{id}/reset-password`, `PUT /api/v1/users/{id}/reset-pin`) secured with `@PreAuthorize("hasRole('ADMIN')")`, verified via 20 integration tests in `UserManagementIntegrationTest.java`.

**5.6 — System Settings (Screen 28)** — **[COMPLETED]**
- Flyway migration `V19__create_system_settings_table.sql` creating `system_setting` singleton configuration table with defaults.
- Dynamic Weekly Collection Day integration across `CollectionsService`, `SoaService`, `DashboardService`, and frontend cycle dropdowns, shifting active closing dates while preserving historical finalized SOAs.
- Dynamic cycle start date calculation (`calculateCycleStartDate`) anchored to the day following the preceding cycle (clamped to 7-day lookback floor), eliminating date overlaps during collection day transitions.
- Intermediate ghost cycle elimination by bounding candidate historical cycle discovery strictly to pre-active windows.
- N+1 database query optimization in `CollectionsServiceImpl.getWeeklyCollections()` by pre-fetching statement numbers into a fast in-memory lookup set.
- Replaced legacy `getActiveCycleThursdays()` with `getActiveCycleDates()`, retaining the former as a deprecated backward-compatible delegator.
- Dynamic volumetric divisor calculation in `ShipmentService` and reactive calculation preview formula in Settings (`e.g. 50×40×30 = 60,000 cm³ ÷ divisor = kg`).
- Dynamic company branding (Business Name, Address, Contact, Billing Email) propagating to Statement of Account printouts, Waybill manifests, and Admin Console screens.
- RBAC protection: Admin-only access for `/api/v1/settings` (`GET`, `PUT`) and staff-accessible `/api/v1/settings/branding`.
- Real-time Server-Sent Events (`SETTINGS_UPDATED`) for zero-reload configuration synchronization.
- Frontend Settings screen (`frontend-web/src/app/settings.js`) matching prototype layout with 2-card desktop grid, provisional billable weight callout, and read-only sequential ID format previews (`TRK-YYYY-`, `SHP-YYYY-`).
- Verified via 12 integration tests in `SystemSettingIntegrationTest.java` (12/12 passing, and 102/102 backend tests passing total).

**5.7 — First Boot Admin Registration & Setup Wizard** — **[COMPLETED]**
- Public first-boot status probing endpoint (`GET /api/v1/auth/first-boot-status`) returning `FirstBootStatusResponse(isFirstBoot)` to report whether an administrator account already exists (`!existsByRole(ADMIN)`).
- One-time initial admin registration endpoint (`POST /api/v1/auth/first-boot-admin`) accepting `FirstBootAdminRequest` with Bean validation, creating the immutable primary administrator (`userId = 'USR-ADMIN'`, `role = ADMIN`, `active = true`, `tokenVersion = 1`), updating singleton `SystemSetting` company branding, broadcasting `SETTINGS_UPDATED` SSE, and returning a freshly signed JWT token.
- Permanent endpoint lockout: returns HTTP 409 Conflict once the primary administrator has been initialized, preventing rogue account creation.
- Environment & seeder isolation: parameterized `app.seed.admin` property in `DataSeeder.java` and dedicated `application-firstboot.properties` profile for testing on clean isolated databases (`tnl_firstboot`).
- Frontend 2-Step Setup Wizard (`frontend-web/src/app/setup.js`):
  - Step 1 (Administrator Credentials): Full Name, Username, Password, and Confirm Password with SVG eye reveal toggles, minimum 8 characters, and live validation.
  - Step 2 (Company & SOA Branding): Pre-filled defaults for *TC & CT Integrated Logistics* (Labo, Camarines Norte) with a reactive document header preview card.
  - Auto-login: automatically sets the authenticated session upon completion and redirects directly to the operations dashboard (`/`).
- Central route guard integration (`frontend-web/src/app/_layout.js`): proactively checks `checkFirstBootStatus()` on mount, auto-redirecting uninitialized visitors to `/setup`, and blocking initialized visitors from `/setup` back to `/login`.
- Administrator Credential Management & Settings Protection:
  - Settings Card (`AdminSecurityCard.js`): dedicated operations card on `/settings` with live eye visibility toggles for self-service password updates, incrementing `tokenVersion` and transparently refreshing the active session.
  - Read-Only Admin Status: updated `EditUserModal.js` to render a fixed read-only `Active` badge for the `ADMIN` role, completely preventing self-deactivation.
  - Password Authorization Modals: implemented reusable `ConfirmPasswordModal.js` requiring administrator password confirmation before persisting system settings or updating credentials.
  - Rate-Limited Verification: added `POST /api/v1/auth/verify-password` using typed `PasswordVerificationRequest` and bound to `LoginRateLimiterService` (locking access after 5 consecutive failures with HTTP 429 and `Retry-After`).
- Verified via `FirstBootIntegrationTest.java` and `SecurityIntegrationTest.java` (105/105 backend tests passing, 0 failures, 0 errors, and clean web production build).

---

## Phase 6 — Role-Aware Mobile Courier Portal (Mobile Screens 29–56) — **[COMPLETED]**
*Field staff courier app and authorized mobile office workflows.*

**6.1 — Mobile Credential & PIN Workflow & Role-Aware Shell (Screens 29, 30, 31, 32, 33)** — **[COMPLETED]**
- Stage 1 (Initial Login / Device Binding): Full Username & Password login (`POST /api/v1/auth/mobile-login`) allowing both `OFFICE_STAFF` and `FIELD_STAFF` (with Admin web-provisioned credentials), issuing a 10-day staff JWT token (`jwt.expiration.staff-days`), generating high-entropy CSPRNG device credentials (`deviceId`, 256-bit `deviceToken`), binding device identity to local hardware storage, returning `hasPinSet`.
- Stage 2 (PIN Setup & Confirmation): Dedicated PIN Setup screen (`src/app/(auth)/setup-pin.js`) for accounts with `hasPinSet == false` (Option A "Require PIN setup on first mobile login" or "Clear PIN & Require Setup"), calling `POST /api/v1/auth/mobile-setup-pin` with 4-digit PIN confirmation, BCrypt hashing, incrementing `tokenVersion` to invalidate stale tokens, and returning a replacement JWT adopted seamlessly by the client.
- Stage 3 (Shift Unlock): Quick PIN unlock screen (`src/app/(auth)/pin.js`) matching `prototype pin page.png`, displaying bound staff member's full name, role badge, 4-dot indicator, and 3x4 keypad calling `POST /api/v1/auth/mobile-pin-login` with targeted `{ username, pin }` and required device headers (`X-Device-Id`, `X-Device-Token`), plus password reauthentication that preserves the current binding.
- Stage 4 (Header Actions & Lifecycles): `MobileHeader` supports quick `LOCK` (returns to PIN unlock) and `ACCOUNT` (opens the authenticated account and security settings). Destructive current-device unbinding is isolated on Screen 53.
- Cryptographic Server-Enforced Device Binding (Flyway `V27`):
  - Database schema: `V27__create_mobile_device_bindings.sql` creating `mobile_device_bindings` table with composite indexes on `(user_id, device_id)`.
  - Model & Data Access: `MobileDeviceBinding` JPA entity and `MobileDeviceBindingRepository` supporting atomic token updates, queries by user and device, and cascading device revocation.
  - Server-Side Token Hashing: Generates 256-bit device tokens via `SecureRandom`, storing only SHA-256 hashes (`device_token_hash`) in the database and returning plaintext credentials to the client once on initial login.
  - Constant-Time Possession Verification: `POST /api/v1/auth/mobile-pin-login` strictly requires device credentials (`X-Device-Id` and `X-Device-Token`), validates that the binding exists and belongs to the user, and compares hashes using `MessageDigest.isEqual` to prevent timing attacks. Missing, unknown, mismatched, or cross-account device credentials are rejected with HTTP 401 before evaluating the PIN.
- Mandatory Password Rotation & First-Boot Sequence:
  - Sequence Enforcement: Strictly enforces `Password Login -> Password Change -> Device Binding -> PIN Setup -> Shift Unlock`.
  - Scoped Provisional JWT: When `user.mustChangePassword == true`, `POST /api/v1/auth/mobile-login` returns `mustChangePassword: true` and issues a temporary token strictly for password updates without issuing or recording device bindings.
  - PIN Unlock Prohibition: `POST /api/v1/auth/mobile-pin-login` rejects attempts by users with `mustChangePassword == true` with HTTP 403 Forbidden and code `PASSWORD_CHANGE_REQUIRED`.
  - Dedicated Mobile Password Change Screen (`src/app/(auth)/change-password.js`): Screen 30b providing current password, new password, and confirm password fields with strength meters, visibility toggles, and instant validation.
  - Navigation Guard Coordination: Auth guards in `login.js`, `pin.js`, and `setup-pin.js` intercept flagged users and route directly to `change-password.js`. Upon successful rotation, the provisional session clears and directs staff to log in with their permanent password to initiate device binding.
- Seeder Isolation & Production Guardrails:
  - Added `app.seed.mobile-pins: false` toggle in `DataSeeder.java`. Mobile demo PINs (`1111`, `2222`, `0001`) are only seeded in development/test environments.
  - Startup Validation: Throws `IllegalStateException` if `app.seed.mobile-pins=true` under the `prod` profile, preventing preconfigured test PINs from ever existing in production databases.
- Strict Role Segregation: Administrator accounts (`ADMIN`) are barred from logging into the mobile portal (`/mobile-login`, `/mobile-pin-login`, `/mobile-setup-pin`) with HTTP 403 Forbidden (`"Administrator accounts are restricted to the Web Portal."`), preserving operational boundaries.
- High-Performance Tactile Micro-Animations: Reusable `PressableScale` atom using `Animated.spring` with `useNativeDriver: Platform.OS !== 'web'` providing 60fps mechanical press feedback across numeric keypad, action cards, primary action buttons, and header buttons with zero JavaScript thread latency or layout thrashing.
- Route-Isolated Rate Limiting: Integrated with `LoginRateLimiterService` enforcing progressive lockout partitioned by endpoint, account, and device (5 failed attempts trigger HTTP 429 Too Many Requests with `Retry-After` header and countdown).
- Modular `frontend-mobile/src/` architecture strictly matching `frontend-web` design patterns:
  - `src/theme/`: TNL design tokens (`canvas #F3F2ED`, `ink #1A1A1A`, `accent #C6491F`, `border #E1DFD5`, `keypadBg #EFECE6`).
  - `src/services/storage/`: Hardware-backed `expo-secure-store` wrapper enforcing fail-closed security on native iOS/Android (unencrypted fallbacks rejected), with memory-only store for web previews.
  - `src/services/api/`: Centralized Axios client injecting Bearer tokens, enforcing HTTPS in production, distinguishing session renewal from authorization denial, retrying once with a newer replacement token, and redacting sensitive failures.
  - `src/features/auth/`: Encapsulated auth service and `AuthContext` provider handling credential login, password rotation, PIN setup and rotation, PIN unlock, session lock, password reauthentication, and current-device unbinding.
  - `src/components/common/`: Shared UI components (`Keypad`, `PinIndicator`, `PressableScale`, `ActionCard`, `MetricCard`, `NoticeBanner`, `StatusModal`).
  - `src/components/layout/`: `MobileHeader` with role eyebrow, staff name, `LOCK`, and `ACCOUNT` triggers.
- Screens & Navigation Flow:
  - Credential Login (`src/app/(auth)/login.js`): Username and password entry with TNL tracking logo, `MOBILE PORTAL` badge, and quick shortcut to PIN unlock if device is already bound.
  - Password Change (`src/app/(auth)/change-password.js`): Mandatory first-boot password change workflow.
  - PIN Setup (`src/app/(auth)/setup-pin.js`): 2-step PIN creation & confirmation flow with 4-dot indicator and 3x4 keypad.
  - Shift Unlock (`src/app/(auth)/pin.js`): Bound staff member card, 4-dot indicator, 3x4 numeric keypad, and "Sign in with another account" link.
  - Role-Aware Shell (`src/app/(main)/index.js`): Authenticated root switching between `OfficeDashboard` (`OFFICE_STAFF`) and `FieldDashboard` (`FIELD_STAFF`).
  - `OfficeDashboard`: Label printing callout, 4 operational action cards (`Find Parcel`, `Register`, `Scan QR`, `Printer`), and daily shift metric counters matching `prototype office page.png`.
  - `FieldDashboard`: Scan-only notice banner, action cards (`Scan QR`, `Tracking History`, `Account`), and daily shift metrics matching `prototype field page.png`.
  - QR Scanner (`src/app/(main)/scan.js`): Viewfinder overlay with camera permissions and status postback.
- Cleared PIN & Re-Authentication Synchronization:
  - Backend `POST /api/v1/auth/mobile-pin-login` explicitly checks if `target.getPinHash() == null`, returning HTTP 409 Conflict with `code: "PIN_NOT_SET"`, without incrementing brute-force rate limiter counters.
  - Added public `GET /api/v1/auth/mobile-pin-status?username={username}` endpoint returning uniform JSON responses with isolated rate limiting to verify PIN configuration without leaking user enumeration signals.
  - Mobile PIN unlock screen (`src/app/(auth)/pin.js`) dynamically verifies bound account PIN status on mount/resume, proactively notifying staff if their PIN was cleared by an administrator.
  - Themed In-App Modals (`StatusModal.js`):
    - Minimalist design with fluid cubic-bezier animations, replacing OS system alerts.
    - Notice Mode: Displays an in-app modal ("PIN Reset by Administrator") explaining that the PIN was reset before redirecting to `(auth)/login` with pre-filled username and `NoticeBanner`.
    - Confirmation Mode: Dual-action confirmation dialogs preventing accidental sign-outs and terminal unbinding ("Cancel PIN Setup?" on `setup-pin.js`, "Switch Account?" on `pin.js`, and "Log Out & Unbind Device?" on `MobileHeader.js`).
  - Session revocation coordination in `apiClient` and `AuthContext` handling HTTP 401 caused by Admin PIN resets (`tokenVersion++`), presenting a revocation notice modal and cleanly routing through password re-authentication and PIN setup.
- Verified via `MobileAuthIntegrationTest.java` (36 integration test scenarios), `ProductionDataSourcePropertiesTest.java` (5 tests), full suite regression test (204 tests passing, 0 failures, 0 errors), and clean Expo Android export.

**6.2 — Office Staff: Shipment Generation & Past Shipments Directory (Screens 34–40)** — **[COMPLETED]**
- **Shipment Generation (`Register`):** Mobile shipment creation matching core business rules:
  - Client selection with inline quick client creation modal.
  - Recipient destination, contact, and address fields with dynamic billing calculations.
  - Parcel unit builder: quantity, physical dimensions ($L \times W \times H\text{ cm}$), auto volume ($m^3$), and billable weight calculation.
  - Pricing model support: `FLAT` vs `PER_PARCEL` charge calculations and immediate payment status recording (`paidAtRegistration`).
  - Sequential ID generation: `SHP-YYYY-XXX` and `TRK-YYYY-XXXXXX`.
- **Past Shipments Explorer (`Find Parcel`):** Comprehensive shipment lookup and inspection:
  - FlatList with server-side SQL pagination (`Pageable`, 20 per page) preventing memory leaks and heap exhaustion.
  - Subheader displaying total shipments count and note that records include shipments registered from the office PC.
  - Filter tabs matching prototype: `RECENT / ALL`, `NEEDS LABEL`, and `SCAN QR` viewfinder.
  - Search input with 250ms debouncing querying by Shipment ID, Client Name, Recipient Name, Contact, or Parcel Tracking ID via JPQL subquery.
  - Shipment summary cards displaying `PC` vs `MOBILE` registration tags, status pill, quantity, contact, and `labels printed` vs `needs label` badges.
  - Detailed shipment view (`ShipmentDetailScreen`, Screen 39): metadata breakdown, client/recipient details, list of parcel units with dimensions, and `PRINT ALL LABELS` / `REPRINT ALL LABELS` action buttons.
  - Single parcel detail view (`ParcelDetailScreen`, Screen 40): `PACKAGE X OF Y` badge, recipient, client, parent shipment navigation link, destination hub, status pill, label status, dimensions pill, `REPRINT LABEL` button, and expandable chronological scan audit timeline.
  - Reusable camera viewfinder scanner modal (`BarcodeScannerModal`) with `expo-camera` supporting QR and Code-128 barcode scanning, camera permission prompts, and manual tracking number entry fallback.
- **Verification & Testing:**
  - Automated integration tests in `ShipmentIntegrationTest.java` verifying search by parcel tracking ID, label status filters (`NEEDS_LABEL`, `PRINTED`), role-gating (`FIELD_STAFF` blocked with HTTP 403, `OFFICE_STAFF` permitted), and summary DTO mapping (`registeredVia`, `allLabelsPrinted`).
  - Automated label print audit tests in `ParcelPrintIntegrationTest.java` (8/8 passing).
  - Frontend Node unit test suites (`tests/registration.test.mjs`, `tests/shipments.test.mjs` - 31/31 passing).
  - Verified clean compilation and bundling across Web, iOS, and Android via `npx expo export`.

**6.3a — Software Label Printing, Virtual Driver Isolation & Audit Hardening (Screens 41–44)** — **[COMPLETED]**
- Vendored Project Nayuki QR Code Generator v1.8.0 under its MIT license, preserving the shared matrix, SVG path, and monochrome BMP interfaces while supporting versions 1–40 and UTF-8 payloads.
- Independent `jsqr` round-trip coverage across short, long, alphanumeric, and Unicode payloads, including limited module damage recovery.
- Strict canonical label normalization using shipment detail fields. Missing tracking, shipment, recipient, address, or destination values stop the print job before transport.
- Printable HTML encodes every dynamic value and validates numeric fields before formatting.
- Explicit virtual and Bluetooth drivers. Virtual/test jobs are visibly marked as simulation and never write backend audit state. The Bluetooth driver reports `TRANSPORT_UNAVAILABLE` for physical transmission until hardware validation is complete.
- Globally serialized mobile print jobs return explicit per-item transmission and audit results. Partial physical success audits only transmitted tracking IDs without retransmitting labels.
- Durable per-user print-audit outboxes use AsyncStorage on mobile and localStorage on web. Audit retries are independent of printer transport and survive application restarts.
- System/PDF printing uses a three-way confirmation: printed successfully records the exact job, saved as PDF preserves `NOT_PRINTED`, and cancelled makes no state change.
- Backend print auditing requires a stable UUID, locks the shipment, validates the complete batch before mutation, and treats exact retries as no-ops while rejecting altered UUID reuse.
- Canonical shipment detail is loaded before registration-result, shipment, or parcel print actions are enabled.
- Fail-closed outbox durability: `AUTH_PAUSED` entries are recovered upon re-authentication; silent 100-entry truncation replaced with a 500-entry capacity limit and `OutboxCapacityError`; storage read failures never overwrite or discard un-synced audit records.
- Runtime security & profile hardening: Removed default `dev` profile and hardcoded fallback `jwt.secret` from `application.properties`, verified via `ProductionDataSourcePropertiesTest`.
- Bounded shipment pagination: Query parameters `page` (clamped >= 0) and `size` (bounded [1..100]) enforced in `ShipmentController.java` to prevent memory exhaustion and invalid page errors.

**6.3b — Physical Bluetooth Integration & Xprinter XP-470B On-Device Validation** — **[IN PROGRESS]**
- Validated on-site Xprinter XP-470B / XP-420B thermal label printer hardware (203 DPI, A6/A7 format).
- Added `tsplFormatter.js` generating TSPL label options matching `prototype qr print.png` layout in 90-degree rotated landscape orientation.
- Added Android 12+ runtime Bluetooth permission requests (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`) in `bluetoothPrinterService.js` and updated native `AndroidManifest.xml` and `app.json`.
- Unlocked physical Bluetooth label transmission via native `BluetoothTscPrinter` module.
- Removed `[ T ]` brand badge completely from both mobile and web shipping label layouts (`tsplFormatter.js`, `ThermalLabelPreviewModal.js`, `escposFormatter.js`, `LabelPreview.js`, `PrintLabelsModal.js`, `labelPrintServiceCore.mjs`).
- Implemented crisp solid outer border (4 edges) and solid header divider lines using TSPL `reverse` rectangles, plus dashed divider lines separating body from footer and framing the total amount.
- Positioned both dashed dividers with TSPL rectangles so their final dash touches the inside edge of the right border without overflowing; covered divider endpoints, dash gaps, and omitted totals in printer regression tests.
- Moved shipment numbers to the right side of the client row above the total across Bluetooth, HTML printing, and web/mobile previews. Contents now span the full inner width and wrap before the right border; client names wrap within the left column without shifting the shipment number.
- Corrected HTML label page-size syntax to `150mm 100mm` and Expo system-print dimensions to `425` by `283` at 72 PPI for the same stock; physical system-print layout verification remains pending.
- Wrapped complete Bluetooth footer contents and client names and fit footer typography to the available space. Reject oversized footers instead of truncating text.
- Anchored Bluetooth totals to a fixed right edge using TSPL font widths so larger amounts expand leftward inside the border.
- Wrapped Bluetooth delivery addresses at word boundaries using the available width before the right border, preserving the complete address and keeping `Manila` together.
- Replaced the arrow-prefixed destination hub below the address with the entered shipment route across Bluetooth, HTML printing, and web/mobile previews. Long Bluetooth routes wrap to fit; missing routes are omitted instead of derived from origin/destination.
- Removed the duplicate route below the shipment number from print output and previews; the route now appears only below the address.
- Restricted virtual printing to development builds using `__DEV__`; its setup card is hidden in all builds by a separate flag set to `false`, retained for future development use. Production ignores saved simulation mode and virtual selections, rejects simulation activation/connections/direct driver calls, and preserves physical printer operation.
- Added one 500 ms retry for the native `Unable to connect device` connection error. Concurrent connects to the same device share one attempt; switching targets is rejected while connecting. Printer setup disables conflicting controls until completion. Permission/other errors and print jobs are not retried.
- Limited new shipment delivery addresses to 80 characters and descriptions to 120 characters in web/mobile registration and API validation; registration forms show character counters. New-client billing addresses used for delivery follow the same 80-character limit. Existing stored data is preserved.
- Scaled up typography across all thermal label fields (large font 4 bold for brand title, tracking ID, destination hub, and total amount; font 3 for recipient name, telephone, address, contents, shipment ID, client, and route) for high visibility in logistics environments.
- Expanded brand title slicing limit to 36 characters to prevent truncation of full business names (e.g. *TC & CT Integrated Logistics*).
- Verified via unit test suites: `printer.test.mjs` (42/42 passing), `registration.test.mjs` (29/29 passing), `registrationRetry.test.mjs` (5/5 passing), and `labelPrint.test.mjs` (11/11 passing).
- Verified shipment API registration limits with `mvn -Dtest=ShipmentIntegrationTest test` (34/34 passing), including exact-limit persistence and one-character-over-limit rejection without writes.

**6.4 — Field Staff: Camera QR Scanner & Status Flow Engine (Screens 45–48)** — **[COMPLETED]**
- Real-time camera viewfinder QR and Code-128 scanner (`expo-camera`) with torch toggle, four-corner orange reticle, horizontal scan line, safe platform-guarded haptics (`expo-haptics`), and manual `TRK-YYYY-NNNNNN` entry fallback with a compact `GO` button.
- Dedicated scan context endpoint (`GET /api/v1/tracking-events/scan-context/{trackingId}`) role-gated strictly to `FIELD_STAFF` (`@PreAuthorize("hasRole('FIELD_STAFF')")`), providing parcel identity, sequence (`PACKAGE X OF Y`), current status, proposed next status, and vehicle requirements while stripping recipient, address, billing, and payment PII.
- Strict status flow engine with sequential transition validation (`REGISTERED` -> `QR_GENERATED` -> `LOADED_ON_TRUCK` -> `ARRIVED_AT_TNL` -> `LOADED_TO_HAULER` -> `COMPLETED`); only `COMPLETED` is terminal.
- Mandatory active vehicle fleet enforcement: `LOADED_ON_TRUCK` requires an active vehicle from `GET /api/v1/vehicles`; transitioning to `ARRIVED_AT_TNL` or `LOADED_TO_HAULER` safely clears the parcel's current vehicle assignment while preserving historical audit events.
- Single scan workflow (`POST /api/v1/tracking-events/scan`): context review, vehicle selector, submission progress indicators, inline lookup recovery, and idempotent retry detection (`transitionApplied = false` creating zero duplicate tracking events).
- Rapid batch workflow (`POST /api/v1/tracking-events/batch-scan`): operation selector, fleet selector, 100-item queue with duplicate prevention and 750ms camera cooldown, deadlock-free sorted pessimistic locking, pre-validation of all transitions before entity mutation, atomic transaction rollback on failure, selective inactive vehicle idempotency, and discard confirmation navigation guards (`beforeRemove`).
- Real-time SSE broadcast synchronization: tracking events are published to connected clients strictly after transaction commit via Spring's `TransactionSynchronizationManager.afterCommit()`, preventing phantom broadcasts from rolled-back batches.
- Staff-type authorization is enforced before single and batch locks or mutations: `INTERNAL_TRUCK` handles truck load/arrival, `HAULER_STAFF` handles hauler handover/completion, `null` staff type retains sequential access, and unknown types fail closed.
- Mobile scanner selectors filter Rapid Batch operations, keep `COMPLETED` Single Scan-only, hide hauler vehicle controls, and render unauthorized Single Scan transitions as read-only.
- Verification & Testing: 30/30 `TrackingScanIntegrationTest` tests, 159/159 mobile Node tests, and Android Hermes production export passed.

**6.5 — Field Staff: Personal Scan & Tracking History (Screens 49–52)** — **[COMPLETED]**
- Flyway migration `V29__add_personal_tracking_history_indexes.sql`: composite performance indexes on `tracking_event` (`staff_id, event_timestamp, event_id` and `staff_id, tracking_id, event_timestamp, event_id`) optimizing personal feed sorting, shift metric counters, and parcel ownership checks.
- Dedicated personal activity feed REST endpoints role-gated strictly to `FIELD_STAFF` (`@PreAuthorize("hasRole('FIELD_STAFF')")`):
  - `GET /api/v1/tracking-events/mine` — Server-side paginated personal scan feed (`page`, `size` [1..50], `status`, `search` filtering).
  - `GET /api/v1/tracking-events/mine/metrics` — Daily shift metrics (Total Scans Today, Loaded on Truck, Arrived at TNL, Handed to Hauler) evaluated strictly within the server-local calendar day boundary (`LocalDate.now()`).
  - `GET /api/v1/tracking-events/mine/parcels/{trackingId}` — Operational parcel inspection and chronological personal scan timeline.
- Strict Privacy & Data Boundary Enforcement:
  - Zero PII Exposure: `PersonalTrackingEventResponse`, `PersonalScanMetricsResponse`, and `PersonalParcelHistoryResponse` strictly exclude recipient name, client name, addresses, contact numbers, remarks, billing/payment data, and print events.
  - Personal Scoping: Staff identity is derived solely from the authenticated JWT principal (`authentication.getName()`); no staff ID parameters are accepted from untrusted clients.
  - Generic Parcel Detail PII Bypass Closed: Updated `GET /api/v1/parcel-units/{trackingId}` in `ParcelUnitController` to `@PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")`, blocking `FIELD_STAFF` from retrieving sensitive customer data.
  - Parcel Scan Ownership Gating: Field staff can only view operational details for parcels they have personally scanned (`hasStaffScannedParcel`). Unowned parcels return HTTP 404 Not Found (matching nonexistent parcels to prevent tracking ID enumeration).
- Mobile Implementation & UI (Screens 49–52):
  - Pure, testable business logic in `src/features/tracking-history/trackingHistoryFlow.mjs` (query normalization, server pagination merging with duplicate suppression, shift metrics mapping, timestamp and package formatters without fabricated fallbacks, and `replacePageZeroEvents`).
  - API client `src/features/tracking-history/services/trackingHistoryApi.js` leveraging centralized `apiClient`.
  - Main history screen (`src/app/(main)/tracking-history/index.js`): 2x2 daily shift metrics grid matching `prototype field tracking page.png`, debounced search input, server pagination (`HISTORY_PAGE_SIZE = 20`) coordinated with pure request coordinator (`trackingHistoryRequestCoordinator.mjs`) managing abort controllers, query generation version tokens, and pagination locks, pull-to-refresh, empty and error states with retry, and role guard.
  - Selected parcel screen (`src/app/(main)/tracking-history/[trackingId].js`): operational parcel summary card matching `prototype field tracking selected.png`, `SHOW/HIDE MY HISTORY` collapsible toggle (collapsed by default), chronological personal scan timeline with orange dots and vertical connector lines, non-looping focus refresh, and 404 handling.
  - Components: `PersonalScanMetrics`, `PersonalTrackingEventCard`, `PersonalParcelSummary`, `PersonalTrackingTimeline` (with zero fabricated operational defaults).
  - Wired navigation in `(main)/_layout.js` Stack navigator and hooked `FieldDashboard.js` `handleTrackingHistory` action.
- Verification & Testing:
  - Automated integration test suite in `PersonalTrackingHistoryIntegrationTest.java` (18 tests covering all 6 supported statuses, pagination completeness without omissions, equal-timestamp `eventId DESC` sorting, field-owned QR metric increment, role gating, and PII exclusion).
  - Mobile unit test suite in `tests/trackingHistory.test.mjs` (26 tests covering all pure helpers, non-fabricated package/status fallbacks, page-zero replacement, and request coordinator lifecycle; 108 tests passing total).
  - Clean Expo production exports across Web, Android, and iOS.
  - Physical on-device acceptance testing on field hardware completed and verified.

**6.6 — Mobile Staff Account, Security & 4-Digit PIN Settings (Screens 53–55)** — **[COMPLETED]**
- Authenticated Mobile Screens (Screens 53–55):
  - Screen 53 (`src/app/(main)/settings/index.js`): Staff account, session, and bound-device overview with compact back header, identity card (initials square, full name, `@username`, immutable user ID, role, and optional staff type), session/device card (shift access status, PIN configuration status, masked device ID `••••••••a12f93bc`, formatted last authenticated timestamp), security action list, and destructive device-unbind section.
  - Screen 54 (`src/app/(main)/settings/password.js`): Authenticated in-app password rotation with current password, new password (minimum 8, maximum 128 characters), confirmation matching, show/hide visibility toggles, disabled submission until valid, and isolated rate limiting.
  - Screen 55 (`src/app/(main)/settings/pin.js`): Password-authorized 4-digit PIN rotation governed by explicit state machine (`PASSWORD_CHALLENGE` → `NEW_PIN` → `CONFIRM_PIN` → `SUBMITTING` → `SUCCESS`), requiring `POST /api/v1/auth/verify-password` challenge, 4-dot `PinIndicator`, 3x4 `Keypad`, in-memory password forwarding to final submission, and automatic sensitive state cleanup on app background/unmount.
- Backend Contracts & Security Hardening:
  - Typed Current User Response (`GET /api/v1/auth/me`): Returns `CurrentUserResponse` containing `userId`, `username`, `fullName`, `role`, `staffType`, `mustChangePassword`, `hasPinSet`, and masked `deviceBinding` (`maskedDeviceId`, `active`, `lastAuthenticatedAt`). Constant-time device token comparison using required `X-Device-Id` and `X-Device-Token` headers.
  - In-App Password Rotation (`POST /api/v1/auth/password-change`): Verifies `oldPassword` with BCrypt, rejects reused passwords, increments `tokenVersion` once, issues replacement JWT, and leaves existing device bindings active.
  - Password Challenge (`POST /api/v1/auth/verify-password`): Replaces administrator-specific error with generic `Incorrect current password.` and applies isolated rate limiting.
  - 4-Digit PIN Setup & Rotation (`POST /api/v1/auth/mobile-setup-pin`): Hardens regex to strictly 4 digits (`^[0-9]{4}$`), conditionally requires `currentPassword` when `pinHash` already exists (rotation), rejects PIN reuse, increments `tokenVersion`, issues replacement JWT, and leaves device bindings active.
  - Current-Device Unbinding (`POST /api/v1/auth/mobile-unbind`): Atomically sets caller's specific `MobileDeviceBinding.active = false`, increments `tokenVersion`, preserves binding audit row and other device bindings, and clears local mobile storage only upon server confirmation.
  - Revocation Differentiation (`JwtAuthenticationFilter`): Protected requests with stale, expired, or version-mismatched JWTs return HTTP 401 with `code: SESSION_REAUTH_REQUIRED`, while insufficient roles return HTTP 403. Public auth endpoints bypass bearer token inspection.
  - Dedicated Rate-Limiting Namespaces: Independent failure counting via `LoginRateLimiterService` for password change (`ep:password-change`, `password-change:user`), password verification (`ep:verify-password`, `verify-password:user`), and PIN rotation (`ep:pin-rotation`, `pin-rotation:user`) without cross-contaminating login or unlock throttles.
  - Serialized Security Mutations: Password, PIN, and unbind changes use pessimistic user locking; operations that touch a binding then acquire its lock in the fixed user-then-binding order. Every successful mutation increments `tokenVersion` exactly once without a schema migration.
  - Initial PIN Recent Authentication: Password-free first PIN setup requires both JWT `iat` and binding `lastAuthenticatedAt` within five minutes, with the specified 60-second clock-skew allowance.
  - Explicit Mobile Authorization: PIN setup/rotation and current-device unbinding require `FIELD_STAFF` or `OFFICE_STAFF`; Admin receives `403 MOBILE_ROLE_REQUIRED`.
  - Accepted Cryptography Contract: Passwords and exactly four-digit PINs retain BCrypt cost 10. Existing bindings intentionally remain active after password and PIN rotation.
- Mobile Architecture & Storage Lifecycles:
  - Pure Transition Engine (`src/features/auth/services/authStorageTransitions.mjs`): Pure, testable storage transitions (`replaceAuthenticatedSession`, `clearAccessSessionPreservingBinding`, `clearDeviceSession`) with zero storage of passwords, PINs, or PIN hashes.
  - Pure Security Flow Helpers (`src/features/settings/accountSecurityFlow.mjs`): `deriveInitials`, `formatRole`, `maskDeviceId`, `validatePasswordChange`, `validateFourDigitPin`, and `normalizeSecurityError` with zero fabricated fallbacks.
  - Stale Response Protection & Single-Retry: Axios response interceptor retries once on `401 SESSION_REAUTH_REQUIRED` if a newer replacement token exists in storage.
  - Sensitive Error Redaction: Login, profile, password, PIN, device status, and unbind failures expose only safe status/code/message/retry metadata and remove request bodies, bearer tokens, raw device tokens, and Axios configuration.
  - AuthContext Operations: Handles `rotatePasswordInSession`, `rotateUserPin`, `lockSession`, `startPasswordReauthentication`, `unbindCurrentDevice`, and `clearInvalidDeviceSession`.
  - Native cold-launch restoration requires PIN for fully configured bound users; background, inactive, and focus-loss events remain unlocked. Explicit manual Lock still persists immediately, while password-change and initial-PIN setup flows remain exempt.
  - Header & Dashboard Navigation: `MobileHeader` receives `onAccount` routing to Screen 53 and keeps quick Lock action; removes header-level destructive logout; updates `FieldDashboard` (Screen 33) and `OfficeDashboard` (Screen 31) `ACCOUNT & SHIFT` cards to navigate to `/(main)/settings`.
- Verification & Testing:
  - Targeted backend verification: `MobileAuthIntegrationTest` (53) and `SecurityIntegrationTest` (19), 72/72 passing, including rollback and concurrent credential-mutation coverage.
  - Full backend regression suite: 280/280 passing.
  - Mobile verification: `tests/authSecurity.test.mjs` 16/16 passing; full mobile suite 124/124 passing.
  - Multi-platform production export verification via `npx expo export`: Web, Android, and iOS passed with output outside the repository.
  - Mobile dependency audit passed the configured high-severity threshold; 13 transitive moderate advisories remain because available fixes require breaking Expo dependency changes. No automated fix was applied.
  - Backend OWASP dependency analysis migrated to automated GitHub Actions CI/CD workflows (`.github/workflows/owasp-check.yml` and `.github/workflows/dependency-review.yml`) with NVD API key and local cache support.
  - Physical on-device acceptance testing on mobile hardware completed and verified.

---

## Phase 7 — Post-Demo Client Changes & System Enhancements — **[COMPLETED]**
*Consolidated client change requests, operational refinements, and quality infrastructure.*

**7.1 — Per-Unit Registration, Dynamic Rates & Settings-Based Pricing** — **[COMPLETED]**
- Migration `V31__add_rate_per_kilo_and_shipment_snapshots.sql`: adds nullable `rate_per_kilo` setting and 5 shipment calculation snapshots (`applied_rate_per_kilo`, `applied_volumetric_divisor`, `total_actual_weight_kg`, `total_volumetric_weight_kg`, `billable_weight_kg`).
- Backend rating engine enforces `PER_KILO` charge model, mandatory `@NotNull` stale settings guards (`expectedRatePerKilo`, `expectedVolumetricDivisor`), calculation overflow bounds (`DECIMAL(12,2)` / `DECIMAL(10,4)`), decimal-safe `HALF_UP` calculations, and recipient consignee identity derived from active billing client.
- Migration `V32__add_client_rate_per_kilo.sql`: adds nullable Admin-managed rate per kilo to each client (`client.rate_per_kilo`), allowing client-specific overrides while falling back to global system settings.
- Web Admin client profiles can enable, update, or disable the custom rate; web and mobile registration reload effective pricing dynamically after client selection.
- Web and mobile registration applications updated with compact 10-unit paginated parcel editors, render-aware jump-to-error navigation, modular extracted components (`ParcelUnitsEditor.js`, `ShipmentPricingSummary.js`), read-only rate per kilo, live breakdown summaries, quantity sync with confirmation guards, and 409 stale-settings recovery.
- Verification passed across backend (346 tests), web (53 tests), mobile (157 tests), and Expo web/Android production exports.
- Decimal pricing parity [COMPLETED]: both frontends use feature-local fixed-point helpers for per-unit and legacy calculations, matching backend `HALF_UP` rounding order and using integer cents for totals.
- Web client-retry handling [COMPLETED]: successful client creation selects the returned client in Existing mode before shipment submission, preserves shipment fields across rejection and explicit resubmission, and prevents duplicate in-flight submissions while disabling form editing.
- Latest pricing/retry verification [COMPLETED]: 91 web tests, 226 mobile tests, 36 focused backend tests, and Admin web plus mobile web/Android/iOS production exports passed. Scoped audit and targeted merge-review follow-up against local `dev` found no unresolved code findings in the registration/pricing slice; broader historical branch changes are outside this follow-up.
- Pricing/retry manual acceptance [UPCOMING]: browser retry transition and physical-phone decimal pricing checks remain pending. Evidence and approved remediation log: `.review/pricing-retry-evidence.md`.

**7.2 — Configurable SOA Bank Details & Formatted Statement Printing** — **[COMPLETED]**
- First-boot SOA/pricing implementation [COMPLETED]: step 2 groups Company Details, SOA Bank Details, and Pricing. Bank name, account name, string account number, and rate per kilo start blank without placeholders; existing company defaults remain. Shared bank validation enforces single-line 100/150-character names and 6–20 digits. Rates require at least PHP 0.01, up to 10 integer digits, and at most two decimal places, with malformed web input rejected before numeric conversion. Back/Next retains values; saving disables editing/navigation and synchronously rejects duplicate submissions.
- First-boot persistence/privacy [COMPLETED]: mandatory server validation and `BigDecimal` pricing; bank strings trimmed before validation and persistence. Administrator and settings save in one transaction while retaining collection day, volumetric divisor, and prefixes. Cache refresh and safe `CompanyBrandingDto` SSE delivery occur after commit. Existing setup-completion guard and administrator session behavior remain; existing installations retain their configuration. No migration, dependency, deployment-config, or mobile changes.
- First-boot automated verification [COMPLETED, 2026-10-16]: from `backend`, `mvn test '-Dtest=FirstBootIntegrationTest,SystemSettingIntegrationTest,SystemSettingServiceImplTest,SecurityIntegrationTest,AdminConsoleAuthorizationIntegrationTest,FourRoleAuthorizationIntegrationTest'` passed 93 tests with no failures/errors/skips. A final `mvn test '-Dtest=FirstBootIntegrationTest'` rerun passed 27 tests after adding SOA preview readback assertions. From `frontend-web`, `node --test tests/*.test.mjs` passed all 151 tests, including 36 new setup regressions; `npx.cmd expo export --platform web --output-dir ../.review/first-boot-web-export` passed. `git diff --check` passed. Export output is ignored generated verification data.
- First-boot verification evidence: integration tests use committed requests in the isolated `tnl_first_boot_test` schema with sample/admin seeding disabled. A previously warmed cache reflects the new bank/rate settings; the SSE callback verifies persisted data from an independent transaction. Settings and SOA preview return exact bank text and leading-zero account numbers, and shipment calculation settings return the configured rate. Auth, branding, and captured SSE payloads omit bank fields. Missing/invalid financial input returns 400, repeat setup returns 409, and an injected persistence failure after settings flush leaves no administrator, bank details, company changes, cache changes, or SSE delivery. Existing Settings/security tests cover 401/403 role gates. The first verification attempt found a missing `clientId` in the new pricing test; adding the required isolated client fixture corrected the test request without changing assertions or endpoint behavior.
- First-boot manual acceptance [COMPLETED, 2026-10-16]: the user tested with the `firstboot` profile and confirmed the feature is working. This is user-reported acceptance; browser automation was unavailable in the agent session. Expected database state: one initial `USR-ADMIN`, singleton settings containing trimmed bank/account names, unchanged leading zeros, and decimal rate; collection day/divisor/prefixes remain unchanged. Expected responses: setup 201 with an administrator token and no bank fields, authenticated Settings 200 with bank fields, subsequent setup 409. Repeatable downstream checks: a client without a pricing override and a 2 kg shipment with negligible volumetric weight at PHP 37.25/kg should produce PHP 74.50 before other charges; eligible SOA preview and printed copies should use the saved bank details. Individual downstream/physical-print checks were not separately reported.
- Migration `V33__add_soa_bank_details.sql`: adds nullable SOA bank name, account name, and text account number settings without embedding real account data.
- Admin settings validate and persist the three fields; staff branding, SSE payloads, and logs exclude them.
- Workflow fixtures seed fictional demonstration values only for blank fields and preserve custom configuration.
- SOA preview and print use current persisted financial/company/bank data, block invalid configuration and unsaved adjustments, use the approved logo, and render two complete A4 copies with restarted page numbering.
- Hardened two-copy multi-page sequence (`statementPrintModel.mjs`) repeating every physical sheet with independent page counters (`Page X of Y`).
- Verification passed across backend suite (350 tests), web suite (63 tests), workflow integration coverage, Flyway fresh/upgrade paths, and Expo web production export.

**7.3 — Split Waybills, Hauler Console & 15-Item Manifest Printing** — **[COMPLETED]**
- Migration `V34__split_waybill_manifests.sql`: supports multiple waybills per shipment and explicit manifest parcel persistence. Existing waybills backfilled with all shipment units.
- Managed-MySQL V34 compatibility code and automated verification [COMPLETED]: the backfill guard declares a primary key while retaining its consistency check. Six focused tests reproduce the original primary-key failure and verify upgrades, data rejection, failed-history recovery, and successful-V34 checksum reconciliation; 14 legacy-upgrade and 7 split-waybill tests also pass. Deployed schema inspection and controlled Flyway recovery [UPCOMING]; the live database has not been modified. Evidence: `.review/v34-primary-key-recovery.md`.
- Backend manifest generation is atomic after loading transitions have succeeded. Completion requires matching `confirmedWaybillId`, is Hauler Staff-only, locks the persisted manifest, completes only its units, and is retry-safe. The parcel return-scan endpoint is retired (V35 table preserved for historical compatibility).
- Hauler Staff Dedicated Console: replaced generic `SCAN QR` with `WAYBILLS` on `FieldDashboard` for `HAULER_STAFF`, providing a clean 2-card grid (`WAYBILLS` and `TRACKING HISTORY`) and redirecting transit scanning to `/(main)/waybills`.
- Hub Loading Queue: expanded `GET /api/v1/waybills/shipments/{shipmentId}/available` to return unassigned units in both `ARRIVED_AT_TNL` and `LOADED_TO_HAULER` statuses, enabling hauler staff to batch-queue all units awaiting dispatch with one-tap unit chips and "+ ADD ALL TO QUEUE".
- Manifest Review & Selection Safety: accepted units remain visible in the manifest queue while duplicate, rejected, wrong-shipment, and already-assigned scans receive specific messages. `GENERATE WAYBILL` opens a final confirmation modal showing the shipment, exact unit count, and every queued tracking ID; generation uses a synchronous double-submission guard.
- Keyboard Ergonomics & Selected Context Cards: added `KeyboardAvoidingView` height handling, on-drag keyboard dismissal, camera auto-collapse during manual entry, keyboard-open option taps, and persistent selected shipment/waybill cards with one-tap `CHANGE` reset.
- 15-Item Paginated Waybill Layout: configured `WAYBILL_ITEMS_PER_PAGE = 15` across web preview (`WaybillManifestCard.js`), web print (`waybillPrint.mjs`), and mobile print (`printWaybill.mjs`). Every sheet repeats the full top brand letterhead, hairline divider, left waybill metadata, center return QR, and right-aligned consignee block. Solid black divider separates headers from items table; summary and signatures are isolated to the final sheet; bottom footnote (`Waybill <ID> | Manifest for <Consignee> | Page X of Y`) appears on every sheet.
- Web Waybill Directory & Inspection: dedicated administrator-only paginated directory at `/waybills` with debounced search, status/hauler filters, and `/waybills/[id]` detail manifest view.
- Verification passed across `SplitWaybillIntegrationTest` (7 tests), `WaybillShipmentOptionsIntegrationTest` (6 tests), web suite (70 tests), mobile suite (176 tests), and production exports.

**7.4 — Online-Only Mobile Scanner, Ergonomics & Access Hardening** — **[COMPLETED]**
- Pre-deployment scope decision: removed offline SQLite replay subsystem across mobile and backend, enforcing online-only scanning with fail-closed NetInfo connectivity gating.
- Single and batch scan operations submit directly to `POST /api/v1/tracking-events/scan` and `POST /api/v1/tracking-events/batch-scan` with in-memory state.
- Dynamic Camera Viewfinder & Gesture Resizing: draggable `PanResponder` divider handle shared by Field and Hauler Staff screens with collapsed (0px), compact (160px), and expanded (280px) snap positions, responsive reticle scaling (104px compact / 200px expanded), spring settling, and accessible adjustment actions. Dragging updates one animated height value without per-frame React state changes.
- Keyboard-Aware Viewport Collapse: camera preview automatically collapses when manual text inputs receive focus and restores upon keyboard dismissal, preventing layout clipping on small screens.
- Web Console Access Restriction: restricted web login, console routes, and console-only API operations strictly to `ADMIN` while preserving office and field mobile workflows.
- Public Staff Android APK Download: web login renders staff Android app download link when `EXPO_PUBLIC_ANDROID_APK_URL` is set, pointing to public GitHub Release asset.
- Verification: backend authorization and scanner tests passed at the recorded 331-test checkpoint; the latest full mobile suite passed (176 tests) and the Android production export completed successfully.

**7.5 — Mobile Discovery Rails & Query Recommendations** — **[COMPLETED]**
- Mobile Recent Shipment Rail: added Hauler Staff `GET /api/v1/waybills/shipment-options` with 20-item horizontal `FlatList` rail on Load & Generate screen with deduplication, retry triggers, and 250ms debounced search recommendations capped at 8 results.
- Mobile Returned Waybill Rail: added Hauler Staff `GET /api/v1/waybills/options` with 20-item horizontal `FlatList` rail and 250ms debounced waybill search recommendations. Shipment and waybill rails accept selections while the keyboard is visible.
- Preserved mandatory printed-waybill QR scan confirmation gate; recommendation selection enables inspection without bypassing the return confirmation scan requirement.
- Coordinated cancellable request coordinator aborts stale requests on input changes, mode changes, sign-out, or unmount.
- Mobile Courier Vehicle Selection Pagination: added staff-accessible paginated vehicle endpoint `GET /api/v1/vehicles/options` (default 20, active filtering, plate/ID/description search), pure request coordinator `vehicleOptionsFlow.mjs`, reusable `VehiclePicker` component with 250ms debounced search recommendations and horizontal paginated `FlatList` rail with retry and END markers, integrated into `SingleScanReview` and `BatchScanPanel` with lifecycle cancellation in `scan.js`.
- Courier empty-fleet loading fix [COMPLETED]: track successful initial vehicle loads independently from list length so single-scan review does not continuously refetch an empty fleet; preserve explicit reloads and reset the loaded flag when courier permissions are removed. Screen-effect regression coverage includes empty responses, explicit reloads, failed-load recovery, and offline skips.
- Empty-fleet fix verification: all 242 mobile tests passed and the Android production export succeeded; scoped audit found no issues. Native UI acceptance checks remain manual.
- Verification: 22 affected backend tests passed (`VehicleOptionsIntegrationTest`, `FourRoleAuthorizationIntegrationTest`, `TrackingAndVehicleIntegrationTest`); full mobile suite passed 238 tests (`vehicleOptions.test.mjs`, scanner, and discovery rails).

**7.6 — High-Volume Load Testing, Synthetic Seeder & Dev Fixtures** — **[COMPLETED]**
- Dedicated Spring Boot `loadtest` profile (`application-loadtest.properties`) with HikariCP tuning and Hibernate strict `ddl-auto=validate`.
- Low-memory Docker Compose environment (`docker-compose.loadtest.yml`, 512 MB RAM / 0.5 vCPU) with MySQL memory optimizations and JVM Serial GC.
- Opt-in synthetic seeder (`LoadTestDataSeeder.java`) generating 50,000 shipments, 500 clients, 100 vehicles, tracking events, and payments using deterministic seed (`20260925`) and batch processing.
- Load-test workflow alignment [COMPLETED]: service-backed per-kilo registration and pricing snapshots, print/reprint audits, four-role accounts and mobile PINs, sequential courier/dispatcher scans, split and multi-page manifests, loss/recovery/reconciliation, direct delivery, and three weekly SOA/collection cycles with deductions and unbilled shipments. Preserves the configurable volume, random seed, and transaction batch size. A final disabled-account fixture detects outdated or interrupted seeds; existing load-test volumes require an explicit fresh seed. k6 hybrid scripts discover tracking IDs from the API instead of assuming the retired synthetic ID format. Verification: 15 tests passed across `LoadTestDataSeederTest`, `LoadTestDataSeederIntegrationTest`, `LoadTestEnvironmentGuardTest`, and `LoadTestSchemaValidationIntegrationTest`; JavaScript syntax checks passed for both hybrid scripts. Full 50,000-shipment Docker seeding is verified; live k6 benchmarks remain manual checks.
- Bulk load-test seeding [COMPLETED]: generate 72 canonical shipments through the current workflow services, then expand their complete record graphs with bounded parameterized multi-row inserts. Preserve all 24 operational scenarios, tracking/print/loss/reconciliation audits, split manifest memberships, client-specific pricing, payments, and three billing cycles. Reserve application identifiers per batch and recompute print fingerprints for retry consistency. A separate simulation seeding override temporarily raises CPU, memory, JVM heap, and MySQL buffer-pool capacity; benchmark containers retain their original limits.
- Bulk-seeder verification: all 15 focused Maven tests passed, including 144 shipments across service and bulk paths, all 24 scenario states, identifier allocation, print retry fingerprints, payments, and audit references. The approved isolated simulation reset completed with 50,000 shipments, 145,827 parcels, 27,081 waybills, and 1,437 statements. Bulk expansion took about 70 seconds (roughly 0.3-0.5 seconds per 250 shipments versus the previous 22.8 seconds); service-backed financial seeding took about 3 minutes 23 seconds. Normal MySQL durability remained enabled. Full-dataset SQL checks found no pricing, quantity, payment, tracking-state, fingerprint, manifest, or exception-reference inconsistencies. Runtime containers are restored to the original simulation resource settings before benchmarking.
- Database safety guards (`LoadTestEnvironmentGuard.java`) enforcing database name validation (`tnl_loadtest`) and strict count checks.
- k6 performance testing suite in `load-tests/` (`smoke.js`, `baseline.js`, `realistic-simulation.js`) achieving 100% success rate across 1,451 live hybrid operations under resource limits.
- Development Data Seeder & Workflow Fixtures: synchronized `application-dev.properties` to opt into `app.seed.workflow-fixtures=true` with rich scenarios 7–12 (unprinted labels, hauler queue, generated waybill, returned waybill, partial split completion).
- Current workflow-profile fixtures [COMPLETED]: dedicated `WorkflowDataSeeder` using current registration, tracking, printing, payment, waybill, parcel-exception, and statement services. Covers 100 shipments, 36 waybills including an 18-parcel manifest, pagination, three billing cycles, loss/recovery/reconciliation, and account onboarding. Uses fictional staff names (Elena Navarro, Carlos Mendoza), businesses (Bicol Home Essentials, Sierra Vista Wholesale), haulers (Camino Real Transport, Sierra Norte Freight Services), vehicle plates, and cargo descriptions; scenario codes remain searchable. Startup preserves manual changes after the initial transactional seed. New workflow integration tests passed 9/9 on a fresh isolated test database; full backend verification plus targeted rerun reports 441 passed and 5 existing skipped tests. Manual UI/device checks remain pending.
- Verification: unit/integration coverage across `LoadTestEnvironmentGuardTest`, `LoadTestDataSeederTest`, `LoadTestSchemaValidationIntegrationTest`, and `DataSeederWorkflowIntegrationTest` passed.

**7.7 — Four-Role Authorization Model & Staff-Type Retirement** — **[COMPLETED]**
- Planning and threat modeling are complete in `.review/four-role-authorization-migration-plan.md`.
- Target roles: `ADMIN`, `RECEIVING_STAFF`, `COURIER_STAFF`, and `DISPATCH_STAFF`.
- Retires the broad `OFFICE_STAFF` / `FIELD_STAFF` plus `StaffType` model after a fail-closed database and JWT migration.
- Delivery uses three `/ship` runs: backend role cutover, web/mobile adoption, and legacy removal with final authorization verification.
- Execution prompts and handoff gates are documented in `.review/four-role-ship-runbook.md`.
- Ship 1 (Backend Role Cutover) [COMPLETED]: Added four target roles, fail-closed Flyway V36 migration with deterministic duplicate-key guards and token version incrementing, token-persisted role mismatch rejection, and behaviorally equivalent controller/service authorization. Restored Admin and Receiving sequential scans, Dispatch no-waybill direct completion, all-role vehicle reads and scan entry points, Courier/Dispatch financial lookups and operational metrics, lifecycle-driven scan context, and Dispatch-first/Courier-fallback hauler options. Automated verification is complete (383 tests, 0 failures, 0 errors, 5 skipped), diff-scoped audit is clean, and manual acceptance on the cloned development database has passed.
- Ship 2 (Web and Mobile Adoption) [COMPLETED]: Replaced client authorization branches and Admin user-management selectors with explicit roles, removed `staffType` from client requests and presentation, added fail-closed mobile session/routing controls, restored the canonical 2-card dashboards and workflow boundaries (Receiving Intake/Shipments, Courier Scan/History, Dispatch Waybills/History), and added role-routing, direct-navigation, and payload regressions. Verification passed with 80 web tests, 184 mobile tests, and web/Android/iOS production exports.
- Ship 3 (Legacy Removal and Final Closure) [COMPLETED]: Removed StaffType and legacy role aliases/compatibility from runtime contracts, seeds, fixtures, and mobile session translation. V37 validates canonical roles before a single atomic ALTER removes account subtype/company columns and narrows the role enum. Source tracing proves account company unused; waybill hauler snapshots, actor IDs, and history remain. Verification passed: 390 backend tests (0 failures/errors, 5 pre-existing skips), 78 web tests, 182 mobile tests, and Admin web/mobile Android/iOS/web exports. Focused audit: no Critical/High/Medium findings; one informational MySQL syntax notice. Full reports and the manual acceptance guide are in `.review/four-role-ship-3-evidence.md` and `.github/PR_DRAFT.md`; physical-device/browser acceptance was not repeated.

**7.6 follow-up - 50,000-shipment endpoint optimization [IN PROGRESS]**
- Preserve the completed dataset, five connections, 0.5 CPU / 512 MB limits, live authorization, financial contracts, and original shared-account simulation thresholds.
- Courier slice: staff-scoped ID pagination and exact event counts; additive metrics/status indexes.
- Collections slice: per-client database projections with payments aggregated per shipment and per-client balance clamping.
- Endpoint baselines, regression tests, query plans/index/write measurements, and three final simulations are required before performance acceptance.
- Regression checkpoint: 98 affected backend tests passed; the final substring-search change separately passed all 20 personal-history tests. Three complete seeded-cycle collection/dashboard snapshots compare with zero response-field differences. Performance acceptance remains pending.
- Courier implementation and correctness [COMPLETED]: ID-first staff-scoped pagination, exact counts, bounded hydration, measured covering indexes, and materialized substring matches. All 20 history tests passed after the final search revision.
- Collections implementation and correctness [COMPLETED]: per-client projections with per-shipment payment aggregation; all 98 affected tests passed and all three seeded-cycle collection/dashboard snapshots matched exactly.
- Planned three-run verification [COMPLETED]: each unchanged run recorded 357 requests, zero failed requests, 118 completed and zero interrupted iterations, and zero pool timeouts. Admin p95 was 25.87/22.54/24.41 seconds; courier p95 was 18.72/18.50/18.02 seconds.
- Latency acceptance [IN PROGRESS]: original admin 1.5-second and courier 500-ms targets remain unmet at 0.5 CPU / 512 MB and five connections. MySQL saturated its CPU allocation; dashboard and setup tracking-log aggregates remain slow. No further optimization or test reruns were made after the final verification request. Index write-overhead attribution remains inconclusive.
- Delivery evidence: `load-tests/optimization-results.md` records endpoint measurements, query plans, index size/write probes, failed attempts, correctness checks, three-run results, resource samples, and remaining limitations. Final inspection preserved 50,000 shipments and 645,790 events; normal MySQL durability and the 64 MiB buffer pool remain unchanged.
- Role distribution update [COMPLETED]: user-requested `realistic-simulation.js` now peaks at one admin, eighteen courier VUs, one receiving staff member, and one dispatch staff member. Role-specific seeded accounts and authorized read workflows retain the two-minute duration and existing admin/courier thresholds, adding equivalent mobile thresholds for receiving and dispatch. Courier VUs share one session. Syntax verification passed; live role/session and latency verification remain [UPCOMING]. This workload supersedes the all-courier script distribution; historical measurements remain unchanged and the separate ten-minute acceptance plan remains pending.
- Collections indexed payment lookup [COMPLETED]: approved replacement of the payment-derived table with a per-eligible-shipment scalar sum. All projected fields matched for 480 clients across each of three seeded cycles; warm SQL timings improved from 333-359 ms to 266-289 ms. All 33 affected Collections/Dashboard/Reports tests passed. Backend rebuilt without recreating MySQL; seeding skipped at 50,000 shipments. One redistributed-role k6 comparison recorded 2,847 requests, zero failed requests, admin p95 3.42 s, courier p95 1.08 s, dispatch p95 894.40 ms, and receiving p95 1.10 s. Role logins/read workflows verified [COMPLETED]; latency acceptance remains [IN PROGRESS]. MySQL again approached its CPU ceiling. Evidence and limitations: `load-tests/optimization-results.md`.
- Dashboard aggregate implementation and isolated verification [COMPLETED]: consolidate non-lost status/lost counts and cycle shipment/payment totals only. All 51 requested Dashboard/Collections/Reports/authorization tests passed after two new-test corrections; no existing assertions changed. Read-only candidate checks matched all three seeded cycles and financial/date/lost-completed fixtures; complete deployed Dashboard responses also matched three seeded cycles and an empty cycle. Only the backend was rebuilt. The user approved restarting the externally stopped existing MySQL container; its ID, volume, image, limits, and data were preserved, and startup skipped seeding at 50,000 shipments. Isolated after requests took 653.85/677.58/653.18 ms with HTTP 200, 2,031 bytes, and no heap/pool errors. Collections, Reports, timestamp behavior, public contracts, and 1 CPU / 1 GiB/five-connection limits remain unchanged. Concurrent performance acceptance [UPCOMING]: not attempted in this slice. Previous API timings remain provisional because original source identity is unresolved; MySQL restart warmth and the unconfirmed Mem Reduct automatic-cleaning setting also limit comparisons. Evidence: `load-tests/optimization-results.md`.
- Admin Tracking Logs substring investigation [COMPLETED]: 57 exact ID-set and 21 ordered page comparisons passed for UNION and entity-membership candidates, including positive vehicle matches, wildcard/backslash/null/overlap/date fixtures, and 500-row paging. Universal UNION is rejected for broad-search disk materialization and page regressions. The smaller parameterized entity-membership diff was explicitly approved; investigation evidence and the exact diff remain in `load-tests/optimization-results.md`. Mem Reduct's automatic-cleaning setting is unconfirmed. Existing completed improvements and all business counts/limits remain unchanged.
- Admin search IN-based implementation and isolated verification [COMPLETED]: approved production patch applied exactly to the admin search path; five focused TrackingLogIntegrationTest regressions added without changing existing assertions. All 59 requested Tracking Logs/personal-history/authorization tests passed after one fixture getter correction. Only the backend was rebuilt/recreated; startup skipped seeding and MySQL identity/start time remained unchanged. All 21 recorded API samples returned HTTP 200 with identical IDs, exact totals, pagination metadata, and response sizes. Broad search measured 290-297 ms, no-match 408-416 ms, combined filters 267-300 ms, and 500-row CSV 287-297 ms. Selective latency target [IN PROGRESS], still unmet at 1.94-2.01 seconds versus 1.5 seconds. Final performance acceptance [UPCOMING]; no further optimization or k6 run follows this slice. Full evidence and manual checks: `load-tests/optimization-results.md`.
- Reports parcel aggregation investigation [COMPLETED]: the read-only date/loss/status aggregate matched every day and every status in the 17-day default month and 11-day seeded range, plus empty, cycle-boundary, null decimal, lost-COMPLETED, and existing rounded-end fixtures. Exact projected SQL took 530-547 ms versus 914-953 ms for the four existing statements in alternating warm samples. The user approved the concrete diff in `load-tests/optimization-results.md`; implementation and isolated verification are recorded below. Mem Reduct saved flags remain `AutoreductEnable=true` and `AutoreductIntervalEnable=false`; its process was absent.
- Reports parcel implementation and isolated verification [COMPLETED]: only the Reports parcel query/projection/result mapping changed, with a focused multi-day regression added to ReportIntegrationTest. All 29 Report/Dashboard tests passed without assertion changes. Only the backend was rebuilt/recreated; startup skipped seeding and all business counts/MySQL identity were preserved. Every response field except `generatedAt` matched the identified before snapshots; after default-month samples were 1.70-1.78 s and seeded-range samples 1.69-1.77 s, all HTTP 200 with identical byte sizes. No isolated Reports request exceeded the five-second target. Formal p95/failure/concurrency acceptance [UPCOMING] remains separate; no further optimization or k6 run followed. Full evidence and manual checks: `load-tests/optimization-results.md`.
- Concurrent performance acceptance runs [IN PROGRESS]: executed three 10-minute measured k6 runs (60s warm-up discarded + 600s measured) using `concurrent-acceptance.js` with distinct device bindings, LT-FIELD hot history, 1 CPU / 1 GiB limits, and five Hikari connections. 50k Peak passed all 12 measured gates. 50k Normal failed the receiving shipment-list p95 gate (566.7 ms vs 500 ms limit). 100k Growth had insufficient admin samples (21-22 vs 30 required) and missed multiple latency targets. Populated-day tracking metrics was evaluated via an isolated SQL probe, not concurrent API traffic. Live SSE outage/recovery check remains pending container-stop authorization. Work constitutes a verified improvement with open acceptance gates, not full performance acceptance. Full evidence: `load-tests/optimization-results.md`.

**7.8 — Frontend Progressive Loading Defect Fixes & Verification** — **[COMPLETED]**
- Six additional admin previews [IN PROGRESS]: implementation and automated verification [COMPLETED] for Shipments, Vehicles, Clients, Waybills, Payments, and persisted client/cycle Statement previews. These use verified-session gating, existing coordinator/SSE infrastructure, twelve total memory slots, five-minute expiry, 1 MiB per entry, and the unchanged 4 MiB shared ceiling. Successful shared API mutations and existing business events advance resource revisions; obsolete reads cannot restore fresh state. Payment summaries remain fresh-only; Statement drafts remain separate and require review after persisted changes. Verification: 23 added-page integration tests and all 274 frontend tests passed, production web export passed, and `git diff --check` passed. Production browser acceptance remains [UPCOMING] because the browser execution tool is unavailable. No primary database mutations, backend rebuild, or load test were performed.
- Two confirmed preview-extension regressions: implementation and automated verification [COMPLETED]. Dashboard and Weekly Collections cycle discovery now use `useCachedPreview` and the existing coordinator for `COLLECTION_CYCLES`; invalidation cancels obsolete reads and coalesces a burst into one replacement. Initial discovery remains immediate, logout cancellation remains synchronous, valid selection and server ordering are retained, successful empty discovery retains the recent-Thursday fallback, and failures expose Retry without becoming empty successes. Statements applies route client/cycle parameters as one selection with one discard decision; explicit clients survive metadata loading, unavailable requested clients are identified without default substitution, and existing draft review/save/print gates remain active.
- Regression verification [COMPLETED]: 13 new production-screen tests cover both cycle races, repeated invalidation bursts, logout during discovery, cached selection/order/timestamps, retry/empty results, route changes, unavailable clients, and accepted/cancelled dirty-draft navigation. Six expected failing reproductions confirmed the original mechanisms. One post-fix verification correction restored immediate discovery cancellation on logout and adjusted the unavailable-message test to inspect text children; no success/denial expectations were weakened. In `frontend-web`, `node --test tests/adminPreviews.test.mjs tests/progressiveLoadingFlows.test.mjs tests/searchableClientDropdown.test.mjs tests/responseCache.test.mjs tests/responseCacheSession.test.mjs tests/requestCoordinator.test.mjs` passed all 111 focused tests; `node --test tests/*.test.mjs` passed all 287 frontend tests; `npx.cmd --no-install expo export --platform web` passed. Repository-root `git diff --check` passed. Browser acceptance [UPCOMING]: the required browser execution tool is unavailable. Cache limits, API contracts, financial calculations, dependencies, timeouts, backend code, databases, and resources were unchanged; no Git writes, backend rebuild, or k6 run occurred.
- What to Test for these two regressions [UPCOMING]: (1) In isolated browser fixtures, open Dashboard and Weekly Collections without cached cycles and delay `GET /collections/cycles`. Emit an existing invalidating business event, including a repeated burst, then release the obsolete response. Expect obsolete work to abort, exactly one replacement cycle read, a valid selected cycle, and its corresponding summary response. Retry a failed discovery; a successful empty result must retain the existing recent-Thursday fallback. Revalidate reordered cycles while a valid cycle is selected; retain that selection and label cached metadata while refreshing. Log out during discovery; expect no late cycles, summaries, or cache writes. (2) Use client-side navigation between Statement URLs for C1 and different cycles where C2 appears first but C1 is valid, then change both parameters. Expect the requested pair to remain selected while metadata loads. Request a missing client; expect an explicit unavailable message and disabled save/print, with no substitute client. (3) Edit deduction/note/collector, then navigate to another route pair. Expect one discard prompt: Cancel retains both prior selectors and every draft field; acceptance changes both selectors and initializes the new persisted fields. Confirm existing freshness and persisted-value review still gate saving and printing. Displayed cycle/client IDs and summary/statement values must match the accepted API responses. Expected database state: unchanged; these checks require only fixture events and reads, with no primary simulation mutations.
- Reports hard-reload browser acceptance [COMPLETED]: user verified opening Reports and pressing `Ctrl+Shift+R` now reloads report data successfully instead of remaining stuck in skeletons. This confirms the Reports hard-reload workflow only. Dashboard, Tracking Logs, and Weekly Collections reload checks, development effect replay, live-row highlighting, and report print/PDF layout checks remain [UPCOMING].
- Render session-renewal reload regression (2026-10-19) [IN PROGRESS]: implementation and automated verification [COMPLETED]; post-deployment browser acceptance [UPCOMING]. The new production-client regression first failed because a successful renewing `/auth/me` caused a second validation request (2 instead of 1). Validation now defers its own renewal until the existing acceptance guards return APPLY, shares pending work by generation and identity claims excluding renewal timestamps, and retains one private bounded retry. Root startup shares a pass per generation across mount/session/focus/online triggers and ignores obsolete completions; verification notifications join the active pass. First-boot reads use a 15-second timeout. Transient first-boot/validation failures expose an accessible Retry banner above the existing navigator and retain credentials/skeletons. Obsolete password-required 403 errors also cannot alter replacement sessions. No backend, dependencies, deployment, resources, database operations, or Git writes are included.
- Render regression verification [COMPLETED]: `frontend-web/tests/sessionValidationReload.test.mjs` executes production Axios callbacks, root synchronization, the verified-session hook, and Reports loading with mocked HTTP/router/platform boundaries. Coverage includes repeated advancing renewals; missing/same/older/malformed headers; shared operations; logout/account/password stale success/error/renewal; current 401/non-admin denial; bounded concurrent replacement retry; ordinary API renewal; first-boot/validation Retry recovery; and old root completion ownership. Existing cache/Print/SSE coverage remains passing. Initial focused session/loading/cache/coordinator/SSE run passed 124 tests; initial full frontend run passed 313 tests; two further ownership/retry checks passed in the final 28-test regression suite. Production export passed (`npx.cmd --no-install expo export --platform web`); Metro recovered from an incompatible local cache by crawling again. Final combined counts are recorded below after verification.
- Render final automated checks [COMPLETED]: from `frontend-web`, `node --test tests/sessionValidationReload.test.mjs tests/progressiveLoadingFlows.test.mjs tests/authSlidingSession.test.mjs tests/responseCacheSession.test.mjs tests/responseCache.test.mjs tests/requestCoordinator.test.mjs tests/sseClient.test.mjs` passed 126/126; `node --test tests/*.test.mjs` passed 315/315; `npx.cmd --no-install expo export --platform web` passed. Repository-root `git diff --check` passed. No existing test expectations were changed.
- Render regression What to Test [UPCOMING]: after an approved frontend deployment, sign in as an administrator, open `/reports`, then refresh under normal and throttled networking. Observe successful `/auth/me` verification followed automatically by the report-summary request; record observed timing without a one-second Render target. Trigger focus/online during pending verification and confirm one validation operation and no recursive first-boot pass. Block first-boot or validation requests, confirm existing skeletons and the Retry banner, restore connectivity, and select Retry; expect verification, a report-summary request, and removal of the banner. Confirm Retry is disabled while pending and Print remains gated until fresh report success. Repeat logout/account/password rotation during delayed verification; no obsolete responses may restore credentials or apply renewals/errors. Expected database state: unchanged; only existing reads are needed. Preserve the previously completed Reports hard-reload browser check above as historical evidence; it does not close this separate Render-specific acceptance. The previously referenced backend stack trace remains a separate unresolved signal until its exception heading is supplied.
- Report signature simplification [COMPLETED]: shared report document now has one signature line labelled `Prepared By`; removed the approval block and Operations/Billing qualifier from both preview and printed output. Manual check [UPCOMING]: open Reports, select Print, and confirm the last-page footer contains only `Prepared By`. Database state is unchanged.
- Report print branding header implementation [COMPLETED]: Reports preview and dedicated print route now load current business branding and share a centered tracking logo, uppercase configured business name, optional address/contact/billing-email line, hairline divider, and report title/period/generated metadata matching the waybill/SOA header format. Missing branding blocks printing with Retry; failed logo loading uses the waybill text fallback. Auto-print waits for branding, logo readiness, and fonts. Reduced report pagination budget from 23 to 20 content units to reserve the taller repeated letterhead without dropping rows. Verification: 240 full frontend tests passed (`node --test tests/*.test.mjs`), production export passed (`npx.cmd --no-install expo export --platform web`); commands run in `frontend-web`. Five added report regressions cover configured branding, repeated page headers, failure/retry, logo fallback, and auto-print readiness. Browser/PDF layout acceptance [UPCOMING] because browser execution is unavailable.
- Report header What to Test [UPCOMING]: open Reports, choose a date range, and select Print. Confirm the preview shows the configured business name, tracking logo, and only configured contact fields. Print/Save as PDF; confirm each A4 page repeats the same header, retains its date range/generated metadata, and shows every table row/signature without clipping. Compare a multi-page report with its API row IDs/counts. Block `/settings/branding`, then retry after restoring access; expect printing disabled during failure and enabled after branding/logo readiness. Block the logo asset; expect the LOGISTICS fallback and unchanged actual business name. Expected database state: unchanged; only existing report and branding reads are used.
- Frontend review corrections [IN PROGRESS]: implementation and automated regressions [COMPLETED] for verification-triggered loading on all four pages, session-scoped cycle discovery and page resets, same-instance coordinator effect replay, and live-row highlight metadata. Verification [COMPLETED]: 64 focused tests passed (`node --test tests/progressiveLoadingFlows.test.mjs tests/requestCoordinator.test.mjs tests/responseCache.test.mjs tests/responseCacheSession.test.mjs`), 235 full frontend tests passed (`node --test tests/*.test.mjs`), production web export passed (`npx.cmd --no-install expo export --platform web`), and `git diff --check` passed. Frontend commands run from `frontend-web`. Browser reload, development effect replay, and live-highlight acceptance remain [UPCOMING]; the browser execution tool is unavailable in this session, so the three findings are not yet closed. The Reports logout regression now expects a skeleton while unverified, as required by this correction; cleared data and disabled Print assertions are retained.
- What to Test [UPCOMING]: with an existing administrator login, hard reload Dashboard, Reports, Tracking Logs, and Weekly Collections with network throttling. Expect layout/skeletons while `/auth/me` verifies, zero protected page reads/cache previews before verification, then successful section requests and settled loading. Reports Print must remain disabled until fresh success. Repeat session notifications or sliding renewal; expect no duplicate initial loads. Sign out or switch accounts during a delayed read; expect aborted old work, cleared data, and no obsolete success/error displayed.
- What to Test [UPCOMING]: in a development React effect replay environment, load each page and observe setup, cleanup, and setup using the same coordinator instance. Expect the first pending request to abort, the next request to succeed, and an obsolete response to leave current data unchanged. Hide the tab during a live event and return; expect one catch-up refresh.
- What to Test [UPCOMING]: on Tracking Logs page 0 with empty search, observe an incoming scan from normal live traffic. Expect only newly added event IDs to highlight, existing rows to remain unhighlighted, and highlights to expire after 3.5 seconds. Navigate away or sign out during highlighting; expect timer cleanup. These checks require no database writes from the verification session; stored records and all four business lifecycles must remain unchanged. Returned counts, financial values, and event IDs must match the accepted current-session API responses.
- Addressed three progressive loading defects across Dashboard, Weekly Collections, Reports, and Tracking Logs without altering backend contracts, dependencies, or financial rules.
- Defect 1 (Reports cache hit): Settle loading on all accepted responses including silent cache revalidations. Print action is gated strictly on fresh success and disabled during preview, loading, stale, and error states.
- Defect 2 (Session and query safety): Capture authenticated user ID, session generation, and normalized query parameters at request start. Evaluated via production `isResponseAcceptable` before committing to cache or UI state; reject obsolete success/error responses. Implemented `coordinator.cancel()`, cancelled pending reads on session invalidation, purged cache on password update session increment, and preserved valid entries across sliding token renewal.
- Defect 3 (Tracking Logs failures): Maintained independent list and metrics state. Revalidation failure retains matching data with stale warning, timestamp, and Retry. Successful empty responses (`[]`) explicitly tracked as existing data (`hasActiveLogsSuccessRef`) to prevent false error states on refresh. First-load failure displays dedicated error card instead of empty table.
- Automated verification [COMPLETED]: 41 focused tests passed across pure cache, session lifecycle, coordinator contracts, and progressive loading flows (`node --test tests/progressiveLoadingFlows.test.mjs`, `tests/responseCacheSession.test.mjs`, etc.); full frontend suite passed 194/194 unit tests. Production web export (`npx expo export --platform web`) compiled cleanly with 0 errors. Browser acceptance checks remain pending.
- Progressive loading render/session remediation [COMPLETED]: moved invalidation effects below coordinator initialization in all four screens; coordinator-owned resume snapshots preserve the real fetcher, auth/query metadata, and queued options. Verified-session gating and cycle-request abort signals are connected to production paths. Replaced simulated flow assertions with tests executing actual screens, the request hook, and client login/password/renewal/logout code with mocked platform/API boundaries. Verification: 209 frontend tests passed with zero failures; production web export and git diff --check passed. Browser visual/navigation verification remains [UPCOMING]. No backend, resource, database, or Git write operations occurred.
