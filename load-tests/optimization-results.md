# 50,000-shipment optimization evidence

Measured on 2026-10-16 in the existing `tnl-sim-50k` environment. The database volume was preserved. Both application and database retained 0.5 CPU / 512 MB limits, with five Hikari connections and a 64 MB MySQL buffer pool. No cache, dependency, configuration, frontend, or shared-account workload changes were introduced by this task. Pre-existing seeder and workload edits were preserved.

## Correctness

- The affected Maven run passed 98 tests with zero failures, errors, or skips: `PersonalTrackingHistoryIntegrationTest`, `TrackingLogIntegrationTest`, `DashboardIntegrationTest`, `CollectionsIntegrationTest`, `CollectionsAggregationIntegrationTest`, `ShipmentIntegrationTest`, `ClientIntegrationTest`, `FourRoleAuthorizationIntegrationTest`, `AdminConsoleAuthorizationIntegrationTest`, and `TrackingConcurrencyIntegrationTest`.
- The final search revision separately passed all 20 personal-history tests. Existing assertions were retained.
- Three complete seeded-cycle responses from collections and dashboard compare with zero differences after sorting collection items by client ID. This includes all financial fields, eligibility, item statuses, and active-client counts.
- JavaScript syntax, PowerShell parsing, and `git diff --check` passed.
- Every backend restart skipped the completed seed. Shipment count remained 50,000 and tracking-event count remained 645,790. Synthetic insert probes rolled back all rows and left only auto-increment gaps.

## Independently measured slices

Each diagnostic run used one sequential VU, one discarded warm-up pass, and three measured passes through the same ten endpoints. Samples are small and are diagnostic evidence, not concurrency acceptance. Raw sanitized outputs are local ignored artifacts under `load-tests/results/`.

| Endpoint p95 (ms) | Original | Courier slice | Collections slice | Final |
| --- | ---: | ---: | ---: | ---: | ---: |
| Personal history | 18,273 | 267 | 125 | 171 |
| Personal metrics | 10,671 | 410 | 365 | 361 |
| Empty-status history | 5,958 | 65 | 28 | 57 |
| Status history | 18,014 | 480 | 205 | 152 |
| Substring history | 23,604 | 53,114 | 24,951 | 474 |
| Dashboard | 26,879 | 4,667 | 2,176 | 2,245 |
| Shipments | 541 | 304 | 287 | 318 |
| Clients | 528 | 405 | 437 | 445 |
| Scan context | 176 | 76 | 53 | 25 |
| Setup tracking logs | 5,574 | 4,278 | 3,418 | 3,874 |

The courier checkpoint used the original collections service; the collections checkpoint then used database financial projections. The final image adds the measured substring-search revision.

## Query and index evidence

Warm SQL measurements were collected after a discarded pass. Unjoined history count took 188 ms versus 3,082 ms for the joined count on the original schema. The indexed schema's unjoined count took 134 ms. Empty-status lookup fell from 2,730 ms examining 145,827 events to 0.013 ms using the new staff/status covering index. Daily metrics fell from 4,312 ms with row lookups to 388 ms using covering access. MySQL chose the staff/status/timestamp index for an entire day's events because grouping by status is efficient in that order; the staff/timestamp/status index supports selective time ranges.

The new indexes each occupied 21,561,344 bytes, approximately 41.1 MiB combined. Existing timeline indexes remain. Synthetic 100-row insert samples were 114/68/86 ms before and 168/198/283 ms after migration. The initial after samples overlapped application startup and must not be treated as a controlled write-cost comparison; idle final repeats were 105/7/11 ms. The variance and different page warmth prevent a defensible index write-overhead percentage; no concurrent scan-write capacity claim is made. These probes measure database insert work without commit durability or scanner service overhead.

The per-client collection projection returned 480 rows for 16,680 eligible shipments in approximately 835 ms. Payments were reduced to 11,120 shipment totals before joining charges, preventing multiple-payment multiplication. Historical statement membership remains exact, and SQL blank checks preserve Java `String.trim()` semantics. Dashboard financial queries with different eligibility were left unchanged.

## Attempt ledger

- Kept: ID pagination and join-free exact counts for ordinary and status-filtered courier history; covering indexes for live metrics and status history.
- Replaced: directly joining parcels in the ordered substring query. MySQL walked 645,790 events and performed 239,565 parcel lookups to return two rows; measured page query was 25,013 ms, and endpoint p95 regressed to 53,114 ms.
- Kept replacement: materialize matching parcel IDs with `DISTINCT`, then join events using the existing staff/tracking index. The measured page query took 396 ms and its count took 138 ms. No additional index was needed. `DISTINCT` prevents MySQL from merging the derived query back into the costly ordered event scan.
- Corrected: initial financial fixtures used a date beyond MySQL TIMESTAMP range and a statement ID violating the SOA foreign key. Fixtures now use valid persisted data. A regular-expression character-set mismatch was fixed with explicit UTF-8 characters. End-of-day JDBC rounding was observed in both legacy and projected reads; the out-of-cycle fixture was placed at midday without changing existing boundary behavior or assertions.
- Sanitized: the built-in k6 export includes setup data; the runner now allow-lists metrics and groups after execution, and all three saved simulation exports have had setup data removed. The workload is unchanged.
- Excluded: requests made before backend startup completed. Startup and seed-skipped messages are required before measurements.

## Acceptance

Three planned runs completed with identical three-sample sequential diagnostic warm-ups, followed by the unchanged two-minute shared-account workload. No further optimization or test reruns followed the final verification request. Each run passed the failure-rate target and failed both latency targets. No interrupted iterations or connection acquisition timeouts were recorded.

| Run | Requests | Failed | Admin p95 | Courier p95 | Completed / interrupted iterations | Pool timeouts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 357 | 0.00% | 25.87 s | 18.72 s | 118 / 0 | 0 |
| 2 | 357 | 0.00% | 22.54 s | 18.50 s | 118 / 0 | 0 |
| 3 | 357 | 0.00% | 24.41 s | 18.02 s | 118 / 0 | 0 |

| Run | Sampled backend CPU peak | Sampled MySQL CPU peak | Backend memory peak | MySQL memory peak |
| --- | ---: | ---: | ---: | ---: |
| 1 | 11.09% | 50.85% | 403.1 MiB | 402.7 MiB |
| 2 | 7.44% | 51.09% | 403.9 MiB | 417.8 MiB |
| 3 | 10.41% | 51.99% | 404.3 MiB | 417.8 MiB |

Docker CPU percentages are fractions of one CPU core; approximately 50% represents the full configured 0.5-CPU MySQL allocation. Resource sampling continued for 165 seconds per run and included a short idle tail. Peaks are sampled observations, not continuous maxima. Raw sanitized summaries, console logs, identical warm-up summaries, and resource samples are in `load-tests/results/simulation-1*`, `simulation-2*`, and `simulation-3*`.

Final read-only database inspection confirmed 50,000 shipments, 145,827 parcels, 645,790 events, 1,437 statements, and 36,807 payments. Both containers retained 0.5 CPU / 512 MB limits and reported no OOM kill. MySQL retained its 64 MiB buffer pool and normal durability (`innodb_flush_log_at_trx_commit=1`, `sync_binlog=1`). The backend retained five Hikari connections.

## Remaining limitations

- Performance acceptance failed. Admin p95 remained far above 1.5 seconds and courier p95 far above 500 ms despite zero failed requests. Thresholds and workload were not weakened.
- MySQL repeatedly saturated its 0.5-CPU allocation while backend CPU and memory stayed within their limits. Exact live courier totals and daily grouping still examine large event ranges (239,565 courier events), and concurrent requests queue behind database work. No pool or resource increase was attempted.
- Dashboard p95 remained 2.25 seconds in final isolated diagnostics. The financial projection took approximately 835 ms for a seeded historical cycle, and the dashboard retains additional live aggregates with different eligibility. These calculations were preserved as required.
- Setup tracking logs remained approximately 3.87 seconds in final isolated diagnostics. Their joined count remains a separate bottleneck. Shipment listing, client listing, and scan context retained their existing batched reads; no speculative indexes or fetch changes were added.
- Index storage cost is measured, but index write overhead is inconclusive because synthetic insert timings varied with page warmth and startup activity. The probes do not establish concurrent scanning capacity.
- Isolated endpoint p95 values use only three samples each and do not replace the three concurrency runs. No native UI/device testing was performed for this backend-only implementation.

Implementation and correctness verification are complete. The original constrained environment does not meet the required latency targets; capacity acceptance remains unmet.

See [README.md](README.md#what-to-test) for automated commands, manual API checks, and expected database/response state. No real device UI checks are required for this backend-only change.

## Collections payment lookup follow-up, 2026-10-17

This follow-up uses the updated backend and MySQL allocations of 1 CPU / 1 GiB each, five Hikari connections, and the preserved 50,000-shipment dataset. The two-minute script now peaks at one admin, eighteen shared-account courier VUs, one receiving staff member, and one dispatch staff member. These measurements are separate from the historical 0.5-CPU runs above and the pending ten-minute acceptance plan.

The exact courier-history count uses the existing covering staff index and examines 239,565 entries: warm `EXPLAIN ANALYZE` timings were 69.8 and 66.7 ms. Selecting the newest twenty IDs took 0.047 ms. No courier count, contract, or index was changed.

Collections now sums payments through an indexed scalar subquery for each eligible shipment inside the existing client aggregate, avoiding the derived payment table and its shipment/date lookups. This remains one database statement, with database-side work proportional to eligible shipments; it is not constant-time execution. Statement membership, date bounds, unbilled counts, ordering, service deductions, SOA-only handling, and client balance clamping remain unchanged.

Every projected field matched across 480 clients in each seeded cycle. Alternating warm execution-plan timings:

| Cycle end | Previous query, ms | Updated query, ms |
| --- | --- | --- |
| 2026-10-08 | 337 / 333 | 281 / 266 |
| 2026-10-15 | 355 / 359 | 273 / 278 |
| 2026-10-22 | 343 / 335 | 289 / 273 |

A nonpersistent SQL CTE fixture also matched for multiple and late payments, overpayments, unpaid shipments, historical statement exclusion, date exclusions, and an empty cycle. An alternative that merely removed date filtering from the payment-derived table did not reliably improve timing and was not applied.

Automated verification from `backend/`: `mvn -o test "-Dtest=CollectionsIntegrationTest,CollectionsAggregationIntegrationTest,DashboardIntegrationTest,ReportIntegrationTest"` reported BUILD SUCCESS: 33 tests, zero failures/errors/skips. Financial integration coverage includes deductions, multiple/late payments, overpayment clamping, and SOA-only clients. PowerShell reported a nonzero native-command status despite Maven's successful test summary; the same stderr behavior occurred for successful Docker build output. The image build and backend recreation completed, and startup explicitly skipped seeding at 50,000 shipments.

One comparison k6 run was performed after rebuilding only the backend, without changing thresholds or resources:

| Metric | Before | After |
| --- | --- | --- |
| Requests | 2,782 | 2,847 |
| Requests/second | 22.59 | 23.27 |
| Admin p95 | 3.89 s | 3.42 s |
| Courier p95 | 1.09 s | 1.08 s |
| Dispatch p95 | 900.78 ms | 894.40 ms |
| Receiving p95 | 1.09 s | 1.10 s |
| Failed requests | 0% | 0% |

All role latency gates remain unmet. These single-run comparisons are diagnostic; startup warmth and normal run variation prevent precise attribution of endpoint gains to this query alone. They do not establish final performance acceptance. Reports and Weekly Collections are not directly exercised by this script; Dashboard uses the collection totals path.

During the comparison, sampled MySQL CPU reached 98.02%, versus backend CPU 24.86%. Sampled memory reached approximately 768 MiB for MySQL and 596 MiB for the backend. Active queries also included Dashboard's unpaid-shipment count and shipment-list counts. These remain measurement candidates, not proven dominant costs. No further source optimization or test rerun was performed.

What to test manually: open the same cycle on Dashboard and Weekly Collections, compare outstanding balances and active-client counts, then switch through all three seeded cycles and check paid amounts, deductions, statuses, and SOA-only rows against trusted data. Expect unchanged successful response schemas and unchanged shipment/payment/statement data; load-test mobile logins may refresh synthetic device sessions. Raw local verification/build/k6 logs are under ignored `backend/target/collections-query-*.log` and contain no exported login tokens. Full performance closure remains pending.

## Dashboard aggregate slice, 2026-10-17

### Scope and baseline

Only Dashboard parcel and cycle financial aggregation change in this slice. Reports, shipment listing, substring search, courier counting, public responses, and authorization remain unchanged. The approved Collections scalar-payment improvement is preserved. Both containers retain 1 CPU / 1 GiB; Hikari retains five connections. No dependency, cache, index, schema, timezone, timeout, or resource configuration changes are introduced.

The original backend image is `sha256:f6727a75dfaa7ccde33607536b9030d3f3a4892a9f60b9c874d7dc6cb17a2319`; its application JAR SHA-256 is `db2b23cfa1759a4b2ca7834ca2e2694e347d5cf8c3163da61bd203d9283b2700`. It started at `2026-10-17T04:28:25.590720944Z` and explicitly skipped seeding at 50,000 shipments. The image matches the prior build log, but exact source revision identity remains unresolved: the artifact has no established revision mapping and differs from locally generated classes. Therefore all earlier API timings and any deployment timing comparison remain provisional.

Mem Reduct was absent from the process list and no matching scheduled task was found. Its automatic-cleaning preference could not be confirmed. The isolated capture checks process absence before/after each pass; this does not prove that the preference is disabled. The logistics browser tab was closed by the user; no k6 workload was run.

The first Python localhost timing pass included approximately 2 seconds of connection overhead. An unauthenticated control took 2,089.6 ms through localhost versus 2.9 ms through `127.0.0.1`. That pass is discarded and retained separately as `results/dashboard-slice-before-localhost-discarded.json`. The replacement pass uses `127.0.0.1` consistently before/after.

### Equivalence before source changes

All projected financial outputs and non-lost status/lost counts matched across cycles ending October 8, 15, and 22. Read-only CTE fixtures also matched for zero charges, unpaid/partial/full/overpaid shipments, multiple and late payments, empty cycles, start/end exclusions, and lost/completed overlap. No fixture data was inserted into the simulation. The financial fixture returned 7 shipments, quantity 14, charges 530.00, unpaid count 3, and payments 260.00.

A Connector/J probe in the backend's UTC timezone confirmed that the existing `23:59:59.999999999` end parameter binds as next midnight. A second fixture compared the rounded bound: both calculations returned 8 shipments, quantity 23, charges 1529.00, unpaid count 3, and payments 1259.00. This existing precision behavior is preserved, not corrected by this slice. Raw SQL uses explicit literal bounds and is distinguished from actual JDBC/service calls.

### Pre-deployment diagnostic evidence

One discarded warm-up and three sequential active Dashboard requests returned HTTP 200: 853.49 / 799.31 / 814.71 ms, each 2,031 bytes. Three resource snapshots overlapped the capture, including additional seeded/empty-cycle response comparisons. These are diagnostic samples, not p95 acceptance.

Alternating warm `EXPLAIN ANALYZE` samples, with a discarded initial pass:

| Query | Three execution times, ms | Result rows |
| --- | --- | --- |
| Existing cycle summary | 39.6 / 35.4 / 36.4 | 1 |
| Existing unpaid count | 133 / 135 / 133 | 1 |
| Existing collected payments | 87.7 / 85.9 / 86.4 | 1 |
| Combined cycle financial candidate | 154 / 149 / 154 | 1 |
| Existing non-lost status | 263 / 244 / 252 | 5 |
| Existing lost count | 94.8 / 94.4 / 96.2 | 1 |
| Combined parcel candidate | 173 / 164 / 174 | 9 |

The old parcel plans scan 145,827 parcels separately for status and loss. The candidate follows the shipment date index for 16,680 cycle shipments, then the parcel shipment index for 48,650 parcels. The financial candidate groups payment rows once per shipment before the outer sums, preserving quantities/charges with multiple payments. Its materialized shipment-level rows remain in SQL; no shipment/payment collections are hydrated in the application. Exact SQL, complete plans, samples, response snapshots, resource samples, and source manifests are in the ignored `results/dashboard-slice-*` artifacts.

### Verification status

Implementation and automated correctness verification are complete. The first requested-suite run reported 51 tests with five new-test errors: unsupported `LocalDate.atNoon()` calls and unfinished Mockito stubbing caused by nested repository calls. The IDE had generated error-containing class files before Maven's incremental checks. The second run passed 50/51 tests with complete response parity, but the nominally outside-cycle fractional fixture rounded into the cycle at persisted timestamp precision. The fixture was moved to one full second before the start; its six-shipment assertion was retained. Separate fractional-bound and next-midnight compatibility checks remain. No public contract assertions were weakened and no production remediation was needed.

The final requested run passed 51 tests with zero failures, errors, or skips: Dashboard 11, Collections 8, Collections aggregation 2, Reports 17, four-role authorization 11, and admin-console authorization 2. Command from `backend/`: `mvn -o test "-Dtest=DashboardIntegrationTest,CollectionsIntegrationTest,CollectionsAggregationIntegrationTest,ReportIntegrationTest,FourRoleAuthorizationIntegrationTest,AdminConsoleAuthorizationIntegrationTest"`. Maven explicitly recompiled 209 production and 47 test source files for Java 21 after generated class timestamps were made stale; no build configuration or evidence logs were deleted. The first two runs are retained in `backend/target/dashboard-slice-verification*.log`, and the passing run is `backend/target/dashboard-slice-verification-3.log`. `git diff --check` passed.

The backend-only image build succeeded: `sha256:f70d325d321d1832927547a138e9e30e78d1fe437ed60576516e4b991e0de228`. A source hash manifest was recorded immediately before the build. Only `backend-sim` was rebuilt/recreated using the existing Compose file and `--no-deps`; MySQL was not rebuilt or recreated. However, the existing MySQL container had already received a shutdown signal at `2026-10-17T05:15:36Z` and exited with code 137 at `05:15:39Z`, before the rebuild. Docker reported `OOMKilled=false`; the reason for the external stop is unknown. The new backend's first startup consequently failed to connect to MySQL. The user then explicitly approved starting the same MySQL container and the rebuilt backend to complete verification. No reset, volume deletion, dependency recreation, or resource change occurred.

Pre-deployment capture resource samples reached backend CPU 4.68% / memory 597 MiB and MySQL CPU 96.65% / memory 615.4 MiB. These samples overlap the active-cycle requests and additional response snapshots; they are not continuous maxima.

### Deployment and final isolated verification

Successful startup completed at `2026-10-17T05:24:03Z` and explicitly skipped seeding because the database already contained 50,000 shipments. MySQL retained container ID `d1f1a36e11b6bd7e10a1c9e185655bf35e8a32524b996f22a0f339a038557be6`, its original image/volume, and the 256 MiB buffer pool. Both containers retained 1 CPU / 1 GiB; the backend retained five connections and UTC. MySQL durability remained `innodb_flush_log_at_trx_commit=1` and `sync_binlog=1`.

The rebuilt JAR SHA-256 is `6396f325325fcf6b15baab8b030d25dfc93e3e71e7d62c2e497afa12069c9a4e`. All backend source, POM, and Dockerfile hashes still matched the recorded pre-build source manifest after verification. The build log records the source copy and successful Java 21 package build. This identifies the new artifact by image/JAR hashes and its working-tree source manifest; it does not resolve the original image's source revision.

After one discarded warm-up, the three sequential active Dashboard samples were 653.85 / 677.58 / 653.18 ms. All returned HTTP 200 and 2,031 bytes. Every Dashboard response field, including aliases, segments/order/colors, weekly volume, collection cards, financial comparisons, and recent activity, matched the saved baseline for all three seeded cycles and the empty cycle ending `2036-03-07`. Dashboard has no generation timestamp field to exclude. Business counts remained exactly 50,000 shipments, 145,827 parcels, 645,790 events, 36,807 payments, and 1,437 statements.

Repeated alternating warm SQL-equivalent plans after restart:

| Query | Three execution times, ms | Result rows |
| --- | --- | --- |
| Existing cycle summary | 41.7 / 37.9 / 37.6 | 1 |
| Existing unpaid count | 129 / 141 / 132 | 1 |
| Existing collected payments | 93.6 / 86 / 84.4 | 1 |
| Combined cycle financial query | 158 / 146 / 144 | 1 |
| Existing non-lost status | 236 / 234 / 234 | 5 |
| Existing lost count | 92.2 / 96.1 / 93.9 | 1 |
| Combined parcel query | 155 / 176 / 153 | 9 |

The financial alternative reduced the three original SQL statements' combined execution work from 254-265 ms to 144-158 ms. The parcel alternative reduced the two original statements' combined work from 328-330 ms to 153-176 ms. These are repeated SQL-equivalent comparisons on the same restarted database, not service-call timings. The financial query materializes 16,680 shipment-level rows inside MySQL, then returns one projection; the parcel query returns nine aggregate rows. Dashboard replaces five affected aggregate statements with two, without application-level payment/parcel hydration or N+1 queries. Full request SQL counts were not instrumented because the existing performance schema and SQL logging settings were preserved.

Three after-capture resource snapshots reached backend CPU 40.81% / memory 463.2 MiB and MySQL CPU 89.01% / memory 287.1 MiB. They overlap Dashboard requests and subsequent cycle snapshots. Fresh JVM state and the intervening database restart make these resource differences unsuitable for attributing memory/CPU savings to the queries. No Mem Reduct or k6 process was present at either end of the capture; its automatic-cleaning preference remains unconfirmed. No k6 concurrency workload ran.

No heap exhaustion, GC-overhead, metaspace, connection-pool timeout, or application ERROR messages were found after the successful restart through the verification window. The earlier failed startup while MySQL was stopped is recorded separately and excluded from isolated request timings. The new backend and MySQL report no OOM kill. Raw filtered runtime evidence is `backend/target/dashboard-slice-runtime-check.log`.

Implementation, automated correctness, backend-only deployment, and isolated verification are complete. The old/new API timing observations remain provisional, not a verified deployment comparison, because original source identity is unresolved and MySQL restarted between passes. Three samples do not establish p95 capacity, reliability, five-courier normal capacity, or nine-courier peak capacity. Concurrent performance acceptance remains pending; no additional optimization loop was started. The manual checklist is in [README.md](README.md#dashboard-aggregate-slice-2026-10-17).

## Admin Tracking Logs substring investigation, 2026-10-17

The pre-approval investigation completed against an identified deployed source. At that stage all backend source/build hashes matched the deployed Dashboard image's source manifest. The before API baseline is identified by image `sha256:f70d325d321d1832927547a138e9e30e78d1fe437ed60576516e4b991e0de228` and JAR hash `6396f325325fcf6b15baab8b030d25dfc93e3e71e7d62c2e497afa12069c9a4e`. The subsequent approved implementation is recorded below. Earlier observations against the older unresolved image remain provisional.

UNION and entity-membership candidates passed 57 exact event-ID set comparisons and 21 ordered page comparisons across eight page groups. Coverage includes all six search fields, case/trim behavior, broad/empty/no-match inputs, wildcard/backslash semantics, status/date combinations, positive vehicle matches, overlap deduplication, nullable relationships through read-only fixtures, timestamp ties, adjacent/beyond-last pages, and 500-row paging. Full ID lists were compared; counts/sums/checksums were not used as equality substitutes. No fixture rows were inserted into the preserved simulation.

The universal UNION approach is rejected. The ID-only broad count improved from 1867-1958 ms to 1297-1421 ms, but page work rose from about 0.22 ms to 1174-1212 ms. Both queries materialized 645,790 IDs and recorded a disk temporary table. A timestamp-carrying UNION variant regressed broad count/page work to about 4.5-4.7 seconds combined and `%` search to about 8.5 seconds, despite strong selective/no-match gains. These were read-only experiments, not applied/reverted application changes.

The proposed smaller alternative keeps matching entity IDs in derived `DISTINCT` subqueries and uses `IN` predicates over tracking events. Paired warm SQL samples show broad count 643-658 ms versus 1813-1838 ms, no-match count 962-1011 ms versus 1772-1829 ms, combined-filter count 399-404 ms versus 728-747 ms, and `%` count 644-648 ms versus 1328-1372 ms. Broad/combined pages retain sub-millisecond ordered selection. Selective count/page work improves from approximately 4.8 seconds to 2.9 seconds but still does not establish the 1.5-second target. Candidate 500-row page selection took 1.52-1.72 ms versus 2.63-3.73 ms. Membership recorded no disk temporary tables or sort-merge passes in these samples.

The existing identified API baseline returned HTTP 200 for every request: selective tracking 4300.79-5205.41 ms, broad staff 1457.69-1500.30 ms, no-match 1469.21-1559.42 ms, combined filters 582.29-629.98 ms, reversed dates 13.66-15.34 ms with empty content/zero total, 500-row CSV 1534.74-1567.44 ms with exact total 645,790, and beyond-last selective page 1587.29-1624.59 ms with empty content/total two. One warm-up was discarded and three sequential samples were recorded for each query/endpoint. SQL-equivalent timing comparisons are distinct from API timings; there are no candidate API measurements yet.

Both runtime containers retained 1 CPU / 1 GiB, five Hikari connections, UTC, existing timeouts, and the 256 MiB buffer pool. Final counts remain 50,000 shipments, 145,827 parcels, 645,790 events, 36,807 payments, and 1,437 statements. No cache, dependency, index, configuration, schema, reset, Git write, k6 workload, or other-feature change occurred. Mem Reduct was absent but its automatic-cleaning preference remains unconfirmed. No application ERROR/heap/pool exhaustion was found during the API baseline window. Resource observations, exact SQL/plans/results, and all comparison artifacts remain locally ignored under `results/tracking-search-*`.

No Maven tests ran during the pre-approval investigation. The requested suites and manual checks were defined in the proposal; the approved implementation and execution results follow. Final performance acceptance remains pending.

### Approved IN-based implementation and isolated API verification

The user approved the proposed IN-based diff and requested the specified regression suites, a backend-only rebuild, isolated API measurements, and a stop. The applied production diff matches the approved patch exactly. Only AdminTrackingEventRepositoryImpl and TrackingLogIntegrationTest differ from the preceding backend source manifest; completed Dashboard, Collections, Reports, courier, configuration, and dependency files were preserved.

Five focused regression methods add exact ordered-ID/total checks against the original joined predicate for all search fields, case/trim/wildcard/backslash inputs, overlap deduplication, valid null vehicles, status/date bounds, reversed dates, tied ordering, adjacent/beyond-last pages, and 502 matches paged as 500 plus two. A read-only null-staff CTE executes SQL captured from the actual production query builder, preserving the persisted non-null staff constraint. Existing assertions are unchanged.

The first attempt stopped at compilation because the new fixture used the wrong password-hash getter. Correcting it required no assertion or production change. The next run passed all 59 tests with zero failures/errors/skips: Tracking Logs 26, personal history 20, four-role authorization 11, admin-console authorization 2. Command from `backend/`: `mvn -o test "-Dtest=TrackingLogIntegrationTest,PersonalTrackingHistoryIntegrationTest,FourRoleAuthorizationIntegrationTest,AdminConsoleAuthorizationIntegrationTest"`. The passing log is `backend/target/tracking-search-verification-2.log`. `git diff --check` passed.

Only `backend-sim` was rebuilt/recreated with the existing Compose file and `--no-deps`. New image: `sha256:895c644db9035e3a1b26784969d6483792e3b597c3b0b32f12dddbb0bafc2d7a`; JAR: `28ba36f9ea64a2115a6bbb259e919f5cf594e4130677ccecfd52b230d844551e`. All backend source/POM/Dockerfile hashes still match the immediately pre-build manifest. Startup completed at `2026-10-17T06:10:19Z` and explicitly skipped the completed 50,000-shipment seed. MySQL was not rebuilt, recreated, or restarted; container ID and start time stayed unchanged.

Actual API measurements after one discarded warm-up per case, with three sequential recorded samples and a 15-second request deadline:

| API request | Before samples, ms | After samples, ms |
| --- | --- | --- |
| Selective tracking ID | 5205.41 / 4408.80 / 4300.79 | 1947.58 / 1936.28 / 2008.11 |
| Broad staff | 1500.30 / 1457.69 / 1496.79 | 291.79 / 296.58 / 290.03 |
| No match | 1514.67 / 1559.42 / 1469.21 | 415.68 / 408.45 / 407.54 |
| Staff/status/date | 629.98 / 582.29 / 593.96 | 300.48 / 267.40 / 274.85 |
| Reversed dates | 15.34 / 14.01 / 13.66 | 14.67 / 32.70 / 14.07 |
| Broad 500-row CSV | 1538.23 / 1534.74 / 1567.44 | 296.75 / 287.23 / 288.23 |
| Beyond-last selective page | 1618.33 / 1624.59 / 1587.29 | 567.57 / 548.55 / 546.91 |

All 21 recorded after requests returned HTTP 200 with identical ordered IDs, exact totals, complete pagination metadata, and response byte sizes. Respective sizes were 917, 10866, 77, 10936, 77, 215356, and 79 bytes. The 500-row request returned exactly 500 DTOs and total 645,790; reversed dates returned empty content/zero total; beyond-last retained total two with empty content. The command was `python load-tests/results/tracking-search-investigation.py api-after`. Both source/artifact identities are established for this comparison; older unresolved-image observations are excluded. SQL-equivalent plans above remain separate evidence, not endpoint timings.

After-capture samples reached backend CPU 14.43% / memory 597.3 MiB and MySQL CPU 100.29% / memory 506.2 MiB. These are sampled observations with JVM warmth/run variance, not continuous peaks or attributable resource savings. No application ERROR, heap/metaspace/GC exhaustion, or pool exhaustion was found during the API window; neither container reported an OOM kill. Mem Reduct/k6 were absent, but the automatic-cleaning preference remains unconfirmed.

Business counts remain 50,000 shipments, 145,827 parcels, 645,790 events, 36,807 payments, and 1,437 statements. Both containers retain 1 CPU / 1 GiB, five connections, UTC, the existing 256 MiB MySQL buffer pool, original timeouts, and normal durability. No dependency, index, cache, schema, resource, Git, or k6 changes occurred.

Implementation, regression verification, backend-only deployment, and isolated API verification are complete. Selective latency remained unmet at 1.94-2.01 seconds against 1.5 seconds in isolation. These three-sample observations did not establish acceptance; subsequent concurrent results are recorded below. Manual checks: search each supported field with case, wildcard, and backslash variants; verify exact totals, tied ordering, adjacent/beyond-last pages, 500-row CSV, reversed dates, and 401/403 access.

## Reports parcel aggregation investigation, 2026-10-17

Read-only exact-value comparison passed for every date, all status counts, decimal weight/volume, daily completed deliveries, Lost count, and completion numerator in the default month and full seeded range. Focused CTE fixtures covered empty days, October 8/9 and 15/16 cycle boundaries, null decimal fields, parcels both lost and COMPLETED, and the existing JDBC-rounded next-midnight report bound. No simulation data changed. The production changes are in the parcel repository, daily parcel projection, and Reports service; the approved source diff remains in local review artifacts.

The exact projected query grouped by date, loss flag, and current status took 541/530/530 ms for the default month and 547/533/531 ms for the full seeded range. Alternating paired samples of the four existing queries took 916.6/953.0/914.3 ms and 914.7/914.0/917.5 ms respectively. The candidate returns 27 aggregate rows versus ten across the four originals. Plans show one shipment-date/parcel-shipment join over 50,000 shipments and 145,827 parcels; the old status/lost/completed queries perform additional parcel/index scans and shipment lookups. No disk temporary table or sort-merge pass was recorded. SQL-equivalent timings are distinct from service-call timings; exact `Rows_examined` was unavailable under unchanged instrumentation.

Identified deployed Reports API baseline: HTTP 200 at 2093.99/2019.91/2241.46 ms, 353,754 bytes, for the default month; 1998.80/2023.64/2110.32 ms, 352,889 bytes, for the seeded range. Each period used one discarded warm-up and three sequential requests. No candidate backend/API measurement exists. The runtime containers, dataset, 1 CPU / 1 GiB limits, five connections, timezone, and timeouts were unchanged; no k6 ran. Mem Reduct saved config records automatic reduction enabled and interval trigger disabled; its process was absent, and the config hash was stable across probes.

The user approved the Reports-only diff. Targeted Report/Dashboard regressions, backend-only deployment, and isolated API comparison are now complete. Final Reports p95 below five seconds and failed requests below 1% remain separate acceptance targets; these diagnostic samples cannot establish formal capacity. The proposal retains the approved SQL/result mapping diff and manual checks. Existing Dashboard, Collections, Tracking Logs, courier, and financial code was preserved.

### Approved Reports parcel implementation and isolated API verification

Only the Reports parcel query, internal projection, result mapping, and focused ReportIntegrationTest regression changed. The added fixture spans October 8/9/16, an empty day, decimal weight/volume, a lost COMPLETED parcel, null measurements, and reversed dates. Both lost and non-lost COMPLETED parcels count in the completion numerator/daily completed field; the ordinary COMPLETED distribution excludes the lost parcel. Exact decimal daily sums, 60.0% completion rate, Lost/status counts, period billed revenue, and full reversed response equality except `generatedAt` passed.

From `backend/`, `mvn -o test "-Dtest=ReportIntegrationTest,DashboardIntegrationTest"` passed 29 tests with zero failures/errors/skips (Reports 18, Dashboard 11). The local verification log has its generated development test password redacted. `git diff --check` passed; no existing assertions were weakened.

Only `backend-sim` was rebuilt/recreated with the existing Compose file and `--no-deps`. New image: `sha256:3626c5cbdf57a838e52dad6a00018f1ddb38a9286cfbcbcedabe021dcc605671`; JAR SHA-256: `fb9bf39cb75cd4a6624e868188bdead683909aaff57346e776d7a0342e12d489`. All backend source/POM/Dockerfile hashes still matched the immediately pre-build source manifest after deployment. Successful startup at `2026-10-17T06:42:10Z` explicitly skipped seeding. MySQL kept its original container ID/start time; no database restart/reset occurred.

One discarded warm-up and three sequential recorded Reports API calls per period used a 15-second request deadline:

| Period | Before, ms | After, ms | Response bytes |
| --- | --- | --- | ---: |
| Default month | 2093.99 / 2019.91 / 2241.46 | 1778.31 / 1733.45 / 1695.07 | 353,754 |
| Full seeded range | 1998.80 / 2023.64 / 2110.32 | 1773.61 / 1694.02 / 1721.42 | 352,889 |

All six after requests returned HTTP 200. Every response field and array order matched the corresponding saved before snapshot except `generatedAt`; response byte sizes were identical. The SQL-equivalent 0.37-0.42 second improvement above is independent evidence and is not attributed mechanically to the API time delta. Fresh JVM warmth and three samples limit precision; no accepted p95/concurrency claim is made.

Sampled after-capture backend CPU reached 22.59% / memory 508.0 MiB; MySQL CPU 97.33% / memory 529.8 MiB. These are observed samples, not continuous maxima or attributed memory savings. No heap/metaspace/GC failure, pool exhaustion, or application ERROR appeared during the API window; neither container reported an OOM kill. Mem Reduct configuration remained `AutoreductEnable=true`, `AutoreductIntervalEnable=false`, with an unchanged hash and no active process. No k6 workload ran.

Final business counts remain 50,000 shipments, 145,827 parcels, 645,790 tracking events, 36,807 payments, and 1,437 statements. Both containers retain 1 CPU / 1 GiB, five Hikari connections, UTC, the 256 MiB MySQL buffer pool, normal durability, and existing timeouts. No dependency, cache, index, schema, Git, or unrelated feature change occurred.

Implementation and isolated verification are complete. All measured Reports requests stayed below the five-second target. Subsequent concurrent results are recorded below. Manual checks: compare both Reports periods field by field except `generatedAt`; verify decimal totals, empty and boundary days, lost-COMPLETED handling, reversed dates, and 401/403 access.

## Concurrent performance acceptance (2026-10-17)

### Test environment, limits, and setup

Workloads were executed using the dedicated acceptance runner (`load-tests/run-acceptance.ps1`) and k6 script (`load-tests/concurrent-acceptance.js`).
- Containers: 1 CPU / 1 GiB limits each for backend and MySQL.
- Backend JVM: `-XX:+UseSerialGC -Xmx512m -Xms128m -XX:MaxMetaspaceSize=110m -XX:ReservedCodeCacheSize=48m -XX:TieredStopAtLevel=1 -Xss512k`.
- MySQL: 256 MiB InnoDB buffer pool, 5 Hikari pool connections, normal durability (`innodb_flush_log_at_trx_commit=1`, `sync_binlog=1`).
- Duration: 60-second discarded warm-up followed by 600 seconds (10 minutes) of measured traffic.
- User accounts and device sessions:
  - 1 Admin: rotates Dashboard, Tracking Logs and metrics, selective Tracking Logs search, Weekly Collections, Reports default month, and Reports full range with 2-second pauses between completed page visits.
  - 1 Receiving Staff: operational reads (shipments list, vehicles list) with 10-second pauses.
  - 1 Dispatch Staff: operational reads (metrics, history, scan context) with 10-second pauses.
  - Couriers (5 for Normal, 9 for Peak/Growth): personal history, metrics, and scan-context reads with 10-second pauses. LT-FIELD exercised as tagged hot-history courier across runs. All 8 synthetic couriers provisioned via standard mobile onboarding APIs with distinct device bindings.
- Database volumes and integrity:
  - 50,000-shipment primary simulation (`tnl-sim-50k`): counts verified before and after each run at exactly 50,000 shipments, 145,827 parcels, 645,790 tracking events, 27,081 waybills, 1,437 statements, and 36,807 payments (0 business writes).
  - 100,000-shipment growth project (`tnl-admin-opt-growth`): counts verified before and after at exactly 100,000 shipments, 291,655 parcels, 1,291,601 tracking events, 54,166 waybills, 1,437 statements, and 73,612 payments (0 business writes).
- Mem Reduct was absent and not cleaning memory during all three runs (`before: false`, `after: false`).
- Reliability: 0% failed requests, 0 client 15-second timeouts, 0 Hikari connection pool acquisition timeouts, 0 JVM OutOfMemoryErrors, 0 container restarts or OOM kills across all three runs.

### Measured results across acceptance workloads

| Endpoint / Target Name | Limit | Normal 50k (5 Couriers) | Peak 50k (9 Couriers) | Growth 100k (9 Couriers) |
| :--- | :---: | :---: | :---: | :---: |
| **Admin: Dashboard Summary** | < 1500 ms | 1,143.0 ms (31 samples) [PASS] | 757.0 ms (34 samples) [PASS] | 2,150.1 ms (22 samples) [INSUFFICIENT] |
| **Admin: Tracking Logs Page** | < 1500 ms | 134.0 ms (32 samples) [PASS] | 111.0 ms (34 samples) [PASS] | 362.3 ms (22 samples) [INSUFFICIENT] |
| **Admin: Tracking Metrics** | < 1500 ms | 15.6 ms (32 samples) [PASS] | 18.5 ms (34 samples) [PASS] | 2,264.6 ms (22 samples) [INSUFFICIENT] |
| **Admin: Tracking Selective Search** | < 1500 ms | 1,180.0 ms (32 samples) [PASS] | 900.7 ms (34 samples) [PASS] | 3,160.2 ms (22 samples) [INSUFFICIENT] |
| **Admin: Weekly Collections** | < 1500 ms | 686.6 ms (32 samples) [PASS] | 406.7 ms (35 samples) [PASS] | 1,601.0 ms (22 samples) [INSUFFICIENT] |
| **Admin: Reports Default Month** | < 5000 ms | 4,135.6 ms (32 samples) [PASS] | 2,069.9 ms (34 samples) [PASS] | 5,671.1 ms (22 samples) [INSUFFICIENT] |
| **Admin: Reports Full Range** | < 5000 ms | 4,664.8 ms (32 samples) [PASS] | 2,090.6 ms (34 samples) [PASS] | 5,761.4 ms (21 samples) [INSUFFICIENT] |
| **Role: Receiving (Aggregate)** | < 500 ms | 395.2 ms (116 samples) [PASS] | 247.8 ms (118 samples) [PASS] | 897.9 ms (112 samples) [FAIL] |
| `GET /api/v1/shipments?page=0&size=20` | < 500 ms | **566.7 ms (58 samples) [FAIL]** | 294.9 ms (59 samples) [PASS] | 985.4 ms (56 samples) [FAIL] |
| `GET /api/v1/vehicles/options` | < 500 ms | 93.4 ms (58 samples) [PASS] | 67.5 ms (59 samples) [PASS] | 185.1 ms (56 samples) [PASS] |
| **Role: Dispatch (Aggregate)** | < 500 ms | 84.6 ms (180 samples) [PASS] | 53.3 ms (180 samples) [PASS] | 1,069.2 ms (162 samples) [FAIL] |
| Dispatch Metrics | < 500 ms | 19.6 ms (60 samples) [PASS] | 13.2 ms (60 samples) [PASS] | 572.2 ms (54 samples) [FAIL] |
| Dispatch History | < 500 ms | 126.4 ms (60 samples) [PASS] | 68.6 ms (60 samples) [PASS] | 1,308.6 ms (54 samples) [FAIL] |
| Dispatch Scan Context | < 500 ms | 65.5 ms (60 samples) [PASS] | 15.9 ms (60 samples) [PASS] | 63.2 ms (54 samples) [PASS] |
| **Role: Courier (Aggregate)** | < 500 ms | 70.1 ms (897 samples) [PASS] | 41.7 ms (1,620 samples) [PASS] | 403.5 ms (1,599 samples) [PASS] |
| Courier Metrics | < 500 ms | 24.0 ms (299 samples) [PASS] | 16.8 ms (540 samples) [PASS] | 600.0 ms (533 samples) [FAIL] |
| Courier History | < 500 ms | 108.1 ms (299 samples) [PASS] | 69.9 ms (540 samples) [PASS] | 729.3 ms (533 samples) [FAIL] |
| Courier Scan Context | < 500 ms | 43.7 ms (299 samples) [PASS] | 26.2 ms (540 samples) [PASS] | 78.8 ms (533 samples) [PASS] |
| **Hot History (LT-FIELD)** | < 500 ms | 140.7 ms (177 samples) [PASS] | 95.2 ms (180 samples) [PASS] | 1,110.2 ms (159 samples) [FAIL] |

### Findings and analysis

1. **50k Normal Run Gate Failure:**
   - In the 50k Normal run, the receiving shipment-list endpoint (`GET /api/v1/shipments?page=0&size=20`) recorded a p95 of 566.7 ms (58 samples), exceeding the 500 ms threshold. While the receiving role aggregate passed at 395.2 ms due to fast vehicle options lookups (93.4 ms), the individual shipment-list gate failed.
   - Under 50k Peak load, after buffer cache warming, receiving shipments passed at 294.9 ms and all 12 measured gates met their thresholds.

2. **100k Growth Scaling and Insufficient Admin Samples:**
   - On 100,000 shipments with 1 CPU and 256 MiB InnoDB buffer pool, longer query execution times extended the admin rotation loop to ~27 seconds. Within the 10-minute measured window, admin endpoints completed only 21 to 22 iterations, falling short of the 30-sample minimum required for a p95 closure claim.
   - Multiple admin endpoints missed their latency targets: Dashboard (2,150.1 ms), Metrics (2,264.6 ms), Selective Search (3,160.2 ms), Collections (1,601.0 ms), Reports Default (5,671.1 ms), and Reports Full Range (5,761.4 ms).
   - Mobile endpoints also degraded under 100k load: Receiving Shipments (985.4 ms), Dispatch History (1,308.6 ms), Dispatch Metrics (572.2 ms), Courier History (729.3 ms), Courier Metrics (600.0 ms), and Hot History (1,110.2 ms).
   - These results define the concurrency and scaling bounds of the single-container 1 CPU / 1 GiB deployment profile.

3. **Clarification on Populated-Day Tracking Metrics:**
   - The k6 acceptance script called `/api/v1/tracking-events/metrics` without date parameters, which defaults to `LocalDate.now()` (today, an empty day in the historical dataset, returning 0 counts in 15.6-18.5 ms).
   - The separate populated-day SQL check (`EXPLAIN ANALYZE` on `2026-10-16` covering 451,980 events, running in 1,226 ms) was an isolated database probe and is not concurrent API load evidence.
   - Tracking metrics under concurrent load on a heavily populated day remains an unmeasured scenario.

4. **Live SSE Outage and Recovery Status:**
   - Client-side backoff schedule, jitter bounds, event stream chunking, and 401/403 terminal handling are verified by automated tests (`sseClient.test.mjs`, `requestCoordinator.test.mjs`).
   - A live container outage/recovery test against the running backend container was not performed because it requires stopping the backend process, which requires explicit approval under repository ground rules. Live SSE outage and recovery verification remains PENDING.

### Scope and acceptance status

This work represents a verified query, memory hydration, and lifecycle coordination improvement with open acceptance gates. It does not constitute full performance acceptance across all workloads:
- 50k Peak passed all 12 measured gates.
- 50k Normal failed the receiving shipment-list gate (566.7 ms vs 500 ms).
- 100k Growth had insufficient admin samples (21-22 vs 30 minimum) and missed multiple latency targets.
- Live SSE outage/recovery remains pending.
