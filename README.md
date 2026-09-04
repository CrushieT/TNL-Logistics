# TNL Logistics — Enterprise Multi-Platform Freight Management System

[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4.2-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-21%20%2F%2023-ED8B00?logo=openjdk&logoColor=white)](https://www.oracle.com/java/)
[![Expo](https://img.shields.io/badge/Expo-52.0-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-Web%20%26%20Mobile-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Flyway](https://img.shields.io/badge/Flyway-Database_Migrations-CC0200?logo=flyway&logoColor=white)](https://flywaydb.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**TNL Logistics** is a production-grade commercial logistics and freight forwarding platform engineered as a **Unified Modular Monolith**. It connects a robust Spring Boot 3.4 REST backend with an Expo Web administration console and a React Native mobile field staff scanner app over a single shared MySQL database and a real-time Server-Sent Events (SSE) streaming pipeline.

---

## Executive Summary & Core Capabilities

Commercial freight forwarding requires strict chain-of-custody tracking, legal proof of delivery, decoupled billing states, and real-time inventory visibility across warehouse hubs. TNL Logistics delivers:

* **Real-Time Parcel Lifecycle Tracking:** Strict sequential 5-state transition engine (`Registered` → `QR Generated` → `Loaded on Truck` → `Arrived at TNL` → `Loaded to Hauler`) with append-only audit event logging.
* **Automated Volumetric Calculation:** Automatic volumetric weight derivation ($\frac{L \times W \times H\text{ cm}}{5000}$) and total $m^3$ cubic volume computation against actual scale weight.
* **Instant Vector QR Label Generator:** Generates high-contrast thermal printable label cards with encoded sequential tracking numbers (`TRK-YYYY-XXXXXX`).
* **Intelligent Fleet Registry & Smart Delete:** Live on-truck cargo counters with $0\text{ms}$ SSE auto-updates and a hybrid smart deletion engine (hard delete for unused entries, soft deactivation for vehicles with delivery audit history).
* **Waybill & Manifest Handover Workflow:** Sequential `WYB-YYYY-XXXX` manifest generation for legal 3rd-party hauler custody turnover and Proof of Delivery (POD).
* **Role-Based Access Control (RBAC):** Granular permission boundaries separating `ADMIN`, `OFFICE_STAFF`, and scan-only `FIELD_STAFF`.

---

## System Architecture

```text
                                  ┌────────────────────────────────┐
                                  │       MySQL 8.0 Database       │
                                  │   (Flyway Migrations V1-V8)    │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                        ┌──────────────────────────────────────────────────┐
                        │          Spring Boot 3.4 Backend Service         │
                        │    • REST API (Port 8080)   • SSE Event Stream   │
                        │    • JWT Stateless Auth     • Hibernate JPA      │
                        └─────────────┬──────────────────────┬─────────────┘
                                      │                      │
                   HTTP REST / SSE    │                      │  HTTP REST / SSE
                                      ▼                      ▼
┌──────────────────────────────────────────────┐    ┌─────────────────────────────────────────────┐
│       Frontend Web Portal (Expo Web)         │    │       Frontend Mobile App (Expo Mobile)     │
│   • Operations: Shipments, Fleet, Tracking   │    │   • Camera Barcode / QR Scanner             │
│   • Billing: Collections, Waybills, SOA      │    │   • Active Vehicle Pickup on Truck Load     │
│   • Admin: Metrics, Reports, User Staff      │    │   • Offline Scan Queue (SQLite fallback)    │
└──────────────────────────────────────────────┘    └─────────────────────────────────────────────┘
```

---

## The 4 Independent Status Dimensions (Rule 19)

Unlike simplistic CRUD apps that conflate tracking and accounting into a single enum, TNL Logistics models the 4 physical realities of cargo independently:

```text
1. Tracking Status (5-State):
   [Registered] ──► [QR Generated] ──► [Loaded on Truck] ──► [Arrived at TNL] ──► [Loaded to Hauler]

2. Payment Status:
   [Unpaid] ────────► [Partially Paid] ────────► [Paid] (and [For Collection] batch)

3. Label Status:
   [Not Printed] ───► [Printed] ───────────────► [Reprinted]

4. Waybill Custody Lifecycle (4-State):
   [Not Generated] ─► [Generated] ─────────────► [Sent to Hauler] ────────► [Signed / POD Completed]
```

---

## Current Implementation Status & Roadmap

| Phase | Milestone Description | Status | Key Deliverables |
| :--- | :--- | :---: | :--- |
| **Phase 0** | **Foundation & Security** | `[COMPLETED]` | Spring Boot 3.4, Flyway migrations `V1`–`V9`, MySQL 8, JPA models, stateless JWT auth with 3 roles (`ADMIN`, `OFFICE_STAFF`, `FIELD_STAFF`). |
| **Phase 1** | **Shipment Registration & QR Labels** | `[COMPLETED]` | Sequential IDs (`SHP-YYYY-XXX`, `TRK-YYYY-XXXXXX`), volumetric weight ($\div 5000$) & $m^3$ calculations, vector thermal QR labels, paginated table, tracking inspection. |
| **Phase 2** | **Status Flow, Real-Time SSE, Fleet & Client Management** | `[COMPLETED]` | Sequential 5-state transition engine, live SSE stream, vehicle fleet CRUD (`VH-XXX`), client directory & profile view (`CL-XXX`), smart deletion, composite indexing, and batch aggregation. |
| **Phase 3** | **Waybills & Freight Manifest Handover** | `[COMPLETED]` | `WYB-YYYY-XXXX` auto-numbering, 4-state lifecycle (`Generated` → `Sent to Hauler` → `Signed/Completed`), and print-ready A4 3rd-party hauler manifest. |
| **Phase 4** | **Billing, Collections & Statement of Account** | `[COMPLETED]` | Payment ledger (`/payments`), Thursday weekly collections consolidation (`/weekly-collections`), `SOA-YYYY-XXX-WXX` multi-page statement preview (`/statements`), isolated print architecture (`/statements/print`), deduction management, and dynamic active cycle filtering. |
| **Phase 5** | **Web Console Administration & Reports** | `[IN PROGRESS]` | Desktop login with branded artwork, route guarding, and in-memory rate limiting (`[COMPLETED]`). Upcoming: Live operational dashboard metrics, audit tracking logs stream, staff management, and reports. |
| **Phase 6** | **Role-Aware Mobile Courier Portal** | `[UPCOMING]` | Mobile PIN auth with role branching (scan-only field staff vs authorized office mobile), camera QR scanner, and Bluetooth thermal printer integration. |

---

## Monorepo Layout

```text
logistics/
├── backend/                               # Spring Boot 3.4.2 REST API
│   ├── src/main/java/com/tnl/logistics/
│   │   ├── config/                        # SecurityConfig, JWT Provider, WebMvcConfig
│   │   ├── controller/                    # REST API Controllers (Shipments, Vehicles, Clients, Payments, Collections, SOA)
│   │   ├── dto/                           # Request & Response Data Transfer Objects
│   │   ├── model/                         # JPA Entities (Shipment, ParcelUnit, Vehicle, Client, Payment, Soa, WeeklyCollection)
│   │   ├── repository/                    # Spring Data Repositories & Group By Aggregations
│   │   └── service/                       # Business Service Contracts & Implementations (impl/)
│   └── src/main/resources/
│       ├── db/migration/                  # Versioned Flyway DB Migrations (V1 to V12)
│       └── application-dev.yml            # Environment Configuration
│
├── frontend-web/                          # Expo / React Native Web Admin Portal
│   ├── src/
│   │   ├── app/                           # Expo Router Screens (/, /shipments, /vehicles, /clients, /payments, /weekly-collections, /statements, /statements/print)
│   │   ├── components/                    # Common UI Components (Cards, Buttons, Badges, Layout Shell)
│   │   ├── features/                      # Domain Features (shipments, vehicles, clients, payments, collections)
│   │   ├── services/api/                  # Axios Client with Self-Healing JWT Auto-Auth & SSE Event Subscriptions
│   │   └── theme/                         # Design System Tokens (Colors, Typography, Spacing)
│   └── package.json
│
├── frontend-mobile/                       # Expo / React Native Field Courier Portal
│   └── src/                               # Camera QR Scanner, Field Actions & Thermal Printer
│
├── .docs/                                 # Logistics Blueprint & Schema Specifications
│   └── prototype/                         # Desktop & Mobile Screen Prototypes
│
└── docker-compose.yml                     # Local MySQL & Services Orchestration
```

---

## Key Engineering Highlights

### 1. Zero $N+1$ Database Query Aggregation
Fleet and Client management calculate real-time metrics using single batch `GROUP BY` queries mapped in $O(1)$ memory:
```java
@Query("SELECT p.currentVehicle.vehicleId, COUNT(p) FROM ParcelUnit p " +
       "WHERE p.currentStatus = :status AND p.currentVehicle IS NOT NULL " +
       "GROUP BY p.currentVehicle.vehicleId")
List<Object[]> countLoadedParcelsGroupedByVehicle(@Param("status") ParcelStatus status);
```
*Cuts database round-trips from $N+1$ queries to **2 queries flat**, backed by Flyway `V8` and `V9` composite B-Tree indexes.*

### 2. Hybrid Smart Deletion Safety
Deletes protect database foreign keys while keeping records clean:
* **Unused Records (0 Historical Operations):** Executes a permanent **Hard Delete**, removing accidental inputs without database residue.
* **Records with Audit History (1+ Operations):** Executes a **Soft Deactivation** (`active = false`), safeguarding past invoices, waybills, and proof of delivery audit trails.

### 3. Server-Sent Events (SSE) Live Pipeline
When field staff scan a parcel with their phone, an append-only event is committed and broadcast over `/api/v1/events/stream`. The desktop web console silently refreshes metrics, parcel timelines, and vehicle counters in $0\text{ms}$ without page reloads.

---

## REST API Reference Summary

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/v1/auth/login` | `POST` | Public | Authenticate user with in-memory rate limiting (5 attempts/60s) and receive JWT |
| `/api/v1/shipments` | `POST` | Office/Admin | Register shipment with parcels, pricing, and QR codes |
| `/api/v1/shipments` | `GET` | All Staff | Paginated shipments search with status & payment filters |
| `/api/v1/shipments/{id}` | `GET` | All Staff | Detailed shipment view with billable weight & dimension specs |
| `/api/v1/parcel-units/{id}` | `GET` | All Staff | Individual parcel inspection and scan timeline history |
| `/api/v1/tracking-events/scan` | `POST` | Field/Office | Strict sequential scan status advance with vehicle assignment |
| `/api/v1/vehicles` | `GET` | All Staff | Fleet registry with real-time `ON TRUCK` parcel counts |
| `/api/v1/vehicles` | `POST` | Office/Admin | Register new vehicle with auto-generated `VH-XXX` ID |
| `/api/v1/vehicles/{id}` | `PUT` | Office/Admin | Update vehicle plate, type, status, and remarks |
| `/api/v1/vehicles/{id}` | `DELETE` | Office/Admin | Smart Delete (Hard delete unused / Soft deactivation) |
| `/api/v1/clients` | `GET` | Office/Admin | Paginated client directory or full active billing party list |
| `/api/v1/clients/{id}` | `GET` | Office/Admin | Detailed client profile with financial balance rollup and shipments |
| `/api/v1/clients` | `POST` | Office/Admin | Register new client with auto-generated `CL-XXX` ID |
| `/api/v1/clients/{id}` | `PUT` | Office/Admin | Update client contact details, rate type, and active status |
| `/api/v1/clients/{id}` | `DELETE` | Office/Admin | Smart Delete client (Hard delete unused / Soft deactivation) |
| `/api/v1/payments` | `GET` | Office/Admin | Paginated payment transactions directory with status filters |
| `/api/v1/payments` | `POST` | Office/Admin | Record payment transaction (Cash, GCash, Bank Transfer, Cheque) |
| `/api/v1/collections/weekly` | `GET` | Office/Admin | Thursday weekly collections consolidation summary and itemized client list |
| `/api/v1/collections/cycles` | `GET` | Office/Admin | List of distinct Thursday cycles containing registered shipments |
| `/api/v1/soa/preview` | `GET` | Office/Admin | Statement of Account preview with itemized shipments and financial rollup |
| `/api/v1/soa/save` | `POST` | Office/Admin | Persist statement with deductions, notes, and authorized collector |
| `/api/v1/soa/collectors` | `GET` | Office/Admin | List of active authorized collectors for statement attribution |
| `/api/v1/events/stream` | `GET` | All Staff | Server-Sent Events real-time event subscription stream |

---

## Getting Started

### Prerequisites
* **Java:** JDK 21 or JDK 23
* **Node.js:** v18+ & npm
* **MySQL:** 8.0+ (or Docker)
* **Maven:** 3.9+

### 1. Start the Database & Backend
```bash
# Option A: Run MySQL via Docker Compose
docker-compose up -d mysql

# Option B: Native MySQL
# Ensure MySQL is running on localhost:3306 with database `tnl_dev`

# Start Spring Boot Application
cd backend
mvn spring-boot:run
```
*API will run at `http://localhost:8080` (Flyway auto-runs all migrations `V1` to `V16` on startup).*

### 2. Start the Admin Web Dashboard
```bash
cd frontend-web
npm install
npx expo start --web
```
*Open `http://localhost:8081` in your browser.*

### 3. Run Automated Tests
```bash
cd backend
mvn test
```
*Runs all 21 unit, repository, security, and SSE integration tests.*

---

## Default Development Accounts

| Username | Password | Role | Permitted Workflows |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | `ADMIN` | Full System Access, Fleet Management, Financials & Reports |
| `office` | `office123` | `OFFICE_STAFF` | Shipment Encoding, Pricing, Label Printing, Waybills |
| `field` | `field123` | `FIELD_STAFF` | Scan-Only Mobile Mode (`Loaded on Truck`, `Arrived at TNL`) |

---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
