# TNL Logistics — Master Build Plan

**System Architecture:** Unified Modular Monolith (Spring Boot 3.4 + MySQL 8.0 + React Native / Expo Web & Mobile). Single shared database where every transaction encoded on PC or mobile is immediately available across all platforms in real time.

**4 Independent Status Concepts (Rule 19):**
* **Tracking Status (5-state):** `Registered` → `QR Generated` → `Loaded on Truck` → `Outload / Arrive TNL` → `Loaded to Hauler`
* **Payment Status:** `Unpaid` → `Partially Paid` → `Paid` (and `For Collection` during Thursday batch)
* **Label Status:** `Not Printed` → `Printed` → `Reprinted`
* **Waybill Status (4-state):** `Not Generated` → `Generated` → `Sent to Hauler` → `Signed / Completed`

---

## Progress Overview

| Phase | Description | Status |
| :--- | :--- | :---: |
| **Phase 0** | Foundation (Skeleton, Flyway Migrations V1-V6, JPA Entities, JWT Auth & Roles) | [COMPLETED] |
| **Phase 1** | Register Shipment (`SHP-YYYY-XXX`, `TRK-YYYY-XXXXXX`), $m^3$ Volume, Vector QR Labels & Paginated Table | [COMPLETED] |
| **Phase 2.1** | Backend: 5-State Status Flow Engine & Sequential Scan Validation (`POST /tracking-events/scan`) | [COMPLETED] |
| **Phase 2.2** | Backend: Vehicle Fleet Management (`VH-XXX` generator & CRUD endpoints) | [COMPLETED] |
| **Phase 2.3** | Real-Time Live Auto-Updates (Server-Sent Events streaming pipeline `GET /api/v1/events/stream`) | [COMPLETED] |
| **Phase 2.4** | Web: Vehicle Fleet Management UI (`/vehicles` list & register modal — Desktop Screens 13/14) | [COMPLETED] |
| **Phase 2.5** | Web & Backend: Client Management Directory & Profile View (`/clients`, `/clients/[id]` — Screens 15/16) | [COMPLETED] |
| **Phase 3** | Waybills: `WYB-YYYY-XXXX` Generator, 4-State Lifecycle, Printable Manifest & Signature (Desktop Screens 23–25) | [COMPLETED] |
| **Phase 4.1** | Backend: Payments & Collections Engine (`POST /api/v1/payments`, Balance Recalculation, Multi-Search & Audit) | [COMPLETED] |
| **Phase 4.2** | Backend: Thursday Weekly Collections Consolidation & SOA Generator (3 Deductions, Net Remittance) | [COMPLETED] |
| **Phase 4.3** | Web: Billing, Collections & Printable SOA (Desktop Screens 18–22) | [COMPLETED] |
| **Phase 5** | Web Console: Live Dashboard, Tracking Logs Stream, Reports, Users, Settings & First Boot Setup (Screens 01, 02, 17, 26–28) | [COMPLETED] |
| **Phase 6** | Role-Aware Mobile Courier Portal (Screens 29–53) | [IN PROGRESS] |
| ↳ **Phase 6.1** | Mobile Credential & PIN Workflow & Role-Aware Shell (Screens 29–33) | [COMPLETED] |
| ↳ **Phase 6.2** | Office Staff: Shipment Generation & Past Shipments Directory (Screens 34–40) | [COMPLETED] |
| ↳ **Phase 6.3a** | Software Label Printing, Virtual Driver Isolation & Audit Hardening (Screens 41–44) | [COMPLETED] |
| ↳ **Phase 6.3b** | Physical Bluetooth Integration & Brother RJ-2035B On-Device Validation | [UPCOMING] |
| ↳ **Phase 6.4** | Field Staff: Camera QR Scanner & Status Flow Engine (Screens 45–48) | [UPCOMING] |
| ↳ **Phase 6.5** | Field Staff: Personal Scan & Tracking History (Screens 49–52) | [UPCOMING] |
| ↳ **Phase 6.6** | Offline Resilience & SQLite Scan Queue (Screen 53) | [UPCOMING] |

---

## Phase 0 — Foundation [COMPLETED]
*Backend and database foundation.*

**0.1 — Project Skeleton & Database** — **[COMPLETED]**
- Spring Boot 3.4 with Java 21, Flyway migration versioning `V1` through `V6`.
- MySQL connection pooling with HikariCP.

**0.2 — Core JPA Entities & Schemas** — **[COMPLETED]**
- `Client`, `Shipment`, `ParcelUnit`, `AppUser`, `Vehicle`, `TrackingEvent`, `PrintEvent`, `Payment`, `Waybill`, `SoaStatement`.
- Physical dimensions ($L \times W \times H\text{ cm}$), auto-volume calculation ($m^3$), and volumetric weight divisor ($5000$).
- Verified via `RepositoryIntegrationTest` suite.

**0.3 — Security, JWT & RBAC** — **[COMPLETED]**
- HMAC-SHA256 stateless JWT token provider with BCrypt password hashing and immutable user ID binding.
- Differentiated token lifecycle architecture: 12-hour shift TTL for Web Administrator (`ADMIN`) in browser `localStorage`, and 10-day TTL for Mobile Staff (`OFFICE_STAFF`, `FIELD_STAFF`) in hardware `SecureStore` with PIN unlock; configurable via `jwt.expiration.admin-hours` and `jwt.expiration.staff-days`.
- Dynamic invalidation of legacy overlong administrator sessions in `JwtTokenProvider.validateToken`: enforces issuance-time ceiling (`now - iat <= 12h`) and validity window bounds (`exp - iat <= 12h + 60s`) on all `ADMIN` tokens.
- 3 distinct system roles: `ADMIN`, `OFFICE_STAFF`, `FIELD_STAFF`.
- Instant session revocation on credential changes via `tokenVersion` claims.
- Method security (`@PreAuthorize`) and `SecurityIntegrationTest` suite.

---

## Phase 1 — Register Shipment & Labels (Office Staff, PC-First) [COMPLETED]
*First complete vertical slice.*

**1.1 — Backend: Registration Engine & Sequential ID Generation** — **[COMPLETED]**
- `POST /api/v1/shipments` — client + recipient + shipment/charges + $N$ parcel units.
- Sequential ID generators: `SHP-YYYY-XXX` and `TRK-YYYY-XXXXXX`.
- Pricing models: `FLAT` vs `PER_PARCEL` charge calculations (Rule 08).
- Auto-payment created if `paidAtRegistration = true`. Initial `REGISTERED` & `QR_GENERATED` scan events logged.
- Verified via `ShipmentIntegrationTest` suite (5 passing tests).

**1.2 — Web: Shipment Registration Screen (Desktop Screens 03–05)** — **[COMPLETED]**
- Matches client prototype (client selector + inline `+ New Client` toggle, recipient fields, charges, live total).
- Implemented `ShipmentResultView` with summary grid, parcel table, and live label preview.
- Implemented `PrintLabelsModal` with printable vector QR cards for all units.

**1.3 — Web: Shipments Table & Package Tracking View (Desktop Screens 06–12)** — **[COMPLETED]**
- Paginated master shipments table (`GET /api/v1/shipments`) with search and status filters.
- Live Shipment Details view (`GET /api/v1/shipments/{shipmentId}`).
- Single Parcel Inspection screen (`GET /api/v1/parcel-units/{trackingId}`) with dimensions, volume ($m^3$), completed-only orange tracking history, single grey next pending status, and label reprint tracking.

---

## Phase 2 — Status Flow, Vehicle Fleet & Real-Time Sync [COMPLETED / IN PROGRESS]

**2.1 — Backend: 5-State Status Flow Engine** — **[COMPLETED]**
- Status lifecycle: `REGISTERED` → `QR_GENERATED` → `LOADED_ON_TRUCK` → `ARRIVED_AT_TNL` → `LOADED_TO_HAULER`.
- Strict sequential transition validation; invalid skips rejected with HTTP 400 Bad Request.
- `POST /api/v1/tracking-events/scan` (single) and `POST /api/v1/tracking-events/batch-scan` (batch).
- Dynamic shipment rollup status derivation (Rule 09).

**2.2 — Backend: Vehicle Fleet Management Engine** — **[COMPLETED]**
- Sequential Vehicle ID generator: `VH-001`, `VH-002`, `VH-003`...
- CRUD endpoints: `POST /api/v1/vehicles`, `GET /api/v1/vehicles` (active fleet), `PUT /api/v1/vehicles/{id}`, `DELETE /api/v1/vehicles/{id}`.
- Mandatory active vehicle assignment on `LOADED_ON_TRUCK` and auto-clearing upon `ARRIVED_AT_TNL` (Rule 18).

**2.3 — Real-Time Live Auto-Updates (Server-Sent Events)** — **[COMPLETED]**
- `SseService` with thread-safe client connection registry and 25-second keep-alive heartbeats.
- `GET /api/v1/events/stream` HTTP streaming endpoint.
- Web tables, status badges, and parcel timelines update silently in place with 0ms latency upon scan events.

**2.4 — Web: Vehicle Fleet Management UI (Desktop Screens 13/14)** — **[COMPLETED]**
- `frontend-web/src/app/vehicles.js` — Fleet list (Vehicle ID, Plate number, Type, Status badge, Remarks).
- Register Vehicle Modal with auto-generated ID, plate number validation, and vehicle type selector.

**2.5 — Web & Backend: Client Management Directory & Profile View (Desktop Screens 15/16)** — **[COMPLETED]**
- Flyway `V9__add_client_fields_and_performance_indexes.sql` with `default_rate_type`, `active`, `date_registered`, and composite indexes.
- Sequential ID generator `CL-001`, `CL-002`... with zero N+1 batch financial aggregations (`totalShipments`, `totalCharges`, `totalPaid`, `outstandingBalance`).
- Hybrid smart deletion (permanent hard delete for unused clients, soft deactivation for clients with shipment history).
- `frontend-web/src/app/clients/index.js` (Screen 15: Client Directory Table with search, persistent status pills `All`, `Active`, `Inactive`, and pagination).
- `frontend-web/src/app/clients/[id].js` (Screen 16: Single Client Profile View with 3-metric balance rollup and embedded shipment tracking history).
- Register & Edit Client modals, and inactive client filtering in shipment registration.
- Client detail response accurately reflects completed deliveries count and COMPLETED parcel rollup.

---

## Phase 3 — Waybill Generation & Printable Manifest (Desktop Screens 23–25) — **[COMPLETED]**
*Document handover and legal proof of delivery.*

**3.1 — Backend: Waybill Engine & 4-State Lifecycle** — **[COMPLETED]**
- Exactly ONE waybill per shipment (`1 → 1 Waybill` — Rule 21).
- 4-State Lifecycle: `Not Generated` → `Generated` → `Sent to Hauler` → `Signed / Completed`.
- Sequential Waybill ID generator: `WYB-YYYY-XXXX` (e.g. `WYB-2026-0001`).
- Field Staff discriminator: `staff_type` (`INTERNAL_TRUCK` vs `HAULER_STAFF`) and `hauler_company` in `app_user` (Flyway `V10`).
- Endpoints:
  - `GET /api/v1/waybills/shipments` — Shipment options for top selector.
  - `GET /api/v1/waybills/haulers` — Categorized hauler field staff and carrier options.
  - `GET /api/v1/waybills/manifest/{shipmentId}` — Detailed waybill manifest payload with client and parcel breakdown.
  - `POST /api/v1/waybills/send-to-hauler` — Dispatches waybill to designated hauler.
  - `POST /api/v1/waybills/complete/{shipmentId}` — Records returned client signature metadata and completes POD.
  - `GET /api/v1/waybills` — Paginated list of waybills with search, status, and hauler filters.

**3.2 — Web: Waybill Management & Printable View (Desktop Screens 23, 24, 25)** — **[COMPLETED]**
- **Waybills Screen (`src/app/waybills/index.js` matching `prototype waybills page.png`):**
  - Top dropdown selector (`[ SHP-2026-005 · Mario Bautista · Not Generated v ]`), dynamic status pill, and `Open shipment →` link.
  - 3-Stage Waybill Workflow Bar:
    - `Not Generated`: `HAULER` dropdown (field staff haulers) + `Mark as Sent to Hauler →`.
    - `Sent to Hauler`: `SIGNED BY` input text (pre-filled with client/recipient name) + `Mark as Signed / Completed →`.
    - `Signed / Completed`: `✓ Completed` badge with signatory metadata and completion date.
  - High-contrast A4 printable logistics manifest card with TNL header, hauler box, consignee box, itemized parcel tracking list, and 3 physical signature blocks.
  - Top-right `Print / Export PDF` action triggering web print dialog.

---

## Phase 4 — Billing, Weekly Collections & Statement of Account (Desktop Screens 18–22)
*Financial accounting and client billing.*

**4.1 — Backend: Payments & Collections Engine** — **[COMPLETED]**
- Flyway `V12__enhance_payment_schema.sql`: added `staff_id` (FK to `app_user`), `remarks`, and composite index on `(payment_date, method)`.
- Flyway `V26__expand_payment_methods.sql`: expanded `payment.method` enum to include `CHEQUE` and `OTHER`.
- Financial balance calculation and validation: strictly positive payment amounts, overpayment prevention exceeding remaining balance.
- Automatic payment status updates: `Unpaid` → `Partially Paid` → `Paid` (with running `totalPaid` and `balance` updates).
- REST Endpoints:
  - `POST /api/v1/payments` — Record payment against shipment (`ADMIN`, `OFFICE_STAFF`).
  - `GET /api/v1/payments/shipment/{shipmentId}` — Itemized shipment payment history and balance overview.
  - `GET /api/v1/payments` — Paginated company-wide payments directory with multi-field search (shipment ID, client, recipient, ref no, method, date range).
- Real-time Server-Sent Events (SSE) integration via `broadcastPaymentRecorded`.
- Verified via `PaymentIntegrationTest` suite (18/18 tests passing).

**4.2 — Backend: Thursday Weekly Collections Consolidation & SOA Generator** — **[COMPLETED]**
- Flyway `V13`, `V14`, `V15`, `V16`: enhanced `soa`, created `soa_deduction` table, composite indexes, and complete cascading foreign keys.
- Thursday Weekly Collection Consolidation Engine (Rule 13): groups unbilled shipments (`statement_id IS NULL`) and client balances.
- Sequential SOA ID Generator: `SOA-YYYY-XXXX` (e.g. `SOA-2026-0001`).
- 3 Business Deduction categories: `BAD_ORDER`, `DISCREPANCY`, and `CLAIM`.
- Mathematical Net Remittance & Outstanding Balance derivation:
  $\text{Outstanding Balance} = \text{Current Charges} + \text{Previous Balance} - \text{Deductions} - \text{Total Paid}$.
- Immutability Lock: updates `statement_id = soa_no` on all included shipments and payments upon SOA creation.
- REST Endpoints:
  - `GET /api/v1/collections/weekly` — Active Thursday weekly collections overview.
  - `GET /api/v1/collections/preview/{clientId}` — Live unbilled shipments preview for a client.
  - `POST /api/v1/soa/generate` — Single SOA generation with itemized deductions.
  - `POST /api/v1/soa/generate-batch` — Bulk SOA generation for collection cycle.
  - `GET /api/v1/soa/{soaNo}` — Complete statement details and breakdown.
  - `GET /api/v1/soa` — Paginated directory of generated SOAs.
- Real-time SSE broadcasting via `broadcastSoaGenerated`.
- Verified via `SoaIntegrationTest` suite (21/21 total backend tests passing).

**4.3 — Web: Billing, Collections & Printable SOA (Desktop Screens 18, 19, 20, 21, 22)**  — **[COMPLETED]**
- **Payment Management (Screen 18) — [COMPLETED]:**
  - `/payments` directory table with payment status filter (`Unpaid`, `Partial`, `Paid`), multi-search (Shipment ID, Client Name, Recipient), and real-time outstanding balance metric card.
  - "Record Payment" modal with real-time balance ceiling restriction, dynamic reference validation (`*` for `GCASH`, `BANK`, `CHEQUE`), and SSE live refresh.
  - "Payment History" modal (`View` action) with itemized compounding installment ledger, date stamps, staff attribution, and financial summary.
  - Fixed-slot action column layout (`View`, `Record →`, `Settled`) to eliminate horizontal row jitter.
- **Weekly Collections (Screen 19) — [COMPLETED]:**
  - `/weekly-collections` Thursday consolidation dashboard matching prototype layout with 3 metric cards (`CLIENTS`, `TOTAL DUE`, `OUTSTANDING`).
  - Active Thursday cycle selector targeting the current closing week with dynamic endpoint integration (`GET /api/v1/collections/cycles`) to filter out empty weeks.
  - Searchable client dropdown with outside-click dismissal and client table status filters (`All`, `Ready for SOA`, `SOA Generated`, `Settled`).
  - Table with `CLIENT`, `SHIPMENTS`, `TOTAL CHARGES`, `PAID`, `DEDUCTIONS`, `BALANCE`, `STATUS`, and action buttons (`Generate SOA →` and `View SOA`).
  - Batch SOA Modal with bulk generation trigger and informative notice when all SOAs for a cycle are generated.
  - Pure on-demand Server-Sent Events (SSE) live updates with clean disconnect handling.
- **Consolidated SOA Preview (Screen 20) — [COMPLETED]:**
  - `/statements` itemized unbilled shipment breakdown for the billing cycle with itemized table, total charges, total paid, and deductions input card (`DeductionsInputCard.js`).
  - Real-time deduction calculation and notes input (supporting Bad Orders, Discrepancies, Claims) with immediate backend persistence.
- **Detailed Statement View (Screen 21) — [COMPLETED]:**
  - `/statements` full digital multi-page Statement of Account with client info header, sequential `SOA-YYYY-XXX-WXX` number, multi-page continuation headers, page numbering (`Page X of Y`), deduction rollup directly below Total Paid, and authorized collector assignment.
- **Printable SOA & Batch Export (Screen 22) — [COMPLETED]:**
  - Dedicated isolated print route at `/statements/print` with `@page { margin: 0; }` browser header suppression, crisp vector borderTop rules, signature blocks (Prepared by, Collected by, Date collected), and smart batch generation on `/weekly-collections`.

---

## Phase 5 — Web Console: Dashboard, Reports & Administration (Desktop Screens 01, 02, 17, 26–28)
*Operational dashboards and administrative controls.*

**5.1 — Desktop Login & Route Protection (Screen 01)** — **[COMPLETED]**
- Standalone production login screen with `TC & CT INTEGRATED LOGISTICS` artwork branding (`/login`).
- Username/password authentication, JWT storage, and `FIELD_STAFF` desktop blocking.
- Route guarding across all web console paths with return URL redirection (`?redirect=<path>`).
- Dynamic sidebar session display with user avatar initials, role, and functional `SIGN OUT` action.
- Responsive desktop card layout (`maxWidth: 500px`), optimized transparent brand logo, and viewport height adaptations.
- Built-in in-memory login rate limiter (5 failed attempts per 60s, 60s lockout) with on-demand lazy eviction, HTTP 429 `Retry-After`, and reactive frontend countdown lock.
- Adaptive `+not-found.js` catch-all route (inside AppShell for authenticated operators, standalone for visitors) and RBAC route guarding for `/users` and `/settings`.

**5.2 — Dashboard Live Metrics (Screen 02)** — **[COMPLETED]**
- Live operational cards: Shipments & parcel count, Today's Shipments, Unpaid Transactions, and Thursday Weekly Collection rollup.
- Visual chart cards: Parcel Units by Status (Donut Chart), Weekly Shipment Volume (Monday–Sunday Bar Chart), and Outstanding vs Collected financial comparison bars.
- Live recent activity feed with formatted tracking scans, staff attribution, and link to `/tracking-logs`.
- Backend live aggregation endpoint `GET /api/v1/dashboard/summary` and real-time Server-Sent Events (SSE) synchronization.

**5.3 — Global Tracking Logs Audit Feed (Screen 17)** — **[COMPLETED]**
- Company-wide real-time audit stream showing every parcel scan, timestamp, acting staff member, and vehicle assignment.
- 4-card live operational metrics bar (Today's Total Scans, Active Couriers, Loaded on Truck Today, Handed to Hauler Today).
- Multi-field search (tracking ID, shipment ID, staff name) with persistent status filter pills matching prototype aesthetic.
- Server-side paginated audit table with configurable page sizes (10, 25, 50), clickable parcel inspection links, and CSV export.
- Optimized Server-Sent Events (SSE) synchronization: smart in-place prepend on Page 1 and non-intrusive floating pill on Page > 1.
- REST endpoints `GET /api/v1/tracking-events` and `GET /api/v1/tracking-events/metrics` protected by RBAC (`ADMIN`, `OFFICE_STAFF`), verified via `TrackingLogIntegrationTest`.

**5.4 — Operational & Financial Reports (Screen 26)** — **[COMPLETED]**
- Implemented complete reporting hub (`frontend-web/src/app/reports.js`) with grouped dual-bar chart (charges vs collections), Thursday collection cycle summary card, and top 5 KPI cards with period filtering (`Today`, `This Week`, `This Month`, `Last 30 Days`, `Custom`).
- Multi-domain reporting tabs: Financial & Revenue (`FinancialRevenueTab.js`), Operational Volume (`OperationalVolumeTab.js`), and Client Receivables Aging (`ReceivablesAgingTab.js`).
- Interactive `[✓] Hide empty days` toggle on the Daily Operations Timeline (enabled by default), with reverse chronological date ordering (latest date at top) and dynamic grand total label (`Total (X active days)` vs `Total (X days)`).
- Standardized pagination footer across all report tables and Tracking Logs matching the canonical `Showing N of T · Page X of Y [N / page ▾] [← Previous] [Next →]` pattern established in Shipments, Vehicles, and Payments.
- CSV export per tab and browser A4 printable document modal (`PrintableReportModal.js`).
- Real-time SSE synchronization (`STATUS_UPDATE`, `SHIPMENT_CREATED`, `PAYMENT_RECORDED`, `SOA_GENERATED`) with 300ms debounced silent reloads and window focus re-sync.
- Backend aggregation endpoints `GET /api/v1/reports/summary` and `GET /api/v1/reports/kpis` protected by `@PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")`, verified via `ReportIntegrationTest` (5/5 passing).

**5.5 — User & Staff Management (Screen 27)** — **[COMPLETED]**
- Staff directory (`/users`) with server-side pagination, search by name, username, and ID, role and status filtering, platform access chips, and responsive design.
- Credential management suite: auto-generated temporary passwords (`TNL-XXXX`) with clipboard copy feedback and re-roll button; mobile PIN setup (Option A "Require PIN setup on first mobile login" default + Option B collapsible manual 4-digit override); dedicated `ResetPasswordModal` and `ResetPinModal`.
- Instant session revocation via `tokenVersion` claims and Flyway migrations `V17__add_user_pin_and_indexes.sql` and `V18__add_user_token_version.sql`.
- Destructive action safety: `ConfirmActionModal` requiring typed User ID verification for deletion; soft-deactivation (`active = false`) for staff with linked operational audit history.
- Single Administrator System Invariant: disallow creating additional admin accounts, prevent promoting staff to admin, prevent altering admin role, and protect the system owner (`USR-ADMIN`) from deletion across UI and backend services.
- Full REST endpoints in `UserController.java` (`POST /api/v1/users`, `GET /api/v1/users`, `PUT /api/v1/users/{id}`, `DELETE /api/v1/users/{id}`, `PUT /api/v1/users/{id}/reset-password`, `PUT /api/v1/users/{id}/reset-pin`) secured with `@PreAuthorize("hasRole('ADMIN')")`, verified via 20 integration tests in `UserManagementIntegrationTest.java`.

**5.6 — System Settings (Screen 28)** — **[COMPLETED]**
- Flyway migration `V19__create_system_settings_table.sql` creating `system_setting` singleton configuration table with defaults.
- Dynamic Weekly Collection Day integration across `CollectionsService`, `SoaService`, `DashboardService`, and frontend cycle dropdowns, shifting active closing dates while preserving historical finalized SOAs.
- Dynamic cycle start date calculation (`calculateCycleStartDate`) anchored to the day following the preceding cycle (clamped to 7-day lookback floor), eliminating date overlaps during collection day transitions.
- Intermediate ghost cycle elimination by bounding candidate historical cycle discovery strictly to pre-active windows.
- N+1 database query optimization in `CollectionsServiceImpl.getWeeklyCollections()` by pre-fetching statement numbers into a fast in-memory lookup set.
- Replaced legacy `getActiveCycleThursdays()` with `getActiveCycleDates()`, retaining the former as a deprecated backward-compatible delegator.
- Dynamic volumetric divisor calculation in `ShipmentService` and reactive calculation preview formula in Settings (`e.g. 50×40×30 = 60,000 cm³ ÷ divisor = kg`).
- Dynamic company branding (Business Name, Address, Contact, Billing Email) propagating to Statement of Account printouts, Waybill manifests, and Admin Console screens.
- RBAC protection: Admin-only access for `/api/v1/settings` (`GET`, `PUT`) and staff-accessible `/api/v1/settings/branding`.
- Real-time Server-Sent Events (`SETTINGS_UPDATED`) for zero-reload configuration synchronization.
- Frontend Settings screen (`frontend-web/src/app/settings.js`) matching prototype layout with 2-card desktop grid, provisional billable weight callout, and read-only sequential ID format previews (`TRK-YYYY-`, `SHP-YYYY-`).
- Verified via 12 integration tests in `SystemSettingIntegrationTest.java` (12/12 passing, and 102/102 backend tests passing total).

**5.7 — First Boot Admin Registration & Setup Wizard** — **[COMPLETED]**
- Public first-boot status probing endpoint (`GET /api/v1/auth/first-boot-status`) returning `FirstBootStatusResponse(isFirstBoot)` to report whether an administrator account already exists (`!existsByRole(ADMIN)`).
- One-time initial admin registration endpoint (`POST /api/v1/auth/first-boot-admin`) accepting `FirstBootAdminRequest` with Bean validation, creating the immutable primary administrator (`userId = 'USR-ADMIN'`, `role = ADMIN`, `active = true`, `tokenVersion = 1`), updating singleton `SystemSetting` company branding, broadcasting `SETTINGS_UPDATED` SSE, and returning a freshly signed JWT token.
- Permanent endpoint lockout: returns HTTP 409 Conflict once the primary administrator has been initialized, preventing rogue account creation.
- Environment & seeder isolation: parameterized `app.seed.admin` property in `DataSeeder.java` and dedicated `application-firstboot.properties` profile for testing on clean isolated databases (`tnl_firstboot`).
- Frontend 2-Step Setup Wizard (`frontend-web/src/app/setup.js`):
  - Step 1 (Administrator Credentials): Full Name, Username, Password, and Confirm Password with SVG eye reveal toggles, minimum 8 characters, and live validation.
  - Step 2 (Company & SOA Branding): Pre-filled defaults for *TC & CT Integrated Logistics* (Labo, Camarines Norte) with a reactive document header preview card.
  - Auto-login: automatically sets the authenticated session upon completion and redirects directly to the operations dashboard (`/`).
- Central route guard integration (`frontend-web/src/app/_layout.js`): proactively checks `checkFirstBootStatus()` on mount, auto-redirecting uninitialized visitors to `/setup`, and blocking initialized visitors from `/setup` back to `/login`.
- Administrator Credential Management & Settings Protection:
  - Settings Card (`AdminSecurityCard.js`): dedicated operations card on `/settings` with live eye visibility toggles for self-service password updates, incrementing `tokenVersion` and transparently refreshing the active session.
  - Read-Only Admin Status: updated `EditUserModal.js` to render a fixed read-only `Active` badge for the `ADMIN` role, completely preventing self-deactivation.
  - Password Authorization Modals: implemented reusable `ConfirmPasswordModal.js` requiring administrator password confirmation before persisting system settings or updating credentials.
  - Rate-Limited Verification: added `POST /api/v1/auth/verify-password` using typed `PasswordVerificationRequest` and bound to `LoginRateLimiterService` (locking access after 5 consecutive failures with HTTP 429 and `Retry-After`).
- Verified via `FirstBootIntegrationTest.java` and `SecurityIntegrationTest.java` (105/105 backend tests passing, 0 failures, 0 errors, and clean web production build).

---

## Phase 6 — Role-Aware Mobile Courier Portal (Mobile Screens 29–53) — **[IN PROGRESS]**
*Field staff courier app and authorized mobile office workflows.*

**6.1 — Mobile Credential & PIN Workflow & Role-Aware Shell (Screens 29, 30, 31, 32, 33)** — **[COMPLETED]**
- Stage 1 (Initial Login / Device Binding): Full Username & Password login (`POST /api/v1/auth/mobile-login`) allowing both `OFFICE_STAFF` and `FIELD_STAFF` (with Admin web-provisioned credentials), issuing a 10-day staff JWT token (`jwt.expiration.staff-days`), generating high-entropy CSPRNG device credentials (`deviceId`, 256-bit `deviceToken`), binding device identity to local hardware storage, returning `hasPinSet`.
- Stage 2 (PIN Setup & Confirmation): Dedicated PIN Setup screen (`src/app/(auth)/setup-pin.js`) for accounts with `hasPinSet == false` (Option A "Require PIN setup on first mobile login" or "Clear PIN & Require Setup"), calling `POST /api/v1/auth/mobile-setup-pin` with 4-digit PIN confirmation, BCrypt hashing, incrementing `tokenVersion` to invalidate stale tokens, and returning a replacement JWT adopted seamlessly by the client.
- Stage 3 (Shift Unlock): Quick PIN unlock screen (`src/app/(auth)/pin.js`) matching `prototype pin page.png`, displaying bound staff member's full name, role badge, 4-dot indicator, and 3x4 keypad calling `POST /api/v1/auth/mobile-pin-login` with targeted `{ username, pin }` and required device headers (`X-Device-Id`, `X-Device-Token`), plus "Sign in with another account" unbind action.
- Stage 4 (Header Actions & Lifecycles): `MobileHeader` supporting quick "LOCK" (locks session back to PIN screen) and "LOGOUT" (custom minimalist `StatusModal` confirmation unbinding device and clearing stored auth).
- Cryptographic Server-Enforced Device Binding (Flyway `V27`):
  - Database schema: `V27__create_mobile_device_bindings.sql` creating `mobile_device_bindings` table with composite indexes on `(user_id, device_id)`.
  - Model & Data Access: `MobileDeviceBinding` JPA entity and `MobileDeviceBindingRepository` supporting atomic token updates, queries by user and device, and cascading device revocation.
  - Server-Side Token Hashing: Generates 256-bit device tokens via `SecureRandom`, storing only SHA-256 hashes (`device_token_hash`) in the database and returning plaintext credentials to the client once on initial login.
  - Constant-Time Possession Verification: `POST /api/v1/auth/mobile-pin-login` strictly requires device credentials (`X-Device-Id` and `X-Device-Token`), validates that the binding exists and belongs to the user, and compares hashes using `MessageDigest.isEqual` to prevent timing attacks. Missing, unknown, mismatched, or cross-account device credentials are rejected with HTTP 401 before evaluating the PIN.
- Mandatory Password Rotation & First-Boot Sequence:
  - Sequence Enforcement: Strictly enforces `Password Login -> Password Change -> Device Binding -> PIN Setup -> Shift Unlock`.
  - Scoped Provisional JWT: When `user.mustChangePassword == true`, `POST /api/v1/auth/mobile-login` returns `mustChangePassword: true` and issues a temporary token strictly for password updates without issuing or recording device bindings.
  - PIN Unlock Prohibition: `POST /api/v1/auth/mobile-pin-login` rejects attempts by users with `mustChangePassword == true` with HTTP 403 Forbidden and code `PASSWORD_CHANGE_REQUIRED`.
  - Dedicated Mobile Password Change Screen (`src/app/(auth)/change-password.js`): Screen 30b providing current password, new password, and confirm password fields with strength meters, visibility toggles, and instant validation.
  - Navigation Guard Coordination: Auth guards in `login.js`, `pin.js`, and `setup-pin.js` intercept flagged users and route directly to `change-password.js`. Upon successful rotation, the provisional session clears and directs staff to log in with their permanent password to initiate device binding.
- Seeder Isolation & Production Guardrails:
  - Added `app.seed.mobile-pins: false` toggle in `DataSeeder.java`. Mobile demo PINs (`1111`, `2222`, `0001`) are only seeded in development/test environments.
  - Startup Validation: Throws `IllegalStateException` if `app.seed.mobile-pins=true` under the `prod` profile, preventing preconfigured test PINs from ever existing in production databases.
- Strict Role Segregation: Administrator accounts (`ADMIN`) are barred from logging into the mobile portal (`/mobile-login`, `/mobile-pin-login`, `/mobile-setup-pin`) with HTTP 403 Forbidden (`"Administrator accounts are restricted to the Web Portal."`), preserving operational boundaries.
- High-Performance Tactile Micro-Animations: Reusable `PressableScale` atom using `Animated.spring` with `useNativeDriver: Platform.OS !== 'web'` providing 60fps mechanical press feedback across numeric keypad, action cards, primary action buttons, and header buttons with zero JavaScript thread latency or layout thrashing.
- Route-Isolated Rate Limiting: Integrated with `LoginRateLimiterService` enforcing progressive lockout partitioned by endpoint, account, and device (5 failed attempts trigger HTTP 429 Too Many Requests with `Retry-After` header and countdown).
- Modular `frontend-mobile/src/` architecture strictly matching `frontend-web` design patterns:
  - `src/theme/`: TNL design tokens (`canvas #F3F2ED`, `ink #1A1A1A`, `accent #C6491F`, `border #E1DFD5`, `keypadBg #EFECE6`).
  - `src/services/storage/`: Hardware-backed `expo-secure-store` wrapper enforcing fail-closed security on native iOS/Android (unencrypted fallbacks rejected), with memory-only store for web previews.
  - `src/services/api/`: Centralized Axios client injecting Bearer tokens, enforcing HTTPS in production, and intercepting 401/403 session revocation.
  - `src/features/auth/`: Encapsulated auth service and `AuthContext` provider handling credential login, password rotation, PIN setup, PIN unlock, session lock, and full unbind logout.
  - `src/components/common/`: Shared UI components (`Keypad`, `PinIndicator`, `PressableScale`, `ActionCard`, `MetricCard`, `NoticeBanner`, `StatusModal`).
  - `src/components/layout/`: `MobileHeader` with role eyebrow, staff name, `LOCK`, and `LOGOUT` triggers.
- Screens & Navigation Flow:
  - Credential Login (`src/app/(auth)/login.js`): Username and password entry with TNL tracking logo, `MOBILE PORTAL` badge, and quick shortcut to PIN unlock if device is already bound.
  - Password Change (`src/app/(auth)/change-password.js`): Mandatory first-boot password change workflow.
  - PIN Setup (`src/app/(auth)/setup-pin.js`): 2-step PIN creation & confirmation flow with 4-dot indicator and 3x4 keypad.
  - Shift Unlock (`src/app/(auth)/pin.js`): Bound staff member card, 4-dot indicator, 3x4 numeric keypad, and "Sign in with another account" link.
  - Role-Aware Shell (`src/app/(main)/index.js`): Authenticated root switching between `OfficeDashboard` (`OFFICE_STAFF`) and `FieldDashboard` (`FIELD_STAFF`).
  - `OfficeDashboard`: Label printing callout, 4 operational action cards (`Find Parcel`, `Register`, `Scan QR`, `Printer`), and daily shift metric counters matching `prototype office page.png`.
  - `FieldDashboard`: Scan-only notice banner, action cards (`Scan QR`, `Tracking History`, `Account`), and daily shift metrics matching `prototype field page.png`.
  - QR Scanner (`src/app/(main)/scan.js`): Viewfinder overlay with camera permissions and status postback.
- Cleared PIN & Re-Authentication Synchronization:
  - Backend `POST /api/v1/auth/mobile-pin-login` explicitly checks if `target.getPinHash() == null`, returning HTTP 409 Conflict with `code: "PIN_NOT_SET"`, without incrementing brute-force rate limiter counters.
  - Added public `GET /api/v1/auth/mobile-pin-status?username={username}` endpoint returning uniform JSON responses with isolated rate limiting to verify PIN configuration without leaking user enumeration signals.
  - Mobile PIN unlock screen (`src/app/(auth)/pin.js`) dynamically verifies bound account PIN status on mount/resume, proactively notifying staff if their PIN was cleared by an administrator.
  - Themed In-App Modals (`StatusModal.js`):
    - Minimalist design with fluid cubic-bezier animations, replacing OS system alerts.
    - Notice Mode: Displays an in-app modal ("PIN Reset by Administrator") explaining that the PIN was reset before redirecting to `(auth)/login` with pre-filled username and `NoticeBanner`.
    - Confirmation Mode: Dual-action confirmation dialogs preventing accidental sign-outs and terminal unbinding ("Cancel PIN Setup?" on `setup-pin.js`, "Switch Account?" on `pin.js`, and "Log Out & Unbind Device?" on `MobileHeader.js`).
  - Session revocation coordination in `apiClient` and `AuthContext` handling HTTP 401 caused by Admin PIN resets (`tokenVersion++`), presenting a revocation notice modal and cleanly routing through password re-authentication and PIN setup.
- Verified via `MobileAuthIntegrationTest.java` (36 integration test scenarios), `ProductionDataSourcePropertiesTest.java` (5 tests), full suite regression test (204 tests passing, 0 failures, 0 errors), and clean Expo Android export.

**6.2 — Office Staff: Shipment Generation & Past Shipments Directory (Screens 34–40)** — **[COMPLETED]**
- **Shipment Generation (`Register`):** Mobile shipment creation matching core business rules:
  - Client selection with inline quick client creation modal.
  - Recipient destination, contact, and address fields with dynamic billing calculations.
  - Parcel unit builder: quantity, physical dimensions ($L \times W \times H\text{ cm}$), auto volume ($m^3$), and billable weight calculation.
  - Pricing model support: `FLAT` vs `PER_PARCEL` charge calculations and immediate payment status recording (`paidAtRegistration`).
  - Sequential ID generation: `SHP-YYYY-XXX` and `TRK-YYYY-XXXXXX`.
- **Past Shipments Explorer (`Find Parcel`):** Comprehensive shipment lookup and inspection:
  - FlatList with server-side SQL pagination (`Pageable`, 20 per page) preventing memory leaks and heap exhaustion.
  - Subheader displaying total shipments count and note that records include shipments registered from the office PC.
  - Filter tabs matching prototype: `RECENT / ALL`, `NEEDS LABEL`, and `SCAN QR` viewfinder.
  - Search input with 250ms debouncing querying by Shipment ID, Client Name, Recipient Name, Contact, or Parcel Tracking ID via JPQL subquery.
  - Shipment summary cards displaying `PC` vs `MOBILE` registration tags, status pill, quantity, contact, and `labels printed` vs `needs label` badges.
  - Detailed shipment view (`ShipmentDetailScreen`, Screen 39): metadata breakdown, client/recipient details, list of parcel units with dimensions, and `PRINT ALL LABELS` / `REPRINT ALL LABELS` action buttons.
  - Single parcel detail view (`ParcelDetailScreen`, Screen 40): `PACKAGE X OF Y` badge, recipient, client, parent shipment navigation link, destination hub, status pill, label status, dimensions pill, `REPRINT LABEL` button, and expandable chronological scan audit timeline.
  - Reusable camera viewfinder scanner modal (`BarcodeScannerModal`) with `expo-camera` supporting QR and Code-128 barcode scanning, camera permission prompts, and manual tracking number entry fallback.
- **Verification & Testing:**
  - Automated integration tests in `ShipmentIntegrationTest.java` verifying search by parcel tracking ID, label status filters (`NEEDS_LABEL`, `PRINTED`), role-gating (`FIELD_STAFF` blocked with HTTP 403, `OFFICE_STAFF` permitted), and summary DTO mapping (`registeredVia`, `allLabelsPrinted`).
  - Automated label print audit tests in `ParcelPrintIntegrationTest.java` (8/8 passing).
  - Frontend Node unit test suites (`tests/registration.test.mjs`, `tests/shipments.test.mjs` - 31/31 passing).
  - Verified clean compilation and bundling across Web, iOS, and Android via `npx expo export`.

**6.3a — Software Label Printing, Virtual Driver Isolation & Audit Hardening (Screens 41–44)** — **[COMPLETED]**
- Vendored Project Nayuki QR Code Generator v1.8.0 under its MIT license, preserving the shared matrix, SVG path, and monochrome BMP interfaces while supporting versions 1–40 and UTF-8 payloads.
- Independent `jsqr` round-trip coverage across short, long, alphanumeric, and Unicode payloads, including limited module damage recovery.
- Strict canonical label normalization using shipment detail fields. Missing tracking, shipment, recipient, address, or destination values stop the print job before transport.
- Printable HTML encodes every dynamic value and validates numeric fields before formatting.
- Explicit virtual and Bluetooth drivers. Virtual/test jobs are visibly marked as simulation and never write backend audit state. The Bluetooth driver reports `TRANSPORT_UNAVAILABLE` for physical transmission until hardware validation is complete.
- Globally serialized mobile print jobs return explicit per-item transmission and audit results. Partial physical success audits only transmitted tracking IDs without retransmitting labels.
- Durable per-user print-audit outboxes use AsyncStorage on mobile and localStorage on web. Audit retries are independent of printer transport and survive application restarts.
- System/PDF printing uses a three-way confirmation: printed successfully records the exact job, saved as PDF preserves `NOT_PRINTED`, and cancelled makes no state change.
- Backend print auditing requires a stable UUID, locks the shipment, validates the complete batch before mutation, and treats exact retries as no-ops while rejecting altered UUID reuse.
- Canonical shipment detail is loaded before registration-result, shipment, or parcel print actions are enabled.
- Fail-closed outbox durability: `AUTH_PAUSED` entries are recovered upon re-authentication; silent 100-entry truncation replaced with a 500-entry capacity limit and `OutboxCapacityError`; storage read failures never overwrite or discard un-synced audit records.
- Runtime security & profile hardening: Removed default `dev` profile and hardcoded fallback `jwt.secret` from `application.properties`, verified via `ProductionDataSourcePropertiesTest`.
- Bounded shipment pagination: Query parameters `page` (clamped >= 0) and `size` (bounded [1..100]) enforced in `ShipmentController.java` to prevent memory exhaustion and invalid page errors.

**6.3b — Physical Bluetooth Integration & Brother RJ-2035B On-Device Validation** — **[UPCOMING]**
- Validate the Expo development build and native Bluetooth bridge on the on-site Brother RJ-2035B.
- Select and verify the printer command language supported by the deployed hardware, including QR/raster output, paper width, feed, tear position, reconnect behavior, and partial transmission reporting.
- Add device-backed acceptance evidence before enabling production Bluetooth label transmission.

**6.4 — Field Staff: Camera QR Scanner & Status Flow Engine (Screens 45–48)** — **[COMPLETED]**
- Real-time camera viewfinder QR and Code-128 scanner (`expo-camera`) with torch toggle, four-corner orange reticle, horizontal scan line, safe platform-guarded haptics (`expo-haptics`), and manual `TRK-YYYY-NNNNNN` entry fallback with a compact `GO` button.
- Dedicated scan context endpoint (`GET /api/v1/tracking-events/scan-context/{trackingId}`) role-gated strictly to `FIELD_STAFF` (`@PreAuthorize("hasRole('FIELD_STAFF')")`), providing parcel identity, sequence (`PACKAGE X OF Y`), current status, proposed next status, and vehicle requirements while stripping recipient, address, billing, and payment PII.
- Strict status flow engine with sequential transition validation (`REGISTERED` → `QR_GENERATED` → `LOADED_ON_TRUCK` → `ARRIVED_AT_TNL` → `LOADED_TO_HAULER`); terminal states `LOADED_TO_HAULER` and `COMPLETED` expose `canScan = false` with no mutation actions.
- Mandatory active vehicle fleet enforcement: `LOADED_ON_TRUCK` requires an active vehicle from `GET /api/v1/vehicles`; transitioning to `ARRIVED_AT_TNL` or `LOADED_TO_HAULER` safely clears the parcel's current vehicle assignment while preserving historical audit events.
- Single scan workflow (`POST /api/v1/tracking-events/scan`): context review, vehicle selector, submission progress indicators, inline lookup recovery, and idempotent retry detection (`transitionApplied = false` creating zero duplicate tracking events).
- Rapid batch workflow (`POST /api/v1/tracking-events/batch-scan`): operation selector, fleet selector, 100-item queue with duplicate prevention and 750ms camera cooldown, deadlock-free sorted pessimistic locking, pre-validation of all transitions before entity mutation, atomic transaction rollback on failure, selective inactive vehicle idempotency, and discard confirmation navigation guards (`beforeRemove`).
- Real-time SSE broadcast synchronization: tracking events are published to connected clients strictly after transaction commit via Spring's `TransactionSynchronizationManager.afterCommit()`, preventing phantom broadcasts from rolled-back batches.
- Verification & Testing: 26 integration tests in `TrackingScanIntegrationTest.java` (244/244 backend tests passing), 33 frontend unit tests in `tests/scanner.test.mjs` (82/82 mobile tests passing), and clean multi-platform production export via `npx expo export` (Web, Android, iOS).

**6.5 — Field Staff: Personal Scan & Tracking History (Screens 49–52)** — **[IN PROGRESS]**
- Flyway migration `V29__add_personal_tracking_history_indexes.sql`: composite performance indexes on `tracking_event` (`staff_id, event_timestamp, event_id` and `staff_id, tracking_id, event_timestamp, event_id`) optimizing personal feed sorting, shift metric counters, and parcel ownership checks.
- Dedicated personal activity feed REST endpoints role-gated strictly to `FIELD_STAFF` (`@PreAuthorize("hasRole('FIELD_STAFF')")`):
  - `GET /api/v1/tracking-events/mine` — Server-side paginated personal scan feed (`page`, `size` [1..50], `status`, `search` filtering).
  - `GET /api/v1/tracking-events/mine/metrics` — Daily shift metrics (Total Scans Today, Loaded on Truck, Arrived at TNL, Handed to Hauler) evaluated strictly within the server-local calendar day boundary (`LocalDate.now()`).
  - `GET /api/v1/tracking-events/mine/parcels/{trackingId}` — Operational parcel inspection and chronological personal scan timeline.
- Strict Privacy & Data Boundary Enforcement:
  - Zero PII Exposure: `PersonalTrackingEventResponse`, `PersonalScanMetricsResponse`, and `PersonalParcelHistoryResponse` strictly exclude recipient name, client name, addresses, contact numbers, remarks, billing/payment data, and print events.
  - Personal Scoping: Staff identity is derived solely from the authenticated JWT principal (`authentication.getName()`); no staff ID parameters are accepted from untrusted clients.
  - Generic Parcel Detail PII Bypass Closed: Updated `GET /api/v1/parcel-units/{trackingId}` in `ParcelUnitController` to `@PreAuthorize("hasAnyRole('ADMIN', 'OFFICE_STAFF')")`, blocking `FIELD_STAFF` from retrieving sensitive customer data.
  - Parcel Scan Ownership Gating: Field staff can only view operational details for parcels they have personally scanned (`hasStaffScannedParcel`). Unowned parcels return HTTP 404 Not Found (matching nonexistent parcels to prevent tracking ID enumeration).
- Mobile Implementation & UI (Screens 49–52):
  - Pure, testable business logic in `src/features/tracking-history/trackingHistoryFlow.mjs` (query normalization, server pagination merging with duplicate suppression, shift metrics mapping, timestamp and package formatters without fabricated fallbacks, sync status metadata, and `replacePageZeroEvents`).
  - API client `src/features/tracking-history/services/trackingHistoryApi.js` leveraging centralized `apiClient`.
  - Main history screen (`src/app/(main)/tracking-history/index.js`): 2x2 daily shift metrics grid matching `prototype field tracking page.png`, debounced search input, server pagination (`HISTORY_PAGE_SIZE = 20`) coordinated with pure request coordinator (`trackingHistoryRequestCoordinator.mjs`) managing abort controllers, query generation version tokens, and pagination locks, pull-to-refresh, empty and error states with retry, and role guard.
  - Selected parcel screen (`src/app/(main)/tracking-history/[trackingId].js`): operational parcel summary card matching `prototype field tracking selected.png`, `SHOW/HIDE MY HISTORY` collapsible toggle, chronological personal scan timeline with orange dots and vertical connector lines, non-looping focus refresh, and 404 handling.
  - Components: `PersonalScanMetrics`, `PersonalTrackingEventCard`, `PersonalParcelSummary`, `PersonalTrackingTimeline`, `SyncStatusBadge` (with zero fabricated operational defaults).
  - Wired navigation in `(main)/_layout.js` Stack navigator and hooked `FieldDashboard.js` `handleTrackingHistory` action.
- Verification & Testing:
  - Automated integration test suite in `PersonalTrackingHistoryIntegrationTest.java` (18 tests covering all 6 supported statuses, pagination completeness without omissions, equal-timestamp `eventId DESC` sorting, field-owned QR metric increment, role gating, and PII exclusion).
  - Mobile unit test suite in `tests/trackingHistory.test.mjs` (26 tests covering all pure helpers, non-fabricated package/status fallbacks, page-zero replacement, and request coordinator lifecycle; 108 tests passing total).
  - Clean Expo production exports across Web, Android, and iOS.
  - Status remains `[IN PROGRESS]` pending physical device verification on deployed field hardware.

**6.6 — Offline Resilience & SQLite Scan Queue (Screen 53)**
- Local SQLite database queue for buffering parcel status scans performed without cellular coverage.
- Connectivity listener (`@react-native-community/netinfo`) with automatic background batch sync (`POST /api/v1/tracking-events/batch-scan`) upon network restoration.
- Visual pending upload badge and sync status banner on the courier's personal scan history.
