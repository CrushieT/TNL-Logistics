# Project Structure

**TNL Logistics uses a monorepo layout with three independent codebases sharing a common backend API.**

### Planning Artifacts

- `.review/client-demo-change-plan.md` contains the categorized post-client-demo delivery plan.
- `.review/client-demo-phase-0-discovery-and-threat-model.md` contains the Phase 0 findings, pending decisions, and required security controls.
- `.review/client-demo-phase-1-registration-and-rating-plan.md` contains the decision-complete per-unit measurement and settings-based rating plan.
- `.review/admin-partial-delivery-plan.md` contains the deferred partial-delivery exception plan.
- `.review/railway-deployment-runbook.md` contains the Railway deployment procedure.

### Complete Directory Structure

```
tnl-logistics/
├── .review/                          # Planning and review artifacts
│   ├── admin-partial-delivery-plan.md
│   ├── client-demo-change-plan.md
│   ├── client-demo-phase-0-discovery-and-threat-model.md
│   ├── client-demo-phase-1-registration-and-rating-plan.md
│   └── railway-deployment-runbook.md
├── .agents/
│   └── rules/
│       ├── build-plan.md             # Master 6-Phase development roadmap & progress tracking
│       ├── git-conventions.md        # Git workflow, branch naming & commit rules
│       ├── hardening-plan.md         # Post-review system hardening & lifecycle remediation plan
│       ├── karpathy-guidelines.md    # LLM coding best practices
│       └── project-structure.md      # Project directory layout & philosophies
├── .github/
│   ├── pull_request_template.md      # GitHub Pull Request template
│   ├── PR_DRAFT.md                   # Current shipping-task handoff draft
│   └── workflows/                    # GitHub Actions CI/CD workflows
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
│   │   │       └── db/migration/        # Flyway versioned SQL migrations (V1 to V31; V31 adds nullable rate per kilo and shipment calculation snapshots)
│   │   └── test/                        # Integration and unit test suites, including AdminConsoleAuthorizationIntegrationTest and scanner API coverage
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
│   │   │   │   └── index.js         # Screens 23-25 Waybill workflow & printable manifest
│   │   │   ├── reports.js           # Screen 26 Operational & Financial Reports
│   │   │   ├── reports/
│   │   │   │   └── print.js         # Dedicated isolated printable report document
│   │   │   ├── users.js             # Screen 27 User & Staff Management
│   │   │   └── settings.js          # Screen 28 System Settings
│   │   ├── components/              # Shared design system (common/ atoms, layout/ AppShell)
│   │   ├── features/                # Domain modules
│   │   │   ├── shipments/           # ClientSelectDropdown, ParcelUnitsEditor, ShipmentPricingSummary, parcelPagination.mjs, registrationCalculations.mjs, PrintLabelsModal, LabelPreview, durable outbox & isolated thermal print service
│   │   │   ├── reports/             # Operational & financial report cards, PrintableReportDocument, reportPrintModel.mjs
│   │   │   └── settings/            # AdminSecurityCard, ConfirmPasswordModal, settings components
│   │   ├── services/api/            # Core infrastructure (client.js with JWT auth & role protection, sessionCore.mjs, sseClient.js, sseClientCore.mjs)
│   │   ├── theme/                   # Design tokens (colors, fonts, typography, spacing)
│   │   ├── utils/                   # Shared QR facade
│   │   └── vendor/qrcodegen/        # Vendored Project Nayuki QR generator
│   ├── tests/                       # Web unit suites (authSlidingSession.test.mjs, labelPrint.test.mjs, qr.test.mjs, registrationCalculations.test.mjs, reportPrint.test.mjs, sseClient.test.mjs)
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
│   │   ├── features/                 # Domain feature slices (auth, office, field, shipments, printer, scanner, tracking-history, settings)
│   │   │   ├── auth/services/        # Auth API, secure storage transitions, and pure cold-launch/PIN lifecycle helpers
│   │   │   ├── settings/             # Account/security flow helpers and reusable settings components
│   │   │   ├── shipments/            # Shipment registration with ParcelUnitsEditor and parcelPagination helpers, explorer, detail screens, and barcode scanner modal
│   │   │   ├── printer/              # Driver isolation, audit outbox, ESC/POS formatter, and serialized PrinterContext
│   │   │   ├── scanner/              # Field camera scanner (ScanViewfinder, SingleScanReview, BatchScanPanel, ScanResultPanel, scannerFlow.mjs, trackingScanApi.js, haptics.js, hapticsCore.mjs)
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

- `backend/src/main/resources/application-workflow.properties` selects the isolated `tnl_workflow` database and enables the production-shaped workflow fixtures.
- `docker-compose.workflow.yml` overrides the default Compose stack for the same isolated workflow profile.
- `backend/src/main/resources/application-loadtest.properties` selects the isolated `tnl_loadtest` database with configurable HikariCP concurrency tuning (default pool size 10), strict Hibernate `ddl-auto=validate`, and opt-in deterministic seeder (`LoadTestDataSeeder.java`).
- `docker-compose.loadtest.yml` spins up `mysql-loadtest` (port 3307, 512M RAM / 0.5 vCPU) and `backend-loadtest` (port 8082, 512M RAM / 0.5 vCPU with Serial GC) using `.env.loadtest`.
- `load-tests/` provides k6 smoke, 25-user baseline, and 20-courier + 1-admin realistic hybrid simulation scripts targeting `http://localhost:8082` with JWT credential sanitization.
