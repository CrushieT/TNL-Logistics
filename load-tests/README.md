# Load Tests

The scripts target the isolated `loadtest` profile only. They require the synthetic `loadtest-admin` account and the password configured in `LOADTEST_SEED_PASSWORD`.

## Seed an empty local database

Set `LOADTEST_SEED_ENABLED=true` in `.env.loadtest`, start the Compose stack, and wait for `Load-test seed complete` in the backend logs. Set it back to `false` before ordinary restarts. The seeder refuses partially-seeded databases with an error, skips execution if the target dataset is already present, and rejects any database other than `tnl_loadtest`.

## Run k6 in Docker

Run the smoke test first:

```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8082 -e LOADTEST_PASSWORD=$env:LOADTEST_SEED_PASSWORD -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/smoke.js
```

Then run the 25-user baseline:

```powershell
docker run --rm -e BASE_URL=http://host.docker.internal:8082 -e LOADTEST_PASSWORD=$env:LOADTEST_SEED_PASSWORD -v "${PWD}/load-tests:/scripts" grafana/k6 run /scripts/baseline.js
```

The baseline covers authenticated dashboard, shipment, client, vehicle, and tracking-log reads. Add write and SSE scenarios only after recording this baseline, so their impact is measurable.
