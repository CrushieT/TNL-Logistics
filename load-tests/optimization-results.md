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
