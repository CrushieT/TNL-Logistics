# Count-free personal history

## Unfiltered history ID access path, 2026-10-21

Status: implementation and scoped correctness/query-shape verification [COMPLETED]. The separately authorized 100k before/after loaded benchmark is now [COMPLETED]; formal performance acceptance remains open. The implementation-only verification below and the older count-free benchmark describe separate slices and must not be conflated with this index-hint comparison.

Subsequent controlled benchmark: four unchanged two-minute workloads in Baseline-Candidate-Candidate-Baseline order, with 36 complete history JSON parity comparisons and unchanged business counts/resources. Courier history medians were 5,798.63/6,105.20 ms for Baseline and 17.50/17.49 ms for Candidate; dispatch medians were 3,643.44/3,241.97 ms versus 17.55/17.13 ms. Actual request rates rose from 5.33-5.76/s to 30.09-30.79/s, while MySQL cgroup CPU fell from 119.55-121.37 s to 88.79-90.18 s. Admin and receiving failed both Candidate runs; courier history p95 was 471.08 then 541.27 ms, with its role gate passing once and failing once. Dispatch passed both, and every run had zero HTTP failures. This demonstrates improvement, not resolution of all CPU/latency acceptance problems. The full supported measurement tables and limitations are in `.github/PR_DRAFT.md`. Candidate remains deployed; no further optimization or workload followed.

The exact Page and count-free Slice share `PersonalTrackingEventRepositoryImpl.findEventIds`. On the 100k dataset the previous unfiltered plan used the global timestamp index, visiting about 194,500 entries before returning 21 staff-matching IDs. The approved branch adds `FORCE INDEX (idx_tracking_event_staff_timestamp_event)` only when normalized search and status are null. The existing V29 index begins with staff ID and then timestamp/event ID, so it can read the requested staff's entries in the required descending order directly.

The prior persistent-JDBC candidate measurements used equivalent staff IDs, LIMIT 21, offsets 0/20 and descending timestamp/event-ID order. Three alternating pairs per case compared every ordered returned ID with matching checksums. Populated medians were 238.006-242.803 ms before and 2.017-2.296 ms with the hint; empty cases also matched. These are isolated elapsed-query observations, not CPU measurements or loaded API gains. No further candidate investigation, plan profiling, Docker operation or deployment occurred during implementation.

This changes SQL branching and forces a named MySQL index. It depends on the existing V29 index being present and retaining its name; unsupported SQL dialects would reject the syntax, and future data distributions could favor a different plan. Both exact and count-free unfiltered ID selection use the branch. Exact count SQL, status/search SQL, wildcard/backslash semantics, bound staff/filter parameters, authorization/device-session validation, page limits, size+1 lookahead, bounded hydration and DTO fields are preserved. Admin Tracking Logs and metrics source are unchanged.

### Verification report

- Scope: `/test check recent changes`, diff-derived personal-history GET/repository verification. Related authorization, mobile-session, scan, populated-day metrics and admin Tracking Logs regressions run through the existing Spring Boot/MockMvc suites. No HTTP calls to either simulation stack.
- Runtime/database: existing Temurin 21.0.12.1, Maven offline, existing test profile resolving to local `tnl_test` on port 3306. New fixture writes are confined to transactional tests and roll back; existing suite setup/security concurrency fixtures use only that dedicated test schema. Neither preserved 50k/100k database or volume is accessed. No dependencies or configuration changes.
- Exact command, from `backend`:

```powershell
mvn.cmd --offline --batch-mode '-Dtest=PersonalTrackingHistoryIntegrationTest,FourRoleAuthorizationIntegrationTest,AdminConsoleAuthorizationIntegrationTest,TrackingScanIntegrationTest,TrackingAndVehicleIntegrationTest,TrackingLogIntegrationTest,MobileBindingSwitchIntegrationTest,MobileAuthIntegrationTest,TrackingTransitionPolicyTest' test
```

| Suite | Run | Failures | Errors | Skipped |
| --- | ---: | ---: | ---: | ---: |
| PersonalTrackingHistoryIntegrationTest | 43 | 0 | 0 | 0 |
| FourRoleAuthorizationIntegrationTest | 11 | 0 | 0 | 0 |
| AdminConsoleAuthorizationIntegrationTest | 2 | 0 | 0 | 0 |
| TrackingScanIntegrationTest | 33 | 0 | 0 | 0 |
| TrackingAndVehicleIntegrationTest | 5 | 0 | 0 | 0 |
| TrackingLogIntegrationTest | 26 | 0 | 0 | 0 |
| MobileBindingSwitchIntegrationTest | 11 | 0 | 0 | 0 |
| MobileAuthIntegrationTest | 53 | 0 | 0 | 0 |
| TrackingTransitionPolicyTest | 2 | 0 | 0 | 0 |
| Total | 186 | 0 | 0 | 0 |

- Automated result: BUILD SUCCESS; native Maven exit 0, 1 minute 26 seconds, completed 2026-10-21 09:37:43 Asia/Shanghai. Sixteen added parameterized cases cover both courier/dispatch roles with 0/1/20/21/40/41/51 own events, another staff member's events, tied timestamps, adjacent/final/beyond-last pages, omitted/true/false totals, 1/50-item clamping and lookahead. Filtered cases cover status-only, search-only, combined search/status, case/trim normalization, `%`, `_`, backslash, empty matches and blank search normalization.
- Query behavior: actual MySQL request SQL contains the hint only for unfiltered ID selection, with bound staff predicate and deterministic ordering. Exact count SQL remains unhinted; count-free reads issue no history COUNT. Clearing the persistence context before requests prevents the first-level cache from hiding hydration: there is exactly one event hydration SELECT for nonempty pages, with staff restriction and an ID-IN list exactly matching content size; empty pages issue none. Lookahead IDs are excluded from hydration. These are query-shape/execution guards, not a new 100k plan/timing benchmark.
- Contract/schema: omitted and explicit true responses match, with exact totals including beyond-last pages. Count-free content matches exact content and exposes only `content` plus `page: {number,size,hasNext}`. All ten event DTO keys are checked; existing PII/forbidden-field and lazy-mapping regressions pass. No leaked fields found.
- Role/session/negative checks: courier and dispatch history permitted and ownership isolated; receiving/admin history denied with 403; missing/invalid/obsolete sessions return 401; malformed includeTotals/status/page/size return 400. Existing device-binding and token-version rejection tests pass. History GET introduces no 409 transition; existing scan conflicting-vehicle and binding-switch confirmation 409 cases pass.
- Metrics/concurrency: populated-day personal metrics, another staff member/yesterday exclusion, operational metrics and idempotent-scan regressions pass. History is read-only and adds no state/counter concurrency invariant. Existing mobile-security races and binding ownership/version invariants pass; no new load or concurrency benchmark is claimed.
- Warnings: Mockito self-attachment, dynamically loaded Java agent and CDS/class-sharing warnings remain. Surefire emitted a Windows boot-manifest classpath diagnostic (`'other' has different root`). Initial test compilation also reported existing MockBean/SpyBean deprecations. No forced fork termination or shutdown timeout was reported in the confirmed scoped run; deferred SSE shutdown behavior was not retested or repaired.
- Deviation/remediation log: the first invocation produced the same passing suite XML, but PowerShell `ErrorActionPreference=Stop` treated Mockito stderr as a NativeCommandError before native Maven exit capture. The identical scoped command was repeated with stderr handled as diagnostic output and native exit captured explicitly. No assertion failure, product fix, weakened expectation, or test/audit remediation cycle occurred.
- Summary verdict: PASS for the scoped functional, security and SQL-shape checks. `git diff --check` passes. Loaded API latency, MySQL CPU improvement, production capacity and independent clean SSE shutdown remain unmeasured.

### Audit Scope Header

- Audit Mode: Git Diff Scoped.
- Audited targets: changed `findEventIds` branch in `backend/src/main/java/com/tnl/logistics/repository/PersonalTrackingEventRepositoryImpl.java`, added tests/helpers in `backend/src/test/java/com/tnl/logistics/controller/PersonalTrackingHistoryIntegrationTest.java`, `.agents/rules/build-plan.md`, this results update and `.github/PR_DRAFT.md`. Immediate controller/service/security/migration context inspected read-only; no full sweep.

The scoped implementation preserves access restrictions and result contracts, keeps dynamic values parameterized, and leaves filtering, counts and hydration intact. The existing index hint is the approved MySQL-specific trade-off. No actionable findings were identified in the changed scope.

| Severity | Count | Category |
| --- | ---: | --- |
| Critical | 0 | Injection, authentication bypass, sensitive data |
| High | 0 | Authorization, transaction leaks, severe query regressions |
| Medium | 0 | Validation, error handling, query bounds |
| Low / Info | 0 | Naming, test coverage, maintainability |

Detailed findings: none. High/Critical remediation: none; zero test-fix and audit-fix cycles.

Reviewed, not flagged: the index name is a constant, not interpolated input; V29 already creates it. Sharing the unfiltered ID path between Page/Slice changes neither exact-count execution nor DTOs. The hint is intentionally excluded from status/search predicates. Hydration remains staff-bound and page-ID-bound in read-only service transactions. Test-only timestamp updates are parameterized and transactional. Portability/future plan selection are documented constraints rather than an unsupported new-index remedy. No global security/CORS/SSE code was changed.

Positive observations: minimal production diff, real MySQL SQL inspection, both-role ownership fixtures, tied-order/empty/boundary cases, exact schema assertions, no-count guards and bounded hydration assertions. No existing assertions were changed.

### What to Test and later benchmark scope

1. Automated command and results are recorded above. To reproduce, select the existing Java 21 runtime for the Maven process and use the unchanged dedicated test profile. Do not point these fixture tests at a preserved simulation database.
2. Manual reads, in a later approved isolated test deployment: use existing synthetic courier and dispatch sessions. Request `/api/v1/tracking-events/mine?page=0&size=20` with includeTotals omitted, true and false; then page 1, final and beyond-last pages. Compare ordered event IDs, field values and exact totals; false must have only the three nested pagination fields, and hasNext must reflect the one-ID lookahead. Use tied timestamps and events owned by another staff member. Test size 0/999 and negative page for 1/50/0 clamping. Repeat with status-only, tracking/shipment substring, combined, wildcard/backslash and no-match filters. Confirm receiving/admin denial, missing/stale session denial and malformed-parameter rejection. Existing populated-day metrics must retain expected own-staff totals and yesterday exclusion.
3. Copyable read command after supplying an approved isolated base URL/session through environment variables; no credentials are embedded:

```powershell
curl.exe "$env:HISTORY_TEST_BASE_URL/api/v1/tracking-events/mine?page=0&size=20&includeTotals=false" -H "Authorization: Bearer $env:TEST_COURIER_TOKEN" -H "X-Device-Id: $env:TEST_DEVICE_ID" -H "X-Device-Token: $env:TEST_DEVICE_TOKEN"
```

4. Expected database state: history GET changes no shipment, parcel, tracking-event, payment, label, waybill or staff ownership data. Compare returned IDs to a parameterized `SELECT event_id FROM tracking_event WHERE staff_id = :authenticated_staff_id ORDER BY event_timestamp DESC, event_id DESC LIMIT :size OFFSET :offset`; count-free hydration receives only the returned page IDs, not the lookahead. Fixture writes belong only in rollback-isolated tests. No status lifecycle is coupled to pagination.
5. Later controlled before/after benchmark proposal, NOT RUN: obtain explicit deployment/run authorization and a quiet exclusive window; identify before/after artifacts, preserve rollback images, both datasets/volumes and 1 CPU/1 GiB/5-Hikari/256-MiB limits; verify counts and full history/metrics parity. Pre-agree a bounded comparison budget, identical outside-window read warm-up, unchanged realistic-simulation roles/stages/pauses with includeTotals=false, endpoint/role tags and shared-account caveat. Capture sufficient endpoint samples (no p95 acceptance below 30), errors/completed throughput, CPU/throttling, logical/physical reads and available pool waits. Keep source/query elapsed, loaded HTTP and CPU measurements distinct; no unavailable Performance Schema attribution. Hold SSE and unrelated aggregate/index/resource changes outside that benchmark.

No Docker command, image build, container recreation, simulation DB access, dependency installation, Git write or SSE experiment was performed in this implementation slice. No tracked file/package was added or moved, so project-structure documentation requires no update; private investigation artifacts remain excluded from it.

Status: implementation verified and benchmarked independently as of 2026-10-19.

`GET /api/v1/tracking-events/mine` preserves its existing exact Page response when `includeTotals` is omitted or true. With `includeTotals=false`, it returns `content` and `page: { number, size, hasNext }`; totals are absent. Both paths share normalized bound filters, authenticated staff isolation, descending timestamp/event-ID ordering, and event hydration. The Slice path selects at most `size + 1` IDs and hydrates at most `size` events without executing a history count.

Mobile requests the Slice response, validates metadata before accepting a response, and accepts legacy Page metadata during deployment. Failed appends retain their page for retry. Offset pagination can shift under new scans; event-ID deduplication and page-zero refresh remain necessary. No snapshot-consistency guarantee is added.

The realistic simulation defaults to count-free history. Set `HISTORY_INCLUDE_TOTALS=true` for the exact-count comparison or `false` for count-free. Invalid values fail at initialization. Endpoints, VUs, stages, batches, sleeps, and thresholds remain intact.

## Test report

- Scope: diff-derived verification of personal-history GET, repository/service paths, mobile production request construction, and pagination handlers; Tracking Logs and role-authorization regression suites included.
- Focused backend command, from `backend`: `mvn test "-Dtest=PersonalTrackingHistoryIntegrationTest,TrackingLogIntegrationTest,FourRoleAuthorizationIntegrationTest,AdminConsoleAuthorizationIntegrationTest"`. Result: 66 tests, zero failures/errors/skips; personal-history suite contributes 27 tests.
- Standalone history verification: `mvn test "-Dtest=PersonalTrackingHistoryIntegrationTest"`. Result: 27 passed, zero failures/errors/skips, process exited cleanly with code 0 in 31.6s.
- Full backend command, from `backend`: `mvn test`. Result: BUILD SUCCESS, 523 tests, zero failures/errors, five existing skipped Waybill tests, native Maven exit 0. Surefire reports a 30-second fork shutdown timeout. This timeout independently reproduces on unedited baseline code (`SseOpenInViewRetainedConnectionTest`), where Tomcat graceful shutdown waits for active async requests, and is under separate investigation.
- Mobile command, from `frontend-mobile`: `node --test tests/*.test.mjs`. Result: 268 passed, zero failures/skips.
- Production export command, from `frontend-mobile`: `node node_modules/expo/bin/cli export --platform android --platform ios --output-dir ../.review/count-free-mobile-export`. Result: Android and iOS bundles exported successfully.
- Contract/schema checks passed: omitted/true responses match; count-free content matches exact content and tied-timestamp ordering; only number/size/hasNext pagination fields appear; SQL capture proves no history count for 0, 1, 20, 21, 40, and 41 matches, including final/beyond-last pages. Existing event DTO fields are preserved without adding sensitive fields.
- Filters/access checks passed: tracking/shipment substring searches combined with status, empty results, Courier/Dispatch isolation, spoofed staff/user parameters, page/size clamping, unauthenticated 401, Receiving/Admin 403, malformed boolean/status/page/size 400.
- Mobile production-handler checks passed: first/append/final pages, duplicate-load suppression, append failure/retry, overlapping boundaries, refresh during append, rapid search changes, cancellation, legacy nested/root metadata, and malformed-metadata failure handling.
- `git diff --check` passed cleanly with 0 whitespace warnings.
- Verdict: functional assertions pass; clean full-suite process completion is limited by the pre-existing SSE baseline shutdown defect.

## Diff-scoped audit report

- Security & Access Control: `@PreAuthorize("hasAnyRole('COURIER_STAFF', 'DISPATCH_STAFF')")` role gating is intact. Authenticated staff user ID isolation is enforced on both exact and count-free paths; spoofed query parameters cannot access another staff member's events. Native queries use bound parameters preventing SQL injection.
- Robustness & Error Shielding: Negative page numbers clamp to 0; size clamps between 1 and 50. Malformed parameters produce HTTP 400. Frontend gracefully normalizes legacy Page responses and handles network retry without index drift.
- Performance & Persistence: The slice query avoids scanning 239k courier rows and 114k dispatch rows for exact counts. 1 ID lookahead (`limit = size + 1`) derives `hasNext` in memory. Entity hydration is bounded strictly to the paged IDs using join fetch. Read-only transaction scoping is preserved.
- Findings: 0 Critical, 0 High, 0 Medium, 0 Low.

## Monitored benchmark comparison

Two sequential 2-minute realistic-simulation runs were executed against the same updated simulation backend image (`sha256:4cee3a9776ac72b8a15555d60b4f82004f06c45e46a4926a5396fbaf9991222f`) under identical resource constraints (1 CPU / 1 GiB per container, 5 Hikari connections, 256 MiB MySQL buffer pool). These runs constitute a single sequential diagnostic comparison under the shared-account stress workload, not repeated runs or formal multi-tenant capacity certification:

### Overall workload performance

| Metric | Exact (`HISTORY_INCLUDE_TOTALS=true`) | Count-Free (`HISTORY_INCLUDE_TOTALS=false`) | Delta |
| :--- | :---: | :---: | :---: |
| Total HTTP Requests | 2,332 | 3,840 | +64.7% |
| Workload Request Rate | 19.02 req/s | 31.59 req/s | +12.57 req/s |
| Workflow Iterations | 797 (6.50/s) | 1,309 (10.77/s) | +64.2% |
| HTTP Failure Rate (<1%) | 0.00% (passed) | 0.00% (passed) | 0.00% |
| Backend Error Logs | 0 | 0 | 0 |
| MySQL Average CPU | 86.91% | 63.52% | -23.39 pp (-26.9% rel) |
| MySQL Peak CPU | 100.30% | 106.35% | +6.05% |
| MySQL Throttled Time | 350.93 s | 100.49 s | -250.44 s (-71.4%) |
| MySQL Throttled Periods | 1,021 / 1,216 (83.96%) | 537 / 1,180 (45.51%) | -38.45 pp |
| MySQL Peak Memory | 377.16 MiB | 378.22 MiB | +1.06 MiB |
| Backend Average CPU | 28.76% | 37.83% | +9.07 pp |
| Backend Peak Memory | 655.39 MiB | 640.30 MiB | -15.09 MiB |
| Container Restarts / OOM | 0 / 0 | 0 / 0 | Preserved |

### Role latency & threshold results

| Role | Gate | Exact p95 | Count-Free p95 | Delta | Gate Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Mobile Couriers | < 500 ms | 1,598.35 ms | **358.02 ms** | -1,240.33 ms (-77.6%) | **PASSED** |
| Mobile Dispatch | < 500 ms | 1,400.00 ms | **252.99 ms** | -1,147.01 ms (-81.9%) | **PASSED** |
| Mobile Receiving | < 500 ms | 1,722.16 ms | 680.20 ms | -1,041.96 ms (-60.5%) | Failed (Remaining miss) |
| Admin Web | < 1,500 ms | 4,975.97 ms | 2,165.15 ms | -2,810.82 ms (-56.5%) | Failed (Remaining miss) |

### Key endpoint latency

| Endpoint / Scenario | Exact Requests / Avg / p95 ms | Count-Free Requests / Avg / p95 ms | Avg Latency Delta |
| :--- | :---: | :---: | :---: |
| Courier History (`/mine`) | 634 / 841.09 / 1,788.77 | 1,072 / 79.86 / 365.08 | **-90.5%** |
| Courier Metrics (`/mine/metrics`) | 634 / 541.16 / 1,437.81 | 1,072 / 70.86 / 350.60 | -86.9% |
| Courier Scan Context (`/scan-context/:id`) | 634 / 549.98 / 1,419.83 | 1,072 / 72.21 / 358.02 | -86.9% |
| Dispatch History (`/mine`) | 78 / 539.59 / 1,573.20 | 113 / 64.85 / 255.14 | **-88.0%** |
| Dispatch Metrics (`/mine/metrics`) | 78 / 366.15 / 1,281.44 | 113 / 53.36 / 249.18 | -85.4% |
| Dispatch Scan Context (`/scan-context/:id`) | 78 / 383.70 / 1,398.54 | 113 / 61.19 / 263.65 | -84.1% |
| Receiving Shipments (`/shipments`) | 64 / 875.30 / 1,873.24 | 92 / 306.48 / 750.34 | -65.0% |
| Receiving Vehicles (`/vehicles`) | 64 / 396.65 / 1,170.31 | 92 / 82.45 / 364.93 | -79.2% |
| Admin Dashboard (`/dashboard/summary`) | 21 / 3,800.42 / 5,577.15 | 32 / 1,750.22 / 2,425.61 | -53.9% |
| Admin Shipments (`/shipments`) | 21 / 925.11 / 1,322.29 | 32 / 629.77 / 862.52 | -32.0% |
| Admin Clients (`/clients`) | 21 / 953.84 / 1,315.44 | 32 / 676.17 / 903.09 | -29.1% |

### Analysis of remaining latency misses and diagnostic nature

- **Single Diagnostic Comparison:** This benchmark represents one sequential exact-versus-count-free diagnostic comparison under the shared-account stress workload. Avoiding repeated matching-staff index counts improved courier and dispatch latency enough to pass their role gates in this run. It does not establish repeated-run or distinct-user capacity acceptance.
- **Role Aggregate vs Specific Endpoint Latency:**
  - **Admin Web:** While the aggregate Admin role p95 dropped from 4,975.97 ms to 2,165.15 ms (-56.5%), it remains above the 1,500 ms threshold. The specific Admin Dashboard summary endpoint (`/api/v1/dashboard/summary`) p95 is 2,425.61 ms (down from 5,577.15 ms).
  - **Mobile Receiving:** While the aggregate Receiving role p95 dropped from 1,722.16 ms to 680.20 ms (-60.5%), it remains above the 500 ms threshold. The specific Receiving shipments endpoint (`/api/v1/shipments`) p95 is 750.34 ms (down from 1,873.24 ms).
- **Latency Attribution:** Earlier measurements identify broad aggregation and counting work across 50,000 shipments as candidates for the remaining Dashboard and shipment-list costs. Existing plans use date, covering, and foreign key indexes; these results do not justify another index. Query and read consolidation is a candidate for further measurement, not a confirmed next fix.

### Integrity & preservation verification

- Pre- and post-workload business counts remained strictly identical across all 6 snapshot points:
  - Shipments: 50,000
  - Parcel Units: 145,827
  - Tracking Events: 645,790
  - Payments: 36,807
  - SOAs: 1,437
  - Clients: 500
  - Waybills: 27,081
- MySQL container ID (`d1f1a36e11b6bd7e10a1c9e185655bf35e8a32524b996f22a0f339a038557be6`) and volume `tnl-sim-50k_mysql_sim_data` were preserved without recreation or second volume creation.
- Backend configuration settings (SerialGC, 512m heap, 5 Hikari connections, 20 Tomcat threads, loadtest seed disabled) were preserved.
- Database and container health: zero restarts, zero OOM events, healthy state throughout.

## Outstanding manual checks

1. Physical Android and iOS device validation: verify native FlatList momentum scrolling across multi-page courier history.
2. Pull-to-refresh behavior on physical device while new events are being scanned elsewhere.
3. Offline network toggle and append retry under flaky Wi-Fi/cellular connection.
