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
- `sendWaybillToHauler` (line 177) does not verify that the waybill is currently in `GENERATED` status. A caller can re-dispatch an already signed/completed waybill, overwriting its status back to `SENT_TO_HAULER`.
- `markSignedCompleted` (line 200) does not verify that the waybill is currently in `SENT_TO_HAULER` status. A caller can directly mark a `GENERATED` waybill as completed, bypassing physical hauler dispatch.

**Implementation:**
1. In `WaybillServiceImpl.sendWaybillToHauler`:
   - Assert `waybill.getStatus() == WaybillStatus.GENERATED`.
   - Throw `IllegalStateException("Cannot dispatch waybill in status " + waybill.getStatus() + ". Expected GENERATED.")` if invalid.
2. In `WaybillServiceImpl.markSignedCompleted`:
   - Assert `waybill.getStatus() == WaybillStatus.SENT_TO_HAULER`.
   - Throw `IllegalStateException("Cannot sign waybill in status " + waybill.getStatus() + ". Expected SENT_TO_HAULER.")` if invalid.
3. Add regression tests in `WaybillIntegrationTest.java`:
   - Dispatching a `SIGNED_COMPLETED` waybill returns HTTP 400/409.
   - Signing a `GENERATED` waybill without prior dispatch returns HTTP 400/409.
   - Normal flow (`GENERATED -> SENT_TO_HAULER -> SIGNED_COMPLETED`) succeeds.

**Acceptance Criteria:**
Waybill state transitions strictly adhere to `GENERATED -> SENT_TO_HAULER -> SIGNED_COMPLETED`. Backward mutations and skipped steps are rejected.

---

## 3. Decouple Waybill Completion from Parcel Tracking [COMPLETED]

**Status:** COMPLETED
**Priority:** P1 (Architectural Invariant & Rule 19)

**Problem:**
In `WaybillServiceImpl.java` (lines 213–236), completing a waybill forcefully mutates all parcel units under the shipment to `ParcelStatus.COMPLETED` and generates synthetic tracking events. This cross-couples the independent Waybill and Tracking lifecycles, contrary to Rule 19 in `AGENTS.md`. Furthermore, if parcels were only `REGISTERED` or `LOADED_ON_TRUCK`, waybill completion forces them straight to `COMPLETED`, bypassing intermediate physical custody scans.

**Implementation:**
1. Align with the 4 Decoupled Lifecycles in `AGENTS.md`:
   - Tracking Status: `REGISTERED` -> `QR_GENERATED` -> `LOADED_ON_TRUCK` -> `ARRIVED_AT_TNL` -> `LOADED_TO_HAULER`.
   - Waybill Status: `NOT_GENERATED` -> `GENERATED` -> `SENT_TO_HAULER` -> `SIGNED_COMPLETED`.
2. In `WaybillServiceImpl.markSignedCompleted`:
   - Remove the blanket overwrite that forces all parcels to `COMPLETED`.
   - Completing a waybill signs the Proof of Delivery (POD) and updates `waybill.setStatus(SIGNED_COMPLETED)`.
   - If business requirements require parcel completion upon delivery, only parcels already in `LOADED_TO_HAULER` may advance to delivered/completed status, preserving state machine continuity.
3. Update `WaybillIntegrationTest` and frontend manifests to reflect decoupled lifecycle metrics.

**Acceptance Criteria:**
Waybill signing updates the Waybill entity without corrupting parcel tracking integrity or bypassing custody scans.

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

## 7. Concurrency Control for Parcel Status Scans

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

## 8. Record Label Prints on Actual Print Invocation

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

## Execution Slices & Backlog Sequence

| Slice | Scope | Focus Items | Target Branch |
| :--- | :--- | :--- | :--- |
| **Slice A** [SKIPPED] | Operational Safety | Item 1 (Boot Flyway Deferral) | `backend/bugfix/legacy-upgrade-boot-flyway` (Skipped) |
| **Slice B** [COMPLETED] | Data & Billing Invariants | Item 4 (Parcel Count Match) & Item 6 (Scoped Label Print) | `backend/bugfix/shipment-integrity-checks` |
| **Slice C** [COMPLETED] | Lifecycle & State Machines | Item 2 (Waybill Transitions), Item 3 (Waybill Decoupling), Item 5 (QR State) | `backend/bugfix/lifecycle-state-hardening` |
| **Slice D** | Concurrency & Frontend | Item 7 (Pessimistic Scan Lock) & Item 8 (Frontend Print Trigger) | `fullstack/bugfix/scan-concurrency-and-print-ux` |

---

## Acceptance & Quality Checklist

- [ ] All automated tests pass (`mvn test` clean exit).
- [ ] No git write commands executed autonomously.
- [ ] Documentation updated in `build-plan.md` and `project-structure.md`.
- [ ] Zero regression on 151 existing integration tests.
- [ ] Pre-commit review conducted per slice.
