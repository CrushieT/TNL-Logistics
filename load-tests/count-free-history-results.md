# Count-free personal history

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
