# Operations Database Upgrade & Migration Guide

This guide describes operational database procedures for the TNL Logistics platform across fresh deployments, current development databases, and legacy main conversions.

---

## 1. Architectural Principles

1. **Immutable Migrations:** Applied migrations `V1` through `V20` are strictly immutable. They are never edited or replaced retroactively.
2. **Standard Forward Upgrades:** Ongoing changes are introduced strictly through forward-only Flyway migrations (starting with `V21`).
3. **No Flyway Repair as Upgrade:** `flyway:repair` is prohibited as an upgrade path for incompatible schemas.
4. **Offline Conversion with Archival Isolation:** Legacy main databases (single-version prototype schema) are upgraded exclusively via a dedicated offline command that:
   - Archives raw legacy tables and legacy Flyway history into an immutable `legacy_*` namespace;
   - Executes the canonical `V1..V21` migration sequence on the operational namespace;
   - Populates lossless reconciliation records in `legacy_reconciliation_record` without inventing required logistics data.

---

## 2. Procedure 1: Fresh Installation (New Environment)

For new environments (CI pipelines, new developer workstations, clean production instances):

1. **Create Database:**
   ```sql
   CREATE DATABASE tnl_logistics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **Configure Environment:**
   Set standard database connection properties in `.env` or system environment variables:
   ```env
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_DATABASE=tnl_logistics
   MYSQL_USER=tnl_user
   MYSQL_PASSWORD=your_secure_password
   ```

3. **Start Application:**
   Run the application normally:
   ```bash
   mvn spring-boot:run -Dspring.profiles.active=prod
   ```
   Flyway automatically applies all migrations from `V1` through `V21`. All core operational tables and indexes are initialized cleanly.

---

## 3. Procedure 2: Upgrading an Existing Development Database (V1..V20)

For installations already running on the current development schema (at migration version 20):

1. **Pre-upgrade Backup (Recommended):**
   ```bash
   mysqldump -u root -p tnl_dev > backup_dev_v20.sql
   ```

2. **Run Standard Application Startup:**
   ```bash
   mvn spring-boot:run
   ```
   Flyway detects new migration `V21__create_legacy_reconciliation_schema.sql` and applies it automatically. No manual intervention or repair is required.

3. **Verify:**
   Check application logs for:
   ```text
   Current version of schema `tnl_dev`: 21
   ```

---

## 4. Procedure 3: Converting a Legacy Main Database (Offline Command)

Use this procedure to upgrade an installation that was initialized from the legacy `main` branch (containing prototype tables: `clients`, `shipments`, `parcel_units`, `qr_codes`, `tracking_events`, `statements_of_account`, `charges`, `payments`, `weekly_collections`).

### Step A: Mandatory Database Backup

Before initiating the upgrade, generate a full logical dump:
```bash
mysqldump -u root -p --single-transaction --routines --triggers tnl_legacy > tnl_legacy_backup_$(date +%Y%m%d_%H%M%S).sql
```
Verify the dump file is non-empty and accessible.

### Step B: Preflight Verification

The upgrade utility automatically verifies:
- Exactly 1 migration (`V1`) exists in `flyway_schema_history`;
- The `V1` checksum matches the canonical legacy main checksum;
- All 9 legacy prototype tables exist;
- No modern operational tables exist (refusing mixed schemas).

### Step C: Execute Offline Upgrade Command

Run the Spring Boot application with explicit migration flags:
```bash
mvn spring-boot:run -Dspring-boot.run.arguments="--app.migration.legacy-upgrade=true --backup-confirmed=true --backup-id=BKP-2026-09-14-PROD"
```

Expected execution log:
```text
================================================================
  OFFLINE LEGACY DATABASE UPGRADE UTILITY ACTIVATED
================================================================
Starting legacy database upgrade. Manifest: UPG-1773417600000, Backup reference: BKP-2026-09-14-PROD
Archiving table clients -> legacy_clients
Archiving table shipments -> legacy_shipments
Archiving table parcel_units -> legacy_parcel_units
Archiving table qr_codes -> legacy_qr_codes
Archiving table tracking_events -> legacy_tracking_events
Archiving table statements_of_account -> legacy_statements_of_account
Archiving table charges -> legacy_charges
Archiving table payments -> legacy_payments
Archiving table weekly_collections -> legacy_weekly_collections
Archiving flyway_schema_history -> legacy_flyway_schema_history
Executing canonical Flyway migration chain (V1..V21)...
Populated 12 reconciliation entries from legacy_clients
Populated 45 reconciliation entries from legacy_shipments
...
UPGRADE SUMMARY REPORT:
  Manifest ID: UPG-1773417600000
  Backup Reference: BKP-2026-09-14-PROD
  Status: SUCCESS
  Archived Reconciliation Counts:
    - clients: 12 rows queued for staff review
    - shipments: 45 rows queued for staff review
  Message: Legacy database successfully upgraded to canonical schema.
================================================================
```

### Step D: Resuming an Interrupted Upgrade

If the upgrade process is interrupted (e.g. process terminated after table archiving):
- The utility detects the `TABLES_ARCHIVED` state from existing `legacy_*` tables and the `legacy_upgrade_manifest`;
- Re-running the command resumes from the canonical migration and reconciliation step without re-attempting table renames.

### Step E: Post-Upgrade Validation

1. **Verify Operational Schema:**
   Inspect MySQL tables:
   ```sql
   SHOW TABLES;
   ```
   Operational tables (`client`, `shipment`, `parcel_unit`, `tracking_event`, `print_event`, `payment`, `app_user`, `vehicle`, `waybill`, `statement_of_account`) must be present.
2. **Verify Flyway Status:**
   ```sql
   SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;
   ```
   Versions 1 through 21 must show `success = 1`.
3. **Verify Reconciliation Queue:**
   ```sql
   SELECT source_table, count(*) FROM legacy_reconciliation_record GROUP BY source_table;
   ```

### Step F: Staff Reconciliation Process

Legacy records are stored losslessly in `legacy_reconciliation_record` with `status = 'PENDING_REVIEW'`. Operational staff must review each record before creating corresponding operational records to ensure no required fields (such as physical address, contact number, charge model, or route) are populated with synthetic or invalid placeholders.

---

## 5. Procedure 5: Emergency Rollback (Restore-by-Backup)

If unexpected anomalies occur during an upgrade:

1. **Stop Application:**
   Terminate any running backend services.

2. **Drop Operational Database:**
   ```sql
   DROP DATABASE tnl_legacy;
   CREATE DATABASE tnl_legacy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **Restore Logical Backup:**
   ```bash
   mysql -u root -p tnl_legacy < tnl_legacy_backup_YYYYMMDD_HHMMSS.sql
   ```

4. **Verify Restored State:**
   Confirm all legacy tables and `flyway_schema_history` are restored to their original pre-upgrade condition.
