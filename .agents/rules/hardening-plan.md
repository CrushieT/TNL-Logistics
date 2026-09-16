# System Hardening & Lifecycle Remediation Plan

## Purpose

Address the architectural, state machine, and data-integrity findings surfaced during full-codebase review against the initial project baseline. This plan breaks the findings into structured, deliverable slices so each change can be implemented, verified with focused automated tests, and audited independently without holding up preceding milestone deliveries.

---

## Review Baseline & Classification

- **Review Target:** Full repository diff against initial commit `a50a7d8`.
- **Pre-requisite Status:** Current branch `fullstack/bugfix/dev-review-remediation` has completed all 7 core remediation items from `review-plan.md` (151 backend integration tests passing, Expo SDK 57 upgrade complete).
- **Out of Scope (Closed as Invalid):**
  - *Finding 1 (Do not replace applied V1 migration):* Rejected. Changing `V1` on the development branch would break every existing database running `V1..V25`. Historical migration compatibility is instead governed by Section 1 below (offline legacy conversion runner).

---

## 1. Defer Boot Flyway for Legacy-Upgrade Mode [SKIPPED]

**Status:** SKIPPED (By direction: legacy upgrade deferral not required)
**Priority:** P1 (Operational Blocker for Legacy Conversions)

**Problem:**
Spring Boot's `FlywayAutoConfiguration` executes on application context startup before any `CommandLineRunner` is invoked. When an operator runs the legacy database upgrade CLI (`--app.migration.legacy-upgrade=true` or `--legacy-upgrade`) against a database containing `main`'s prototype V1 schema, Spring Boot's automatic Flyway migration runs first, detects a V1 checksum mismatch against the canonical V1, and throws `FlywayValidateException`, crashing the JVM before `LegacyUpgradeRunner` can execute.

**Implementation:**
1. Introduce a custom `FlywayMigrationStrategy` bean in `backend/src/main/java/com/tnl/logistics/config/DatabaseConfig.java` or `FlywayConfig.java`.
2. In the strategy, check whether legacy upgrade mode is active by inspecting environment properties and command-line arguments (`app.migration.legacy-upgrade=true` or `--legacy-upgrade`).
3. If legacy upgrade mode is active, skip standard startup migration:
   ```java
   @Bean
   public FlywayMigrationStrategy flywayMigrationStrategy(Environment env) {
       return flyway -> {
           boolean isLegacyUpgrade = Boolean.parseBoolean(env.getProperty("app.migration.legacy-upgrade", "false"));
           if (isLegacyUpgrade) {
               log.info("Deferring auto-Flyway migration: Offline legacy upgrade mode detected.");
               return;
           }
           flyway.migrate();
       };
   }
   ```
4. Let `LegacyUpgradeRunner` and `LegacyDatabaseUpgradeService` execute their isolated, verified migration sequence as designed.
5. Add an automated test in `LegacyDatabaseUpgradeIntegrationTest` verifying the application context starts cleanly when `--app.migration.legacy-upgrade=true` is supplied against a prototype V1 database.

**Acceptance Criteria:**
Running `mvn spring-boot:run -Dspring-boot.run.arguments="--app.migration.legacy-upgrade=true --backup-confirmed=true --backup-id=BKP-001"` against a legacy database executes `LegacyUpgradeRunner` without encountering startup `FlywayValidateException`.

---

## 2. Enforce Strict Waybill State Transitions [COMPLETED]

**Status:** COMPLETED
**Priority:** P2 (State Machine Integrity)

**Problem:**
In `WaybillServiceImpl.java`:
- `sendWaybillToHauler` did not verify that the waybill is currently in `GENERATED` status. A caller could re-dispatch an already signed/completed waybill, overwriting its status back to `SENT_TO_HAULER`.
- `markSignedCompleted` did not verify that the waybill is currently in `SENT_TO_HAULER` status. A caller could directly mark a `GENERATED` waybill as completed, bypassing physical hauler dispatch.

**Implementation:**
1. In `WaybillServiceImpl.sendWaybillToHauler`:
   - Assert `waybill == null || waybill.getStatus() == WaybillStatus.GENERATED`.
   - Throw `IllegalStateException("Cannot dispatch waybill in status " + waybill.getStatus() + ". Expected GENERATED.")` if invalid.
2. In `WaybillServiceImpl.markSignedCompleted`:
   - Assert `waybill.getStatus() == WaybillStatus.SENT_TO_HAULER`.
   - Throw `IllegalStateException("Cannot complete waybill in status " + waybill.getStatus() + ". Expected SENT_TO_HAULER.")` if invalid.
3. Add regression tests in `WaybillIntegrationTest.java`:
   - Dispatching a `SIGNED_COMPLETED` or `SENT_TO_HAULER` waybill returns HTTP 400.
   - Signing a `GENERATED` waybill without prior dispatch returns HTTP 400.
   - Normal flow (`GENERATED -> SENT_TO_HAULER -> SIGNED_COMPLETED`) succeeds.

**Acceptance Criteria:**
Waybill state transitions strictly adhere to `GENERATED -> SENT_TO_HAULER -> SIGNED_COMPLETED`. Backward mutations and skipped steps are rejected.

---

## 3. Enforce Parcel Loaded-to-Hauler Requirement for Waybill POD Completion [COMPLETED]

**Status:** COMPLETED
**Priority:** P1 (Lifecycle State Machine Integrity)

**Problem:**
Completing a waybill signs the Proof of Delivery (POD) acknowledging receipt by the consignee. However:
- If parcels were only in `REGISTERED`, `QR_GENERATED`, `LOADED_ON_TRUCK`, or `ARRIVED_AT_TNL` status, allowing POD completion bypassed intermediate physical custody scans.
- Conversely, removing parcel status updates entirely on POD signing left delivered parcels indefinitely stranded in `LOADED_TO_HAULER` status with the shipment rollup never reaching `Completed`.

**Implementation:**
1. In `WaybillServiceImpl.markSignedCompleted`:
   - Enforce prerequisite: All parcels under the shipment must be in `ParcelStatus.LOADED_TO_HAULER` status prior to signing POD.
   - If any parcel is not `LOADED_TO_HAULER` (or if parcels list is empty), reject completion with `IllegalStateException("Cannot complete waybill: All shipment parcels must be in LOADED_TO_HAULER status before signing proof of delivery.")` (HTTP 400 Bad Request).
   - Upon valid POD signing (`SIGNED_COMPLETED`), advance all parcel units to `ParcelStatus.COMPLETED`, clear `currentVehicle` (`null`), persist an audit `TrackingEvent` (`COMPLETED`), and broadcast SSE tracking scan notifications.
   - As a consequence of all parcels reaching `COMPLETED`, the shipment's dynamic rollup status transitions to `Completed`.
2. Update `WaybillIntegrationTest.java`:
   - Verify completion is rejected when parcels are `REGISTERED` or partially ready.
   - Verify completion succeeds when all parcels are `LOADED_TO_HAULER`, correctly transitioning parcels and shipment rollup to `Completed`.
3. In `frontend-web/src/app/waybills/index.js`:
   - Surface server error message in UI feedback banner if completion is attempted before parcels are loaded to hauler.

**Acceptance Criteria:**
Waybill signing strictly requires all parcels to be in `LOADED_TO_HAULER`, and upon successful signing, transitions parcels and shipment to `Completed` with full audit events.

---

## 4. Validate Shipment Parcel Count and Sequence [COMPLETED]

**Status:** COMPLETED
**Priority:** P2 (Billing & Data Integrity)

**Problem:**
In `ShipmentServiceImpl.registerShipment` (lines 84–90), `PER_PARCEL` pricing calculates the total fee using `request.getQuantity()`, while sequential tracking IDs and database rows are generated by iterating over `request.getParcels()`. If a client submits `quantity = 1` with a list of 5 parcel objects, the shipment is underbilled for 1 parcel while persisting 5 distinct parcel units and consuming 5 tracking IDs.

**Implementation:**
1. In `ShipmentServiceImpl.registerShipment`:
   - Validate that `request.getParcels() != null && !request.getParcels().isEmpty()`.
   - Validate that `request.getQuantity() != null && request.getQuantity().equals(request.getParcels().size())`.
   - If mismatched, throw `IllegalArgumentException("Shipment quantity (" + request.getQuantity() + ") must match parcel items count (" + request.getParcels().size() + ").")`.
2. Validate sequence numbers:
   - Ensure parcel `seq` values match `1` through `N` with zero duplicates and zero gaps.
3. Add regression tests in `ShipmentIntegrationTest.java`:
   - Registration with mismatched quantity and parcel count returns HTTP 400 Bad Request.
   - Registration with non-sequential or duplicate `seq` numbers returns HTTP 400 Bad Request.

**Acceptance Criteria:**
Every registered shipment has an identical `quantity` and parcel count, preventing financial calculation mismatches and orphaned tracking records.

---

## 5. Persist `QR_GENERATED` upon Registration [COMPLETED]

**Status:** COMPLETED
**Priority:** P2 (Lifecycle State Synchronization)

**Problem:**
In `ShipmentServiceImpl.java` (lines 147–165), newly created parcel units are saved with `currentStatus = ParcelStatus.REGISTERED`. Immediately following, a `TrackingEvent(QR_GENERATED)` audit log is created, but `unit.setCurrentStatus(ParcelStatus.QR_GENERATED)` is never persisted. Consequently, parcels remain in `REGISTERED` status in database records and rollups, forcing `TrackingServiceImpl.validateStateTransition` to permit an awkward skip from `REGISTERED -> LOADED_ON_TRUCK`.

**Implementation:**
1. In `ShipmentServiceImpl.registerShipment`:
   - Update `unit.setCurrentStatus(ParcelStatus.QR_GENERATED)` before persisting the unit, or update and save it upon creating the vector QR event.
2. In `TrackingServiceImpl.validateStateTransition`:
   - Tighten the transition from `REGISTERED`:
     - From `REGISTERED`: only `QR_GENERATED` is valid.
     - From `QR_GENERATED`: only `LOADED_ON_TRUCK` is valid.
   - Remove the permissive direct skip from `REGISTERED -> LOADED_ON_TRUCK`.
3. Update tracking integration tests in `TrackingAndVehicleIntegrationTest.java` to verify `QR_GENERATED` is the initial active state of registered parcels.

**Acceptance Criteria:**
Newly registered parcel units show `QR_GENERATED` as their active state in database rows and API responses, matching the initial tracking event log.

---

## 6. Constrain Selected Package IDs in Label Printing [COMPLETED]

**Status:** COMPLETED
**Priority:** P2 (Access Control & Multi-Tenant Integrity)

**Problem:**
In `ShipmentServiceImpl.recordLabelPrint` (lines 491–495):
```java
if (packageIds == null || packageIds.isEmpty()) {
    parcels = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shipmentId);
} else {
    parcels = parcelUnitRepository.findAllById(packageIds);
}
```
When `packageIds` is non-empty, `findAllById` loads parcel units without verifying that they belong to the requested `shipmentId`. An authenticated user could submit tracking IDs belonging to an unrelated shipment under `POST /api/v1/shipments/{shipmentId}/labels/print`, mutating label statuses and generating print audit events across shipment boundaries.

**Implementation:**
1. In `ParcelUnitRepository.java`, add:
   ```java
   List<ParcelUnit> findByShipment_ShipmentIdAndTrackingIdIn(String shipmentId, Collection<String> trackingIds);
   ```
2. In `ShipmentServiceImpl.recordLabelPrint`:
   - When `packageIds` is non-empty, load parcels using `findByShipment_ShipmentIdAndTrackingIdIn(shipmentId, packageIds)`.
   - Check that `parcels.size() == packageIds.size()`. If any tracking ID does not belong to `shipmentId`, throw `IllegalArgumentException("One or more tracking IDs do not belong to shipment: " + shipmentId)`.
3. Add a test in `ParcelPrintIntegrationTest.java` asserting that attempting to print tracking IDs belonging to another shipment returns HTTP 400 Bad Request.

**Acceptance Criteria:**
Label print recording is strictly scoped to the specified shipment, rejecting foreign or invalid tracking IDs.

---

## 7. Concurrency Control for Parcel Status Scans [COMPLETED]

**Status:** COMPLETED
**Priority:** P2 (Race Condition Prevention)

**Problem:**
In `TrackingServiceImpl.processStatusScan`, parcel state is retrieved via standard `findById(trackingId)`. If two operators (or an automated scanner and a web client) submit concurrent scans for the same parcel, both transactions can read the same initial state before either writes, pass state transition validation simultaneously, and append duplicate `TrackingEvent` records to the audit log.

**Implementation:**
1. In `ParcelUnitRepository.java`, add a pessimistic write lock query:
   ```java
   @Lock(LockModeType.PESSIMISTIC_WRITE)
   @Query("SELECT p FROM ParcelUnit p WHERE p.trackingId = :trackingId")
   Optional<ParcelUnit> findByIdWithPessimisticLock(@Param("trackingId") String trackingId);
   ```
2. In `TrackingServiceImpl.processStatusScan`, acquire the lock before validating `currentStatus`:
   ```java
   ParcelUnit parcel = parcelUnitRepository.findByIdWithPessimisticLock(request.getTrackingId())
           .orElseThrow(() -> new IllegalArgumentException("Parcel unit not found: " + request.getTrackingId()));
   ```
3. The first transaction commits the new status; the second transaction acquires the lock, observes that `currentStatus == targetStatus`, and takes the idempotent success path without appending a duplicate scan event.
4. Add a concurrent test in `TrackingAndVehicleIntegrationTest.java` using `CompletableFuture` to fire two parallel scans for the same parcel and assert exactly one tracking event is appended.

**Acceptance Criteria:**
Concurrent status scans for the same parcel are serialized cleanly, guaranteeing idempotent responses and zero duplicate audit events.

---

## 8. Record Label Prints on Actual Print Invocation [COMPLETED]

**Status:** COMPLETED
**Priority:** P2 (Frontend Accuracy & Audit Trail)

**Problem:**
In `frontend-web/src/app/shipments/[shipmentId]/index.js` (lines 69–77), clicking "Print All" immediately calls `await printLabels(shipmentId)` before opening the modal dialog. If the operator inspects the preview and cancels without printing, the labels have already been marked `PRINTED` in the database. Conversely, printing individual parcels from inside modal dialogs calls `window.print()` directly without invoking the print recording endpoint.

**Implementation:**
1. In `frontend-web/src/app/shipments/[shipmentId]/index.js`:
   - Separate modal visibility from print recording. Clicking "Print All Labels" should only open the preview modal.
   - When the user clicks the actual "Print" button inside the modal dialog (triggering the browser print dialog), invoke `printLabels(shipmentId)`.
2. In single-unit reprint actions:
   - Wire the unit reprint action to call `recordLabelPrint(shipmentId, [trackingId])` upon print execution.
3. Verify with manual test and run Expo web export.

**Acceptance Criteria:**
Label status and reprint counters only increment when printing is physically initiated by the operator, keeping audit logs truthful.

---

## 9. Align Payment Methods with the Database Enum [COMPLETED]

**Status:** COMPLETED
**Priority:** P1 (Data Integrity & Synchronized Schema)

**Problem:**
In `PaymentMethod.java` (lines 13–14), the enum defines `CHEQUE` and `OTHER` alongside `CASH`, `BANK`, and `GCASH`. Selecting `CHEQUE` or `OTHER` in the payment interface serializes one of these values, but in MySQL, the `payment.method` column was established in `V1__init_schema.sql` as `ENUM('CASH','BANK','GCASH') NOT NULL` and no later migration expands it. MySQL will reject those payment records with a data-truncation error (`Data truncated for column 'method'`), violating the core architectural invariant of a synchronized database schema (`AGENTS.md`).

**Implementation:**
1. Create forward Flyway migration `V26__expand_payment_methods.sql`:
   ```sql
   ALTER TABLE payment
       MODIFY COLUMN method ENUM('CASH', 'BANK', 'GCASH', 'CHEQUE', 'OTHER') NOT NULL;
   ```
2. Verify that `PaymentMethod.java` string deserialization and database mapping cleanly persist and retrieve `"CHEQUE"` and `"OTHER"`.
3. Add regression tests in `PaymentIntegrationTest.java` verifying payments recorded via `CHEQUE` and `OTHER` are persisted and retrieved successfully without truncation errors.

**Acceptance Criteria:**
Payments recorded with `CHEQUE` or `OTHER` persist to MySQL without errors, matching the application enum definition.

---

## 10. Include Completed Parcels in Client Status Rollups [COMPLETED]

**Status:** COMPLETED
**Priority:** P2 (Domain Consistency & Rollup Accuracy)

**Problem:**
In `ClientServiceImpl.java`:
- Lines 362–378 (`computeRollupStatus`): When every parcel in a client shipment reaches `COMPLETED`, this method has no terminal-status branch and falls through to `Registered`. Client detail responses therefore display finalized shipments as registered.
- Line 155 (`getClientDetails`): The `completedDeliveries` counter only checks for `"Arrived at TNL"` and `"Loaded to Hauler"`, omitting `"Completed"`. Client detail responses omit finalized shipments from `completedDeliveries`.

**Implementation:**
1. In `ClientServiceImpl.computeRollupStatus`, handle `ParcelStatus.COMPLETED` at the top of the rollup hierarchy (matching `ShipmentServiceImpl.java`):
   ```java
   if (counts.containsKey(ParcelStatus.COMPLETED)) {
       long c = counts.get(ParcelStatus.COMPLETED);
       return new RollupStatus("Completed", c + " / " + total + " Completed");
   }
   ```
2. In `ClientServiceImpl.getClientDetails`, count `"Completed"` shipments as completed deliveries:
   ```java
   if ("Completed".equalsIgnoreCase(rollup.overallStatus)
           || "Loaded to Hauler".equalsIgnoreCase(rollup.overallStatus)
           || "Arrived at TNL".equalsIgnoreCase(rollup.overallStatus)) {
       completedDeliveries++;
   }
   ```
3. Add regression test in `ClientIntegrationTest.java` verifying that shipments with all parcels in `COMPLETED` evaluate to `"Completed"` status and increment `completedDeliveries`.

**Acceptance Criteria:**
Client detail responses accurately display `"Completed"` for delivered shipments and include them in the `completedDeliveries` tally.

---

## Execution Slices & Backlog Sequence

| Slice | Scope | Focus Items | Target Branch |
| :--- | :--- | :--- | :--- |
| **Slice A** [SKIPPED] | Operational Safety | Item 1 (Boot Flyway Deferral) | `backend/bugfix/legacy-upgrade-boot-flyway` (Skipped) |
| **Slice B** [COMPLETED] | Data & Billing Invariants | Item 4 (Parcel Count Match) & Item 6 (Scoped Label Print) | `backend/bugfix/shipment-integrity-checks` |
| **Slice C** [COMPLETED] | Lifecycle & State Machines | Item 2 (Waybill Transitions), Item 3 (Waybill Decoupling), Item 5 (QR State) | `backend/bugfix/lifecycle-state-hardening` |
| **Slice D** [COMPLETED] | Concurrency & Frontend | Item 7 (Pessimistic Scan Lock) & Item 8 (Frontend Print Trigger) | `fullstack/bugfix/scan-concurrency-and-print-ux` |
| **Slice E** [COMPLETED] | Schema & Client Rollup | Item 9 (Payment Enum Migration) & Item 10 (Client Completed Rollup) | `fullstack/bugfix/payment-enum-and-client-rollup` |

---

## Acceptance & Quality Checklist

- [ ] All automated tests pass (`mvn test` clean exit).
- [ ] No git write commands executed autonomously.
- [ ] Documentation updated in `build-plan.md` and `project-structure.md`.
- [ ] Zero regression on 151 existing integration tests.
- [ ] Pre-commit review conducted per slice.
