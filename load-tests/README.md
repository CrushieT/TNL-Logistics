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
*Models 1 Web Admin browsing the dashboard/shipments alongside up to 20 Mobile Couriers concurrently requesting shift metrics, scan history, and parcel scan contexts (~1,450 operations in 2 minutes).*

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
