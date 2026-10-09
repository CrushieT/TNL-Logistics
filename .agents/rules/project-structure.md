# Project Structure

**TNL Logistics uses a monorepo layout with three independent codebases sharing a common backend API.**

### Complete Directory Structure

```
tnl-logistics/
├── .review/                          # Planning, discovery, threat-model, and implementation-review artifacts
│   ├── client-demo-change-plan.md
│   ├── client-demo-phase-0-discovery-and-threat-model.md
│   ├── client-demo-phase-1-registration-and-rating-plan.md
│   ├── client-demo-phase-1.1-client-rate-override-plan.md
│   ├── four-role-authorization-migration-plan.md
│   ├── four-role-ship-runbook.md
│   └── railway-deployment-runbook.md
├── .agents/
│   └── rules/
│       ├── build-plan.md             # Master development roadmap & progress tracking
│       ├── git-conventions.md        # Git workflow, branch naming & commit rules
│       ├── hardening-plan.md         # Post-review system hardening & lifecycle remediation plan
│       ├── karpathy-guidelines.md    # LLM coding best practices
│       └── project-structure.md      # Project directory layout & philosophies
├── .github/
│   ├── pull_request_template.md      # GitHub Pull Request template
│   ├── PR_DRAFT.md                   # Current shipping-task handoff draft
│   └── workflows/                    # GitHub Actions CI/CD workflows
│       ├── ci.yml                    # Monorepo CI Pipeline (Backend, Web, Mobile)
│       ├── dependency-review.yml     # Fast PR dependency vulnerability checks
│       └── owasp-check.yml           # Scheduled and on-demand OWASP backend vulnerability scan
├── backend/                          # Spring Boot API (Java 21)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/tnl/logistics/
│   │   │   │   ├── config/              # SecurityConfig, JwtRenewalResponseWrapper, CorsConfig, JwtTokenProvider, DataSeeder, LoadTestDataSeeder, LoadTestEnvironmentGuard
│   │   │   │   ├── controller/          # REST endpoints (Shipment, Vehicle, Client, Waybill, Payment, Collections, SOA)
│   │   │   │   ├── dto/                 # Request & Response DTOs (including CurrentUserResponse and MobileDeviceBindingSummary)
│   │   │   │   ├── model/               # JPA Entities (Client, Shipment, ParcelUnit, Vehicle, Waybill, Payment, Soa, MobileDeviceBinding, etc.)
│   │   │   │   ├── repository/          # Spring Data repositories, including pessimistic user and device-binding authentication queries
│   │   │   │   └── service/             # Business logic, including AuthSecurityService and transactional implementation (impl/)
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       ├── application-dev.properties
│   │   │       ├── application-loadtest.properties
│   │   │       └── db/migration/        # Flyway versioned SQL migrations (V1 to V36; V36 cuts over to four authorization roles)
│   │   └── test/                        # Integration and unit test suites, including FourRoleAuthorizationIntegrationTest, AdminConsoleAuthorizationIntegrationTest, and scanner API coverage
│   └── pom.xml
│
├── frontend-web/                    # Admin Web Portal (React Native Web / Expo Router)
│   ├── src/
│   │   ├── app/                     # File-based routes
│   │   │   ├── _layout.js           # Root Stack navigator & Central Route Guard
│   │   │   ├── +not-found.js        # Catch-all 404 Route Not Found operations card
│   │   │   ├── setup.js             # Screen 01b First Boot Admin Setup Wizard
│   │   │   ├── login.js             # Screen 01 Desktop Login with TC & CT branding
│   │   │   ├── change-password.js   # Mandatory Password Change screen
│   │   │   ├── index.js             # Dashboard
│   │   │   ├── register.js          # Register Shipment (form + result view)
│   │   │   ├── shipments/           # Shipments list and detail views
│   │   │   ├── vehicles.js          # Vehicle fleet management
│   │   │   ├── clients/             # Client directory & profile views
│   │   │   │   ├── index.js         # Screen 15 Client Directory Table
│   │   │   │   └── [id].js          # Screen 16 Single Client Profile View
│   │   │   ├── tracking-logs.js     # Screen 17 Global Tracking Logs audit stream
│   │   │   ├── payments.js          # Screen 18 Payment recording & installment ledger
│   │   │   ├── weekly-collections.js# Screen 19 Weekly Collections consolidation dashboard
│   │   │   ├── statements.js        # Screen 20 Statement of Account (SOA) preview & deductions
│   │   │   ├── statements/
│   │   │   │   └── print.js         # Screen 22 Dedicated isolated printable SOA document
│   │   │   ├── waybills/            # Waybills & printable manifest
│   │   │   │   ├── index.js         # Paginated admin waybill directory
│   │   │   │   └── [id].js          # Dedicated printable waybill manifest detail
│   │   │   ├── reports.js           # Screen 26 Operational & Financial Reports
│   │   │   ├── reports/
│   │   │   │   └── print.js         # Dedicated isolated printable report document
│   │   │   ├── users.js             # Screen 27 User & Staff Management
│   │   │   └── settings.js          # Screen 28 System Settings
│   │   ├── components/              # Shared design system (common/ atoms, layout/ AppShell)
│   │   ├── features/                # Domain modules
│   │   │   ├── shipments/           # ClientSelectDropdown, ParcelUnitsEditor, ShipmentPricingSummary, parcelPagination.mjs, registrationCalculations.mjs, PrintLabelsModal, LabelPreview, durable outbox & isolated thermal print service
│   │   │   ├── reports/             # Operational & financial report cards, PrintableReportDocument, reportPrintModel.mjs
│   │   │   ├── collections/         # SOA components, API services, pagination, and hardened two-copy statementPrintModel.mjs
│   │   │   ├── waybills/            # Waybill table, manifest, directory helpers, API client, and two-copy print service
│   │   │   └── settings/            # Settings components plus shared SOA bank-detail normalization and validation
│   │   ├── services/api/            # Core infrastructure (client.js with JWT auth & role protection, sessionCore.mjs, sseClient.js, sseClientCore.mjs)
│   │   ├── theme/                   # Design tokens (colors, fonts, typography, spacing)
│   │   ├── utils/                   # Shared QR facade
│   │   └── vendor/qrcodegen/        # Vendored Project Nayuki QR generator
│   ├── tests/                       # Web unit suites, including waybill directory, route, and two-copy print coverage
│   ├── assets/                      # favicon.png, tracking-logo.png
│   ├── app.json                     # Expo web configuration
│   ├── package.json
│   └── README.md
│
├── frontend-mobile/                  # React Native (Expo) Field Operations (JavaScript)
│   ├── src/
│   │   ├── app/                      # File-based routes
│   │   │   ├── _layout.js            # Root Stack navigator & AuthProvider
│   │   │   ├── (auth)/
│   │   │   │   ├── login.js          # Username & password device binding
│   │   │   │   ├── change-password.js# Screen 30b Mandatory Password Change
│   │   │   │   ├── setup-pin.js      # Mobile PIN creation & confirmation
│   │   │   │   └── pin.js            # Screen 29 PIN quick shift unlock
│   │   │   └── (main)/
│   │   │       ├── _layout.js        # Authenticated route guard
│   │   │       ├── index.js          # Role-aware home (Office vs Field Dashboard)
│   │   │       ├── register.js       # Screen 34 Mobile Shipment Registration
│   │   │       ├── printer.js        # Screens 41–44 Printer Setup & Connection Manager
│   │   │       ├── shipments/        # Past Shipments Explorer
│   │   │       │   ├── index.js      # Screen 38 Find Parcel & Shipments Directory
│   │   │       │   ├── [id].js       # Screen 39 Shipment Parcel Units Breakdown
│   │   │       │   └── parcel/
│   │   │       │       └── [trackingId].js # Screen 40 Single Parcel Details & Scan Audit Timeline
│   │   │       ├── scan.js           # Screen 45 online-only camera QR scanner with in-memory Rapid Batch
│   │   │       ├── waybills.js       # Hauler Staff split waybill loading, Rapid Batch manifest queue, expo-print 2-copy A4 printing, driver handover, and return scan verification
│   │   │       ├── settings/          # Screens 53–55 Mobile Account & Security
│   │   │       │   ├── index.js       # Screen 53 account, session, and bound-device overview
│   │   │       │   ├── password.js    # Screen 54 in-app password rotation
│   │   │       │   └── pin.js         # Screen 55 password-authorized 4-digit PIN rotation
│   │   │       └── tracking-history/ # Screens 49–52 Field Staff Personal Scan History
│   │   │           ├── index.js      # Screen 49–50 Personal Scan Feed & Shift Metrics
│   │   │           └── [trackingId].js # Screen 51–52 Operational Parcel Details & Personal Timeline
│   │   ├── components/               # Shared UI atoms (BackButton, Keypad, PinIndicator, PressableScale, ActionCard, MetricCard, NoticeBanner, StatusModal, QRCodeGenerator, ThermalLabelPreviewModal)
│   │   │   ├── common/
│   │   │   └── layout/               # MobileHeader
│   │   ├── features/                 # Domain feature slices (auth, office, field, shipments, printer, scanner, tracking-history, waybills, settings)
│   │   │   ├── auth/services/        # Auth API, secure storage transitions, and pure cold-launch/PIN lifecycle helpers
│   │   │   ├── settings/             # Account/security flow helpers and reusable settings components
│   │   │   ├── shipments/            # Shipment registration with ParcelUnitsEditor and parcelPagination helpers, explorer, detail screens, and barcode scanner modal
│   │   │   ├── printer/              # Driver isolation, audit outbox, ESC/POS formatter, and serialized PrinterContext
│   │   │   ├── scanner/              # Field camera scanner (ScanViewfinder, SingleScanReview, BatchScanPanel, ScanResultPanel, scannerFlow.mjs, trackingScanApi.js, haptics.js, hapticsCore.mjs)
│   │   │   ├── waybills/             # Split waybill client (waybillApi.js) and 2-copy portrait A4 print generator (printWaybill.mjs)
│   │   │   ├── tracking-history/     # Field personal scan feed, metrics, parcel summary, personal timeline, pure flow logic (trackingHistoryFlow.mjs), request coordinator (trackingHistoryRequestCoordinator.mjs), and API client (trackingHistoryApi.js)
│   │   ├── services/
│   │   │   ├── api/                  # Axios client plus sessionHandling.mjs retry and redaction helpers
│   │   │   └── storage/secureStore.js# Hardware-backed SecureStore adapter
│   │   ├── theme/index.js            # TNL design tokens (canvas, ink, accent, keypad)
│   │   ├── utils/                    # QR matrix, SVG path, and BMP facade
│   │   └── vendor/qrcodegen/         # Vendored Project Nayuki QR generator
│   ├── tests/                        # Mobile unit suites, including auth security, cold-launch lock, scanner connectivity, and tracking history coverage
│   ├── app.json                      # Expo configuration
│   ├── eas.json                      # EAS Build configuration
│   ├── package.json                  # Dependencies (including expo-camera, expo-haptics, expo-crypto, and NetInfo)
│   ├── .env.example
│   └── README.md
│
├── load-tests/                       # Synthetic load and performance testing suite (smoke.js, baseline.js, realistic-simulation.js, README.md)
├── docker-compose.yml                # Local dev: MySQL + Backend
├── docker-compose.loadtest.yml       # High-volume load test environment: MySQL + Backend (loadtest profile, 512M/0.5 vCPU limits)
├── .env.loadtest.example             # Template credentials and configuration for load-testing stack
├── THIRD_PARTY_NOTICES.md            # Vendored dependency attribution and licensing
├── .gitignore                        # Root-level git ignore
└── README.md                          # Project overview & quick start
```

### Four-role client adoption additions

- `frontend-web/src/features/users/userRoles.mjs`: explicit Admin/Receiving/Courier/Dispatch presentation metadata and role-only create/update request builders.
- `frontend-web/tests/userRoles.test.mjs`: Admin user-management role selection, payload omission, and legacy-role rejection coverage.
- `frontend-mobile/src/features/auth/services/roleAccess.mjs`: fail-closed mobile identity parsing, role labels, primary workflows, and direct-route capability matrix.
- `frontend-mobile/tests/roleAccess.test.mjs`: primary routing, shared access, direct-navigation denial, and stale/unknown-role regression coverage.

### Folder Organization Philosophy

**Backend (layered):** Features are structured using a traditional layered architecture (`config`, `controller`, `dto`, `model`, `repository`, `service`). 

- **Why:** Clear separation of concerns by technical layers. Standard layout that is instantly familiar to Java/Spring developers.
- **Example:** A request to generate an SOA flows: `SoaController` (Controller layer) → `SoaService` (Service layer) → `SoaRepository` (Data access layer) → `Soa` (Model/Entity layer).

**Frontend Web (Feature-Sliced):** Organized into file-based routes (`src/app/`) backed by cohesive domain feature modules (`src/features/`):
- **Why:** Keeps feature-specific UI, modals, API calls, and utilities colocated (e.g. `src/features/collections/` contains table components, deductions cards, paper cards, and API bindings).
- **API client:** Centralized in `services/api/client.js` with self-healing token refresh and 401/403 transparent request retries.
- **Print audit outbox:** Platform-neutral persistence and retry logic lives in `src/features/shipments/services/printAuditOutboxCore.mjs`; the adjacent JavaScript module supplies browser storage and API adapters.

**Frontend Mobile:** Expo Router file-based routing targeting iOS and Android natively.

- **Why:** Provides standard, high-performance native experiences for mobile sensors (camera scan, bluetooth).
- **Parallel with web:** Uses a similar structure and the exact same API connection pattern to communicate with the Spring Boot backend.

**Root:** Configuration files that coordinate all three services (docker-compose, .gitignore, README).

- **Why:** Monorepo makes it easy to `docker-compose up` and have all three apps running locally in one command.

### Workflow & Load Testing

- Flyway migration inventory spans V1 through V35; V34 adds split-waybill membership and legacy backfill, and V35 records returned QR scans.
- `backend/src/main/resources/application-workflow.properties` selects the isolated `tnl_workflow` database and enables the production-shaped workflow fixtures.
- `docker-compose.workflow.yml` overrides the default Compose stack for the same isolated workflow profile.
- `backend/src/main/resources/application-loadtest.properties` selects the isolated `tnl_loadtest` database with configurable HikariCP concurrency tuning (default pool size 10), strict Hibernate `ddl-auto=validate`, and opt-in deterministic seeder (`LoadTestDataSeeder.java`).
- `docker-compose.loadtest.yml` spins up `mysql-loadtest` (port 3307, 512M RAM / 0.5 vCPU) and `backend-loadtest` (port 8082, 512M RAM / 0.5 vCPU with Serial GC) using `.env.loadtest`.
- `load-tests/` provides k6 smoke, 25-user baseline, and 20-courier + 1-admin realistic hybrid simulation scripts targeting `http://localhost:8082` with JWT credential sanitization.

### Combined Phases 3-4 additions

- `backend/src/main/java/com/tnl/logistics/dto/WaybillGenerationRequest.java`: selected-unit generation request.
- `backend/src/main/resources/db/migration/V34__split_waybill_manifests.sql`: split manifests and legacy backfill.
- `backend/src/test/java/com/tnl/logistics/controller/SplitWaybillIntegrationTest.java`: split-waybill workflow tests.
- `frontend-mobile/src/app/(main)/waybills.js`: Hauler Staff loading, handoff, printing, exact lookup, and printed-waybill QR return confirmation screen.
- `frontend-mobile/src/features/waybills/waybillApi.js`: waybill API calls.
- `frontend-mobile/src/features/waybills/printWaybill.mjs` and `printWaybill.test.mjs`: two-copy A4 print model and tests.
- `frontend-mobile/src/features/waybills/waybillReturnFlow.mjs` and `frontend-mobile/tests/waybillReturn.test.mjs`: strict QR parsing and completion-unlock rules.
- `frontend-web/src/app/waybills/index.js`: Admin waybill lookup and selected-manifest printing.
- `backend/src/main/resources/db/migration/V35__record_waybill_return_scans.sql` and its model/repository remain for historical return-scan records; the active return-scan endpoint is retired.
- `frontend-web/src/features/waybills/services/waybillPrint.mjs` and `waybillPrint.test.mjs`: exact-manifest two-copy A4 print model with identical return-confirmation QRs and pagination tests.

### Mobile shipment-option pagination additions

- `backend/src/main/java/com/tnl/logistics/dto/PageResponse.java`: stable top-level page metadata response used by mobile shipment options.
- `backend/src/test/java/com/tnl/logistics/controller/WaybillShipmentOptionsIntegrationTest.java`: pagination, ordering, search, bounds, empty-result, and authorization coverage.
- `frontend-mobile/src/features/waybills/shipmentOptionsFlow.mjs`: pure page merging, query normalization, end detection, and cancellable request coordination.
- `frontend-mobile/tests/shipmentOptions.test.mjs`: regression coverage for shipment-option pagination and stale-response protection.

### Mobile returned waybill option pagination additions

- `backend/src/main/java/com/tnl/logistics/dto/WaybillOptionResponse.java`: lightweight projection for returned waybill options (waybill ID, shipment ID, parcel count, status, status label, generated timestamp).
- `frontend-mobile/src/features/waybills/waybillOptionsFlow.mjs`: pure option parameter construction, page merging, recommendation bounds, and cancellable request coordination.
- `frontend-mobile/tests/waybillOptions.test.mjs`: unit tests for returned waybill pagination, recommendation capping, and cancellation.
