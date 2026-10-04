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
> **Profile:** Dedicated loadtest profile connected to the 10,000-shipment synthetic dataset via `.env.loadtest`.

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
2. Start Stack B and wait for `Load-test seed complete: 10000 shipments, 500 clients, 100 vehicles` in the logs.
3. In `.env.loadtest`, set `LOADTEST_SEED_ENABLED=false` to prevent duplicate seeding checks.

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
*Models 37 concurrent users (2 Web Admins + 35 Mobile Couriers) with randomized parcel lookups across 10,000 shipments and multi-page audit logs over 3 minutes.*

**Against Stack A (Port 8080):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8080 -e LOADTEST_PASSWORD=seedpassword -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/heavy-simulation.js
```

**Against Stack B (Port 8082):**
```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8082 -e LOADTEST_PASSWORD=seedpassword -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/heavy-simulation.js
```
