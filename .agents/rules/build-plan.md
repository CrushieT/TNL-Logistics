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
| **Phase 4.3** | Web: Billing, Collections & Printable SOA (Desktop Screens 18–22) | [IN PROGRESS] |
| **Phase 5** | Web Console: Live Dashboard, Tracking Logs Stream, Reports, Users & Settings (Screens 01, 02, 17, 26–28) | [UPCOMING] |
| **Phase 6** | Role-Aware Mobile App: Scan-Only Field Staff vs. Authorized Office Mobile + Bluetooth Printing (Screens 29–53) | [UPCOMING] |

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
- HMAC-SHA256 stateless JWT token provider with BCrypt password hashing.
- 3 distinct system roles: `ADMIN`, `OFFICE_STAFF`, `FIELD_STAFF`.
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

**4.3 — Web: Billing, Collections & Printable SOA (Desktop Screens 18, 19, 20, 21, 22)**  — **[IN PROGRESS]**
- **Payment Management (Screen 18) — [COMPLETED]:**
  - `/payments` directory table with payment status filter (`Unpaid`, `Partial`, `Paid`), multi-search (Shipment ID, Client Name, Recipient), and real-time outstanding balance metric card.
  - "Record Payment" modal with real-time balance ceiling restriction, dynamic reference validation (`*` for `GCASH`, `BANK`, `CHEQUE`), and SSE live refresh.
  - "Payment History" modal (`View` action) with itemized compounding installment ledger, date stamps, staff attribution, and financial summary.
  - Fixed-slot action column layout (`View`, `Record →`, `Settled`) to eliminate horizontal row jitter.
- **Weekly Collections (Screen 19) — [IN PROGRESS]:** `/collections` Thursday consolidation dashboard with 4 metric cards (Total Due, Collected, Outstanding, Clients), target Thursday selector, and client collection status table.
- **Consolidated SOA Preview (Screen 20) — [IN PROGRESS]:** `/collections/[clientId]` unbilled shipment breakdown for the billing cycle with itemized table and "Apply Deduction" modal (supporting `BAD_ORDER`, `DISCREPANCY`, `CLAIM`).
- **Detailed Statement View (Screen 21) — [IN PROGRESS]:** `/soa/[soaNo]` full digital Statement of Account with client info header, line items, deduction credits, and remittance calculation summary.
- **Printable SOA & Batch Export (Screen 22) — [IN PROGRESS]:** Formal print layout with runtime CSSOM extraction, `@page { size: landscape / portrait; margin: 0; }`, signature blocks (Prepared by, Checked by, Received by), and multi-client batch export.

---

## Phase 5 — Web Console: Dashboard, Reports & Administration (Desktop Screens 01, 02, 17, 26–28)
*Operational dashboards and administrative controls.*

**5.1 — Desktop Login & Route Protection (Screen 01)**
- Production Login screen with username/password authentication, JWT storage, and session logout in Sidebar.

**5.2 — Dashboard Live Metrics (Screen 02)**
- Live operational cards: Today's Shipments, Total Parcels, Pending Delivery, Active Fleet count, and Weekly Revenue.

**5.3 — Global Tracking Logs Audit Feed (Screen 17)**
- Company-wide real-time audit stream showing every parcel scan, timestamp, acting staff member, and vehicle assignment (auto-updating via SSE).

**5.4 — Operational & Financial Reports (Screen 26)**
- Date-range filterable reports: Daily shipment volume, revenue by client, status distributions, and exportable summaries.

**5.5 — User & Staff Management (Screen 27)**
- Staff directory (`/users`), create user modal, role assignment (`ADMIN`, `OFFICE_STAFF`, `FIELD_STAFF`), and password reset.

**5.6 — System Settings (Screen 28)**
- Company information, collection day configuration, and volumetric weight divisor adjustment (default $5000$).

---

## Phase 6 — Role-Aware Mobile Courier Portal (Mobile Screens 29–53)
*Field staff courier app and authorized mobile office workflows.*

**6.1 — Mobile PIN Login & Role-Aware Shell (Screens 29, 30, 31, 32, 33)**
- PIN-based authentication. The user's role decides what the app becomes (Rule 17):
  - **Field Staff (`FIELD_STAFF`):** Opens directly into **Scan-Only** mode (`Scan`, `History`, `Account`). Blocked from registration, printing, and billing.
  - **Office Staff (`OFFICE_STAFF`):** Opens into full mobile workflow (`Find`, `Register`, `Scan`, `Printer`, `Account`).

**6.2 — Authorized Mobile Registration & Bluetooth Thermal Printing (Screens 34–44)**
- Office-authorized mobile shipment registration on site.
- Bluetooth thermal printer pairing (Brother RJ-2035B), print single/batch labels, and reprint parcel QR stickers.

**6.3 — Field Staff Scan & Track Engine (Screens 45–52)**
- Camera QR scanner (`expo-camera`) and manual Tracking ID lookup.
- Valid next action confirmation with active truck dropdown selector on `Loaded on Truck`.
- Append-only audit confirmation and per-unit scan history.

**6.4 — Mobile Offline Scan Queue (SQLite)**
- Local SQLite cache for scans performed without cellular coverage.
- Automatic background synchronization when network connectivity resumes.