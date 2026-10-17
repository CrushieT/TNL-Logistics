# Load Testing & Performance Benchmarks

This directory contains k6 performance benchmarks and load testing scripts designed to evaluate the application under low-cost container resource limits (512 MB RAM / 0.5 vCPU).

---

## Part 1: Docker Environments (Managing the Containers)

Choose the Docker environment you want to run. Commands are grouped by stack.

### Stack A: Cloud Plan Simulation (`docker-compose.sim.yml`)
> **Target:** Port `8080` (MySQL on `3308`)  
> **Profile:** Simulates Railway Hobby & Aiven Developer-1 plan limits (512M RAM / 0.5 vCPU per service, Serial GC).

```powershell
# Start the stack
docker compose -f docker-compose.sim.yml up -d

# View backend logs (wait for "Started TnlLogisticsApplication")
docker logs -f logistics-backend-sim-1

# Monitor live memory and CPU usage
docker stats logistics-backend-sim-1 logistics-mysql-sim-1

# Stop the stack
docker compose -f docker-compose.sim.yml down

# Stop and wipe database volume (clean reset)
docker compose -f docker-compose.sim.yml down -v
```

---

### Stack B: Dedicated Benchmark Stack (`docker-compose.loadtest.yml`)
> **Target:** Port `8082` (MySQL on `3307`)  
> **Profile:** Dedicated loadtest profile connected to the 50,000-shipment synthetic dataset via `.env.loadtest`.

```powershell
# Start the stack
docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest up -d

# View backend logs (wait for "Started LogisticsApplication")
docker logs -f logistics-backend-loadtest-1

# Monitor live memory and CPU usage
docker stats logistics-backend-loadtest-1 logistics-mysql-loadtest-1

# Stop the stack (preserves seeded volume)
docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest down

# Stop and wipe database volume
docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest down -v
```

---

## Part 2: Database Seeding (First-Time Setup for Stack B)

If `mysql_loadtest_data` is empty:
1. In `.env.loadtest`, set `LOADTEST_SEED_ENABLED=true`.
2. Set `LOADTEST_SEED_PASSWORD` to a local test password. All seeded accounts use this password.
3. Build and start Stack B with `docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest up -d --build`. Wait for `Load-test seed complete: shipments=50000, clients=500, vehicles=100` in the logs.
4. Set `LOADTEST_SEED_ENABLED=false` and recreate the backend container to apply that environment change, or leave seeding enabled to retain startup completeness checks. A completed seed is preserved on restart.

The seeder creates the first 72 shipments through the same registration, printing, tracking, payment, waybill, and parcel-exception services as the workflow profile. It expands those complete workflow snapshots to the configured target using parameterized multi-row inserts, preserving audit histories and relationships while remapping identifiers, client pricing, payments, and print fingerprints. Statements and collections still use the application services. Defaults are 50,000 shipments, 500 clients, and 100 vehicles. `LOADTEST_SEED_SHIPMENTS`, `LOADTEST_SEED_RANDOM_SEED`, and `LOADTEST_SEED_BATCH_SIZE` remain configurable; transactions are capped at 250 shipments to bound memory. Data choices repeat for the same seed; identifiers and billing dates follow the current year and active weekly cycle. Wait for the final completion message, including statements, before benchmarking.

Twenty-four operational scenarios repeat across the dataset, identified in descriptions by `LT01-` through `LT24-`. These include unprinted and mixed labels, reprint counts, courier and dispatcher queues, generated/sent/completed manifests, split manifests, loss/recovery, partial-loss and all-lost reconciliation, reopened manifests, direct delivery, and an 18-parcel manifest. Shipments span three billing cycles with paid, unpaid, partial, and multiple payments, SOA deductions, and a reserved unbilled client (`LT-CL-0007`). Client 500 and vehicle 100 are inactive directory fixtures.

Accounts are `loadtest-admin`, `loadtest-office`, `loadtest-field`, `loadtest-dispatch`, `loadtest-onboarding`, `loadtest-nopin`, and `loadtest-disabled`. Office, courier, and dispatch accounts have test PIN `1111`; onboarding requires a password change, the no-PIN account has no PIN, and the disabled account cannot sign in. The disabled account is persisted only after all fixtures and statements finish, serving as the seed completion marker.

An old volume with the same shipment count is rejected because it lacks the completion marker. Partial seeds and mismatched shipment counts also fail startup. Use an empty dedicated load-test database/volume for the new fixtures; the seeder never deletes or upgrades existing data. The volume-wipe command above deletes the load-test dataset and must be run only when intentionally resetting it.

Both hybrid k6 scripts discover a sample of actual tracking IDs from the admin tracking-log API during setup and carry the courier device session returned by mobile login. They no longer assume `TRK-LT-...` IDs. Set `LOADTEST_PASSWORD` to the same value as `LOADTEST_SEED_PASSWORD` when running benchmarks.

### What to Test After Updating the Seeder

- Automated: from `backend/`, run `mvn test "-Dtest=LoadTestDataSeederTest,LoadTestDataSeederIntegrationTest,LoadTestEnvironmentGuardTest,LoadTestSchemaValidationIntegrationTest"`. The integration test seeds 144 shipments (72 service-generated plus 72 bulk-expanded) with a batch size of 7 in an isolated MySQL schema and rolls the fixture changes back. It checks pricing, all 24 copied scenario states, audit relationships, identifier allocation, print idempotency, payments, statements, and restart preservation.
- Script syntax: from the repository root, run `Get-Content -Raw load-tests/realistic-simulation.js | node --input-type=module --check` and repeat for `load-tests/heavy-simulation.js`. Both passed. These checks do not run k6 requests.
- Manual seed: use an empty dedicated load-test volume, enable seeding and set the seed password, then rebuild/start Stack B as described above. Expect the completion log, 50,000 shipments (or your configured target), 500 clients, 100 vehicles, pricing snapshots, print audits, manifest memberships, loss audit records, and saved statements/collections across three weekly cycles.
- Manual API/UI: sign in as `loadtest-admin` using the configured password. Request `GET /api/v1/shipments?page=0&size=1` and verify `page.totalElements` matches the target. Resolve a split shipment ID using the read-only database query `SELECT shipment_id FROM shipment WHERE description LIKE 'LT10-%' LIMIT 1`, then request `GET /api/v1/shipments/{shipmentId}` and verify two completed parcels, two sent on a second manifest, and one unmanifested parcel. Resolve `LT19-` and `LT21-` the same way for all-lost reconciliation and a reopened sent manifest. Shipment search accepts IDs, client/recipient names, contact numbers, and tracking IDs; resolve description codes in the database first. In collections/SOA screens, verify three cycles, packaging credits capped at the outstanding balance for client `LT-CL-0002`, and no saved statements for client `LT-CL-0007`.
- Manual restart: leave seeding enabled and restart the completed backend. Expect the seed-skipped message with unchanged shipment, print-audit, and statement counts. An outdated or interrupted dataset must fail startup instead of adding duplicate fixtures.
- Manual benchmark: run the Stack B hybrid commands below with `LOADTEST_PASSWORD` matching the seed password. Expect successful setup, HTTP 200 reads, valid courier scan contexts, and no failures caused by assumed tracking IDs. Full 50,000-shipment simulation seeding has been verified; live k6 benchmarks remain manual checks.

### Fast Initial Seeding for the Simulation Stack

Use the temporary override to seed with 4 CPUs and 2 GB per container, a 1 GB JVM heap, and a 512 MB MySQL buffer pool. It retains normal MySQL crash-durability settings and requires no production configuration changes.

```powershell
docker compose -p tnl-sim-50k -f docker-compose.sim.yml -f docker-compose.sim-seed.yml --env-file .env.loadtest up -d --build
docker compose -p tnl-sim-50k -f docker-compose.sim.yml --env-file .env.loadtest logs -f backend-sim
```

After `Load-test seed complete`, recreate the same containers without the override. This preserves the named database volume and restores the simulation limits (0.5 CPU / 512 MB each), JVM settings, and 64 MB MySQL buffer pool. Leave `LOADTEST_SEED_ENABLED=true` to verify and skip the completed seed on restart.

```powershell
docker compose -p tnl-sim-50k -f docker-compose.sim.yml --env-file .env.loadtest up -d --force-recreate
```

Run benchmarks against `http://host.docker.internal:8080`. A partial seed cannot resume. An intentional reset uses `docker compose -p tnl-sim-50k -f docker-compose.sim.yml --env-file .env.loadtest down -v`, which deletes only this simulation project's configured database volume. Do not use `-v` when restoring benchmark limits.

Measured on the local Docker simulation on 2026-10-16: the previous service-only path averaged 22.8 seconds per 250 shipments after lifting CPU limits and temporarily relaxing MySQL durability. The bulk path took roughly 0.3-0.5 seconds per 250 shipments with normal durability (`innodb_flush_log_at_trx_commit=1`, `sync_binlog=1`) and the seeding override. Expanding 72 templates to 50,000 shipments took about 70 seconds; service-backed statements then took about 3 minutes 23 seconds. These measurements include both the implementation change and the different temporary JVM/database resource settings.

The completed dataset contains 50,000 shipments, 145,827 parcels, 27,081 waybills, and 1,437 statements. Full-dataset SQL checks found zero invalid pricing snapshots, quantity mismatches, overpayments, cross-shipment manifest/print links, missing exception commands, bad reconciliation references, incorrect print fingerprints, or mismatches between current tracking states and their latest events. All 15 focused Maven tests passed, including 144-fixture comparison and print-idempotency checks.

After recreating without the seeding override, both containers were verified at 0.5 CPU / 512 MB and MySQL at its original 64 MB buffer pool with normal durability. Startup skipped the completed seed and preserved all records. Authenticated API smoke checks passed for admin login, `page.totalElements=50000`, and a bulk-expanded split shipment with five parcels and two delivered.

---

## Part 3: k6 Test Scripts (Running the Benchmarks)

Run tests using Docker. Each script can target either **Stack A (Port 8080)** or **Stack B (Port 8082)**.

### 1. `smoke.js` — Quick Connectivity & Auth Validation
*Runs 1 virtual user for 1 minute to verify authentication and core read endpoints.*

**Against Stack A (Port 8080):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8080 -e LOADTEST_USERNAME=admin -e LOADTEST_PASSWORD=admin -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/smoke.js
```

**Against Stack B (Port 8082):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8082 -e LOADTEST_PASSWORD=seedpassword -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/smoke.js
```

---

### 2. `realistic-simulation.js` — Realistic Day-in-the-Life Hybrid Simulation
Models 1 admin, 1 receiving staff member, 1 dispatch staff member, and up to 18 courier virtual users over two minutes (21 users at peak). Couriers ramp from 1 to 8 over 30 seconds, then to 18 over one minute, then to zero over 30 seconds. Admin, receiving, and dispatch each remain at one user throughout.

Admin reads Dashboard, Shipments, and Clients. Receiving reads Shipments and Vehicles. Dispatch and couriers read their own metrics/history and parcel scan context. No registration, payment, or scan mutations are performed. Each role uses its seeded account; courier virtual users still share `loadtest-field` and its device session. This is not the separate ten-minute acceptance workload and does not exercise Reports or Weekly Collections.

The admin p95 target remains 1,500 ms; each mobile role has a 500 ms p95 target, and failed requests must remain below 1%. Previous all-courier results represent a different workload.

Verification: `Get-Content -Raw load-tests/realistic-simulation.js | node --input-type=module --check`. For a live run, use the command below (set `BASE_URL` to port 8080 for the simulation stack). Expect four successful role logins, separate scenario summaries, HTTP 200 reads, and unchanged business-record counts. Login can create or refresh synthetic device bindings; incompatible existing bindings must be resolved through normal session handling. Syntax validation alone does not establish latency acceptance.

**Against Stack B (Port 8082 — Recommended):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8082 -e LOADTEST_PASSWORD=seedpassword -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/realistic-simulation.js
```

---

### 3. `baseline.js` — 25-User Heavy Read Benchmark
*Sustained concurrent query benchmark scaling from 1 to 25 virtual users across 8 minutes, reading paginated shipments, clients, vehicles, and global audit logs.*

**Against Stack B (Port 8082):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8082 -e LOADTEST_PASSWORD=seedpassword -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/baseline.js
```

---

### 4. `heavy-simulation.js` — High-Concurrency Stress Simulation
*Models 37 concurrent users (2 Web Admins + 35 Mobile Couriers) with randomized parcel lookups sampled from current tracking logs and multi-page audit logs over 3 minutes.*

**Against Stack A (Port 8080):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8080 -e LOADTEST_PASSWORD=seedpassword -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/heavy-simulation.js
```

**Against Stack B (Port 8082):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8082 -e LOADTEST_PASSWORD=seedpassword -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/heavy-simulation.js
```

## 50,000-Shipment Endpoint Diagnostics

The user-requested role redistribution changes `realistic-simulation.js` from twenty courier VUs to eighteen courier VUs plus receiving and dispatch; do not compare it as an identical workload to earlier evidence. `endpoint-diagnostics.js` reuses its setup, authenticating all four role accounts, and performs sequential reads tagged by endpoint, with one discarded warm-up pass and configurable samples. Summaries allow-list metrics and execution state, excluding credentials and setup tokens. The runner reads the existing seed password from `.env.loadtest` and passes it through the process environment. Do not use k6 HTTP debugging or export setup data.

```powershell
./load-tests/run-measurement.ps1 -Label before -Samples 3
./load-tests/run-measurement.ps1 -Label courier -Samples 3
./load-tests/run-measurement.ps1 -Label after -Samples 3
# Optional: isolate one endpoint with -Endpoint history or -Endpoint metrics.
./load-tests/capture-financial-results.ps1 -Label before
./load-tests/capture-financial-results.ps1 -Label after
./load-tests/run-measurement.ps1 -Mode simulation -Label simulation-1
./load-tests/run-measurement.ps1 -Mode simulation -Label simulation-2
./load-tests/run-measurement.ps1 -Mode simulation -Label simulation-3
```

Run `monitor-resources.ps1 -Label simulation-1` concurrently in a second terminal, repeating the label for each run. It saves CPU/memory samples and counts connection acquisition timeouts. Retain k6 console logs for completed/interrupted iteration counts. Endpoint diagnostic thresholds are diagnostic flags; acceptance remains the unchanged workload thresholds: failure rate below 1%, admin p95 below 1.5 seconds, courier p95 below 500 milliseconds. Run one diagnostic warm-up before each measured simulation. Never run benchmark requests concurrently with tests or SQL timing probes against the simulation database. Maven integration tests use the separate `tnl_test` schema.

`query-diagnostics.sql` records live MySQL plans, row counts, and index sizes. Execute twice on an idle simulation and compare the second run. `scan-write-diagnostics.sql` inserts 100 copies of event rows within a rolled-back transaction. It preserves event counts but leaves auto-increment gaps; use only in the dedicated simulation. Compare repeated samples separately from load runs. This measures synthetic database inserts, not complete scanner workflows or concurrent write capacity.

After rebuilding only the backend with the existing Compose configuration, wait for application startup and the completed-seed skip message before making requests. Do not delete volumes or use the seeding resource override. Verify 50,000 shipments, 645,790 tracking events, five Hikari connections, 0.5 CPU / 512 MB per container, and the existing 64 MB MySQL buffer pool.

### What to Test

- Automated: from `backend/`, run `mvn -o test "-Dtest=PersonalTrackingHistoryIntegrationTest,TrackingLogIntegrationTest,DashboardIntegrationTest,CollectionsIntegrationTest,CollectionsAggregationIntegrationTest,ShipmentIntegrationTest,ClientIntegrationTest,FourRoleAuthorizationIntegrationTest,AdminConsoleAuthorizationIntegrationTest,TrackingConcurrencyIntegrationTest"`. The new financial fixture covers multiple/late payments, partial/full settlement, deductions, client-level balance clamping, historical statement exclusion, SOA-only clients, and empty cycles. Existing expectations are unchanged.
- Courier API: mobile-login as the configured courier with its device headers; request `/api/v1/tracking-events/mine?page=0&size=20`, adjacent pages, `status=LOADED_ON_TRUCK`, `status=REGISTERED`, and a lowercase substring of a discovered tracking or shipment ID with and without a status. Expect HTTP 200, exact totals, timestamp/ID descending order, and only the caller's events. A page beyond the end must retain the exact total with empty content.
- Authorization: repeat personal reads without credentials (401) and as admin/receiving staff (403); request `/mine/metrics` with a valid live mobile device session and verify only today's caller events contribute.
- Financial API: as admin, compare all responses from `/collections/cycles`, `/collections/weekly?targetDate=DATE`, and `/dashboard/summary?cycle=DATE` before/after, sorting collection items by client ID. Expect identical monetary values, counts, eligibility, status, and response fields. Dashboard calculations with separate eligibility remain unchanged.
- Database: shipment/event/payment/statement counts must remain unchanged after deployment and timing probes. Inserts in the write probe roll back; no financial or lifecycle data is reset.

### Optimization Verification Results (2026-10-16)

See [optimization-results.md](optimization-results.md) for complete before/after measurements and the unsuccessful-attempt ledger. All 98 affected backend tests passed; the final search revision separately passed all 20 history tests. Three seeded-cycle collections/dashboard snapshots matched exactly.

All three unchanged simulations recorded 357 requests, 0% failures, 118 completed iterations, zero interrupted iterations, and no connection-pool timeouts. Admin p95 was 25.87/22.54/24.41 seconds and courier p95 was 18.72/18.50/18.02 seconds, failing the original 1.5-second/500-ms targets. MySQL saturated its 0.5 CPU allocation; sampled memory stayed below 418 MiB. The dataset and limits remain unchanged. No further optimization or tests followed the final verification request.

Saved simulation summaries are sanitized after k6 exits because its built-in export includes setup data. The runner retains only metrics and aggregate check groups. All three delivered local summaries exclude setup tokens and credentials.

### Dashboard aggregate slice (2026-10-17)

This slice replaces Dashboard's separate status/lost reads with a loss/status aggregate, and its three cycle financial reads with one shipment-level payment aggregate. Reports retains its existing parcel calculations. Collections retains its indexed scalar payment lookup, statement eligibility, deductions, SOA-only rows, and per-client clamping. Public response fields and authorization remain unchanged.

The current simulation uses 1 CPU / 1 GiB per container, five Hikari connections, and the existing 256 MiB MySQL buffer pool. The 0.5 CPU / 512 MB and 64 MiB instructions above describe the historical verification environment. Do not change limits, timezone, timeouts, indexes, or seeded data for this slice. Do not run k6 or browse the application during isolated measurements.

From `backend/`, run:

```powershell
mvn -o test "-Dtest=DashboardIntegrationTest,CollectionsIntegrationTest,CollectionsAggregationIntegrationTest,ReportIntegrationTest,FourRoleAuthorizationIntegrationTest,AdminConsoleAuthorizationIntegrationTest"
```

The Dashboard regressions compare every response field with the existing repository calculations, then assert financial states, multiple/late payments, lost/completed handling, optional segments, ordering/colors, deductions, SOA-only clients, global versus per-client clamping, empty cycles, and boundary compatibility. Existing assertions remain intact. Connector/J can round the nanosecond end-of-day parameter to the next midnight; this slice preserves that behavior.

Manual What to Test:

1. Sign in as the seeded admin using normal authentication. Request `/api/v1/dashboard/summary?cycle=2026-10-08`, then `2026-10-15` and `2026-10-22`. Compare every field with the saved baseline, including aliases, collection cards, financial comparisons, daily volume, recent activity, and status segment order/colors.
2. Check a lost completed parcel: it contributes to Lost, not Completed. Recovering it moves it to Completed. Lost and Completed disappear when their counts are zero; the five ordinary status segments remain with zero values where applicable. Use transactional test fixtures for mutations, not the preserved 50,000-shipment dataset.
3. Verify unpaid, partial, fully paid, zero-charge, multiple-payment, late-payment, and overpaid shipments. Count each shipment and its parcel quantity once. Include all payments belonging to cycle-registered shipments. Clamp the Dashboard financial comparison after summing cycle charges/payments.
4. Compare `/api/v1/collections/weekly?targetDate=DATE` with the Dashboard collection card. Check deductions, historical statement exclusion, SOA-only clients, and per-client clamping independently from the Dashboard financial comparison.
5. Request an empty cycle, such as `2036-03-07`. Expect zero cycle counts/financial comparisons, seven zero volume points, five zero status segments, and omitted Lost/Completed segments. Today's counts and global recent activity remain independent of that cycle.
6. Check unauthenticated access (401), admin access (200), and receiving/courier/dispatch access (403). Verify cycle-start/end compatibility against the existing queries, including the existing JDBC precision behavior.
7. After the backend-only rebuild, confirm completed-seed skipping and unchanged counts: 50,000 shipments, 145,827 parcels, 645,790 tracking events, 36,807 payments, and 1,437 statements. Expect no business-record writes from diagnostic requests or SQL probes.

Use one discarded Dashboard warm-up and three sequential requests with a 15-second deadline. Record bytes, status, resource samples, query plans, and heap/pool errors. The local ignored `results/dashboard-slice-*` artifacts contain SQL equivalence, complete response snapshots, source manifests, and diagnostic evidence without authentication tokens. The original image's exact source identity and Mem Reduct's automatic-cleaning setting are unresolved; previous API timings remain provisional. Isolated measurements do not establish p95 capacity or concurrent performance acceptance.

Completed verification: all 51 requested tests passed, the backend-only build succeeded, and the deployed Dashboard responses matched all three seeded cycles and an empty cycle. All business counts above remained unchanged. After one discarded warm-up, active Dashboard samples were 653.85 / 677.58 / 653.18 ms, HTTP 200 and 2,031 bytes each. No heap/pool errors were recorded after successful startup. An external MySQL stop interrupted the first startup; the user approved restarting the same container, so cache warmth differs between captures. This is implementation and isolated verification completion; performance acceptance remains pending. See [optimization-results.md](optimization-results.md#dashboard-aggregate-slice-2026-10-17) for the full evidence and remediation log.

### Admin Tracking Logs search proposal (2026-10-17)

The approved IN-based admin search implementation and isolated verification are complete. [optimization-results.md](optimization-results.md#admin-tracking-logs-substring-investigation-2026-10-17) records exact-set/order/500-row evidence, rejected UNION candidates, query timings, regression/deployment/API results, and the remaining selective-search latency limit.

The universal UNION candidate regressed broad searches because of large event-ID materialization. The proposed smaller `IN` predicate over materialized entity IDs improved the measured selective, broad, no-match, combined-filter, and wildcard cases without changing search/escape semantics. It still scans many events for selective searches, so the 1.5-second p95 target remains unmet by the available evidence. No application/test source, running image, configuration, or dataset changed during this investigation. Mem Reduct was absent but its automatic-cleaning preference could not be confirmed. No k6 workload ran.

Executed regression command from `backend/`:

```powershell
mvn -o test "-Dtest=TrackingLogIntegrationTest,PersonalTrackingHistoryIntegrationTest,FourRoleAuthorizationIntegrationTest,AdminConsoleAuthorizationIntegrationTest"
```

All 59 tests passed with zero failures/errors/skips. Five new focused regressions compare exact IDs with the original predicate and cover escapes, overlap, nullable relationships, filters, tied ordering, adjacent/beyond-last pages, and 500-row CSV. The first compile attempt used an incorrect fixture password getter; correcting that call required no assertion or production change.

Only the backend was rebuilt/recreated. Startup skipped seeding; MySQL's container/start time and all business counts stayed unchanged. One discarded warm-up and three sequential after samples per case all returned HTTP 200 and matched baseline IDs, totals, pagination metadata, and byte sizes. Selective tracking search remains unmet at 1947.58 / 1936.28 / 2008.11 ms versus the 1.5-second target. Broad staff search took 290-297 ms, no-match 408-416 ms, combined filters 267-300 ms, and 500-row CSV 287-297 ms. No heap/pool errors appeared during the API window. Both deployments are identified by image/JAR/source hashes; the original older unresolved-image timings remain provisional. Mem Reduct's automatic-cleaning preference remains unconfirmed.

Implementation, regression verification, backend-only deployment, and isolated API verification are complete. Final performance acceptance remains pending; three samples do not establish p95 capacity or reliability. Work stopped after this search slice. No further optimization or k6 run followed.

### Reports parcel aggregation proposal (2026-10-17)

The investigation, approved implementation, regression tests, backend-only deployment, and isolated API verification are complete. [optimization-results.md](optimization-results.md#reports-parcel-aggregation-investigation-2026-10-17) records per-day/status parity, SQL timings, regression results, before/after API responses, and limitations. The grouped query matched the 17-day default month, 11-day seeded range, and focused empty/lost-COMPLETED/cycle/rounded-boundary fixtures. SQL root times were 530-547 ms versus 914-953 ms for the prior four statements.

Both identified before and after deployments returned HTTP 200 in all recorded Reports calls. The default month changed from 2.02-2.24 s to 1.70-1.78 s; the seeded range from 2.00-2.11 s to 1.69-1.77 s. Every response field except `generatedAt` matched the baseline, and serialized byte sizes were identical. Business counts and runtime limits remain unchanged. Mem Reduct saved configuration has `AutoreductEnable=true` and `AutoreductIntervalEnable=false`, while its process was absent during measurements. The saved automatic-reduction flag must not be described as disabled.

Targeted command from `backend/`: `mvn -o test "-Dtest=ReportIntegrationTest,DashboardIntegrationTest"`. Result: 29 passed, zero failures/errors/skips, including a new multi-day lost-COMPLETED/decimal/date-reversal regression. Backend-only startup skipped seeding; the MySQL container was not restarted. After one discarded warm-up and three measured calls per period, no isolated Reports request exceeded five seconds. Formal p95/concurrency/failure-rate acceptance remains separate. Work stopped after isolated verification without k6 or further optimization.
