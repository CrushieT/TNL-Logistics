# Project Structure

### Frontend progressive loading and bounded memory cache

- `frontend-web/src/services/api/useVerifiedAdminSession.js`: subscribes to session changes before rechecking authentication; exposes a stable verified user/session-generation key and blocks page reads and cache previews while verification is pending.
- `frontend-web/src/services/api/responseCache.mjs`: pure in-memory response cache module with 6 slots (`dashboard_summary`, `reports_summary`, `weekly_collections`, `tracking_logs_page`, `tracking_logs_metrics`, `collection_cycles`), exact user ID, session generation, and canonical query parameter matching, 5-minute TTL, 1 MiB per-entry cap, 4 MiB total cache cap, oldest-entry eviction, and zero storage persistence.
- `frontend-web/src/components/common/Skeleton.js`: accessible, static placeholder blocks and skeletons (`MetricCardSkeleton`, `ChartSkeleton`, `TableRowSkeleton`, `ActivityRowSkeleton`, `ReportsKpiSkeleton`, `CollectionSummarySkeleton`) for immediate page layout rendering without full-page spinners or financial flashes.
- `frontend-web/tests/responseCache.test.mjs`: unit test suite verifying cache hits, expiration, identity & query bounds, slot replacement, payload size limits, and total eviction.
- `frontend-web/tests/responseCacheSession.test.mjs`: cache/session-core unit checks for invalidation, sliding renewal, response acceptance, and account isolation; production client integration is covered in progressiveLoadingFlows.test.mjs.

### Request lifecycle, coordinator, and SSE outage handling

- `frontend-web/src/services/api/requestCoordinator.mjs`: shared request coordinator managing deterministic key derivation, in-flight overlap prevention, AbortController cancellation on key change/unmount, generational response guarding, at most one queued follow-up refresh, 300ms event burst debouncing, hidden tab/inactive route suspension, and cancellation error suppression.
- `frontend-web/src/services/api/useRequestCoordinator.js`: React hook integrating `createRequestCoordinator` with component lifecycle, window focus, and document visibility changes.
- `frontend-web/src/services/api/sseClientCore.mjs`: added `calculateBackoffDelay` (1s, 2s, 4s, 8s, 16s, 30s ceiling with bounded jitter) and `isAuthFailureStatus` (401/403).
- `frontend-web/src/services/api/sseClient.js`: single shared SSE connection with exponential backoff, immediate halt on 401/403 or session invalidation, parallel timer/connection prevention, and subscriber cleanup.
- `frontend-web/tests/requestCoordinator.test.mjs`: unit test suite verifying deterministic keys, cancellation, stale response suppression, follow-up coalescing, 300ms debouncing, same-instance lifecycle reactivation, protected success metadata including live highlight flags, and tab suspension/resume.
- `frontend-web/tests/progressiveLoadingFlows.test.mjs`: executes production screens and hooks for pending verification, mount-time subscription races, repeated notifications, account changes, retained-ref effect replay, live highlight expiry/cleanup, cache-hit Print gating, stale empty results, cancellation, and visibility resume; also executes production client session/cache transitions.
- `frontend-web/tests/sseClient.test.mjs`: extended test suite covering backoff calculation, auth failure detection, and connection lifecycle.

### Admin tracking logs optimization

- `backend/src/main/java/com/tnl/logistics/repository/TodayTrackingMetricsSummary.java`: single-query projection interface for today's operational tracking metrics (`todayTotalScans`, `activeCouriersCount`, `loadedOnTruckToday`, `handedToHaulerToday`).
- `backend/src/main/java/com/tnl/logistics/repository/AdminTrackingEventRepository.java`: custom fragment interface declaring `findAdminTrackingEvents(search, status, startDateTime, endDateTime, pageable)`.
- `backend/src/main/java/com/tnl/logistics/repository/AdminTrackingEventRepositoryImpl.java`: ID-first admin pagination selecting matching event IDs, zero-join count/IDs query for unfiltered/date/status searches, 6-field search joining only required tables, page/size clamping (1-500), and bounded relationship fetch with order preservation.
- `backend/src/test/java/com/tnl/logistics/controller/TrackingLogIntegrationTest.java`: 21 integration tests covering pagination clamping, 500-item CSV request, exact totals beyond last page, 6-field substring/lowercase search, combined search+status+date, wildcard/escape inputs, empty results, timestamp tie breaking by `eventId DESC`, adjacent page non-overlap, DTO mapping safety, 401/403 role matrix, and populated current-day metrics tracking.

### Statements dropdown SOA search

- `frontend-web/src/features/collections/components/SearchableClientDropdown.js`: optional SOA number display and substring search; default client-only mode remains unchanged.
- `frontend-web/src/app/statements.js`: generated statements for the selected cycle retain SOA number, client code, and contact number in dropdown options.
- `frontend-web/tests/searchableClientDropdown.test.mjs`: production component and screen regressions for SOA display/search, client identity searches, selection, default mode, and cycle switching.

### Courier vehicle selection pagination

- `backend/src/main/java/com/tnl/logistics/repository/VehicleRepository.java`: added `findByActiveTrue` page query and case-insensitive `findActiveVehicleOptions` filtering active vehicles matching plate, vehicle ID, or description.
- `backend/src/main/java/com/tnl/logistics/service/VehicleService.java` & `impl/VehicleServiceImpl.java`: paginated `getActiveVehicleOptions` with `loadOnTruckCountMap()` active cargo enrichment.
- `backend/src/main/java/com/tnl/logistics/controller/VehicleController.java`: added `GET /api/v1/vehicles/options` returning `PageResponse<VehicleResponse>` with role gating.
- `backend/src/test/java/com/tnl/logistics/controller/VehicleOptionsIntegrationTest.java`: integration test verifying unauthenticated rejection, role authorization across all 4 staff roles, bounded page defaults, active filtering, and search matching.
- `frontend-mobile/src/features/scanner/vehicleOptionsFlow.mjs`: pure coordination module managing 20-item paging, deduplication, search normalization, boundary checks, and request coordination.
- `frontend-mobile/tests/vehicleOptions.test.mjs`: automated unit test suite for vehicle pagination and request coordination.
- `frontend-mobile/tests/vehicleOptions.test.mjs` also exercises the production single-review effect and loader to prevent repeated requests after a successful empty response and preserve reload/error/offline behavior.
- `frontend-mobile/src/features/scanner/components/VehiclePicker.js`: reusable vehicle selector aligned with dispatch staff discovery design (outer `sectionCard`, `inputActionRow`, `recommendationPanel`, horizontal `FlatList` rail with `shipmentChip` styling, and collapsible `activeShipmentCard` with `CHANGE` button).
- `frontend-mobile/src/features/scanner/components/SingleScanReview.js` & `BatchScanPanel.js`: integrated with `VehiclePicker` with pagination and search props.
- `frontend-mobile/src/app/(main)/scan.js`: coordinator lifecycle management, debounced search effect, infinite scroll pagination, and role-change teardown.

### UI status color alignment

- `frontend-web/src/theme/index.js`: unified 5-tier semantic tokens across physical tracking, payments, weekly collections, waybills, and labels.
- `frontend-web/src/components/common/StatusBadge.js`: case-insensitive status and collection style resolution.
- `frontend-web/tests/statusThemeTokens.test.mjs`: regression contract suite for semantic token mappings.
- `frontend-mobile/src/theme/index.js`: added `info` / `infoSoft` and shared `getParcelStatusColor` helper.
- `frontend-mobile/tests/statusThemeTokens.test.mjs`: mobile status color contract tests.

### Lost parcel workflow

- `.review/lost-parcel-evidence.md`: scoped test results, audit, remediation log, and manual acceptance guide.
- `backend/src/main/java/com/tnl/logistics/service/ParcelCustodyLocks.java`: ordered shipment/waybill/parcel locks and fresh locked state.
- `backend/src/main/java/com/tnl/logistics/service/ParcelExceptionService.java`: authenticated Admin commands, replay protection, closure, and reopening.
- `backend/src/main/java/com/tnl/logistics/model/ParcelExceptionCommand.java` and `repository/ParcelExceptionCommandRepository.java`: shared command request-ID registry.
- `backend/src/main/java/com/tnl/logistics/dto/ParcelLossEventResponse.java` and `WaybillReconciliationResponse.java`: restricted history DTOs.
- `backend/src/test/java/com/tnl/logistics/controller/ParcelLossIntegrationTest.java`: exception contracts, lifecycle, atomicity, and concurrency regressions.
- `backend/src/test/java/com/tnl/logistics/migration/ParcelLossMigrationIntegrationTest.java`: isolated fresh and V38-upgrade migration checks.
- `frontend-web/src/components/common/ExceptionAction.js`: Admin confirmation, reason, retry, and conflict-review interaction.
- `frontend-web/tests/parcelException.test.mjs`: confirmation behavior and lost-manifest reprints.
- `frontend-mobile/tests/parcelLoss.test.mjs`: loss-aware scanner, revision gates, and reprints.

- `.review/lost-parcel-plan.md`: implementation slices, threat controls, and acceptance scope.
- `backend/src/main/resources/db/migration/V39__add_parcel_loss_reconciliation.sql`: additive loss, revision, and audit persistence.
- `backend/src/main/java/com/tnl/logistics/dto/ParcelExceptionRequest.java`: validated Admin exception command.
- `backend/src/main/java/com/tnl/logistics/model/ParcelLossEvent.java` and `WaybillReconciliationEvent.java`: immutable exception history.
- `backend/src/main/java/com/tnl/logistics/repository/ParcelLossEventRepository.java` and `WaybillReconciliationEventRepository.java`: exception history persistence.

### V34 managed-MySQL compatibility

- `backend/src/test/java/com/tnl/logistics/migration/V34PrimaryKeyMigrationIntegrationTest.java`: isolated local upgrade, backfill rejection, and recovery tests with required primary keys enabled.
- `.review/v34-primary-key-recovery.md`: controlled recovery procedure for the failed deployed migration and applied-migration checksum handling.

### Pricing parity and registration retry additions

- `frontend-web/src/features/shipments/fixedPointPricing.mjs`: feature-local decimal pricing arithmetic.
- `frontend-mobile/src/features/shipments/fixedPointPricing.mjs`: independent mobile decimal pricing arithmetic.
- `frontend-web/tests/pricingParity.test.mjs`: identical boundary vectors against both calculators.
- `frontend-mobile/tests/pricingParity.test.mjs`: mobile suite entry for the same parity vectors.
- `frontend-web/tests/registrationRetry.test.mjs`: production form and screen retry regressions.
- `.review/pricing-retry-evidence.md`: verification, scoped audit, and merge review evidence.

### Mobile account-switch additions

- `backend/src/main/java/com/tnl/logistics/dto/MobileLoginRequest.java`: explicit switch confirmation contract.
- `backend/src/main/java/com/tnl/logistics/service/MobileSessionService.java`: transactional password/PIN login and binding transfer.
- `backend/src/main/resources/db/migration/V38__version_mobile_device_sessions.sql`: per-binding session version.
- `backend/src/test/java/com/tnl/logistics/controller/MobileBindingSwitchIntegrationTest.java`: ownership and concurrency regressions.
- `backend/src/test/java/com/tnl/logistics/support/TestSessionTokenFactory.java`: binding-scoped test sessions.
- `frontend-mobile/src/features/auth/services/sessionCoordinator.mjs`: session generations and serialized persistence.
- `frontend-mobile/tests/accountSwitch.test.mjs`: stale-response and storage-failure regressions.
- `.review/mobile-account-switch-evidence.md`: threat model and verification evidence.

### First-boot financial setup

- `frontend-web/src/app/setup.js`: two-step administrator and company/SOA/pricing setup.
- `frontend-web/src/features/settings/utils/soaBankDetails.mjs`: shared single-line bank validation and string account normalization.
- `frontend-web/tests/firstBootSetup.test.mjs`: rendered setup handlers, validation, navigation retention, registration mapping, and submission recovery regressions.
- `backend/src/test/java/com/tnl/logistics/controller/FirstBootIntegrationTest.java`: committed first-boot lifecycle and rollback checks in the isolated `tnl_first_boot_test` schema, with sample seeding disabled.

**TNL Logistics uses a monorepo layout with three independent codebases sharing a common backend API.**

### Complete Directory Structure

```
tnl-logistics/
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
│   │   │       └── db/migration/        # Flyway versioned SQL migrations (V1 to V37; V36 maps identities, V37 removes account subtype/company columns and closes the role domain)
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
│   │   ├── components/              # Shared design system (common/ atoms & Skeleton, layout/ AppShell, Sidebar, SignOutModal, navScrollPosition.mjs)
│   │   ├── features/                # Domain modules
│   │   │   ├── shipments/           # ClientSelectDropdown, ParcelUnitsEditor, ShipmentPricingSummary, parcelPagination.mjs, registrationCalculations.mjs, PrintLabelsModal, LabelPreview, durable outbox & isolated thermal print service
│   │   │   ├── reports/             # Operational & financial report cards, PrintableReportDocument, reportPrintModel.mjs
│   │   │   ├── collections/         # SOA components, API services, pagination, and hardened two-copy statementPrintModel.mjs
│   │   │   ├── waybills/            # Waybill table, manifest, directory helpers, API client, and two-copy print service
│   │   │   └── settings/            # Settings components plus shared SOA bank-detail normalization and validation
│   │   ├── services/api/            # Core infrastructure (client.js with JWT auth & role protection, sessionCore.mjs, responseCache.mjs, sseClient.js, sseClientCore.mjs)
│   │   ├── theme/                   # Design tokens (colors, fonts, typography, spacing)
│   │   ├── utils/                   # Shared QR facade
│   │   └── vendor/qrcodegen/        # Vendored Project Nayuki QR generator
│   ├── tests/                       # Web unit suites, including response cache, nav scroll position, signout modal, waybill directory, route, and two-copy print coverage
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
│   │   │   ├── printer/              # Driver isolation, audit outbox, ESC/POS & TSPL formatters (tsplFormatter.js for XP-470B/XP-420B), and serialized PrinterContext
│   │   │   ├── scanner/              # Field camera scanner (ScanViewfinder, SingleScanReview, BatchScanPanel, ScanResultPanel, VehiclePicker, scannerFlow.mjs, vehicleOptionsFlow.mjs, trackingScanApi.js, haptics.js, hapticsCore.mjs)
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
- `backend/src/main/java/com/tnl/logistics/config/WorkflowDataSeeder.java` seeds the current workflow profile through application services; `DataSeeder.java` retains the existing development/test foundation and fixtures.
- `backend/src/test/java/com/tnl/logistics/config/WorkflowDataSeederIntegrationTest.java` verifies fixture contracts, lifecycle histories, financial rollups, restart preservation, profile safety, and role-gated API access in an isolated database.
- `docker-compose.workflow.yml` overrides the default Compose stack for the same isolated workflow profile.
- `backend/src/main/resources/application-loadtest.properties` selects the isolated `tnl_loadtest` database with configurable HikariCP concurrency tuning (default pool size 10), strict Hibernate `ddl-auto=validate`, and opt-in deterministic seeder (`LoadTestDataSeeder.java`).
- `backend/src/main/java/com/tnl/logistics/config/LoadTestFixtureWriter.java` expands 72 service-generated load-test templates with bounded multi-row inserts, remapped audit references, recalculated client pricing, and reserved application identifiers.
- `backend/src/test/java/com/tnl/logistics/config/LoadTestDataSeederIntegrationTest.java` verifies both service-generated and bulk-expanded fixtures across 24 operational scenarios, three billing cycles, pricing snapshots, audit records, print retry fingerprints, and restart preservation in an isolated MySQL test schema.
- `docker-compose.sim-seed.yml` temporarily raises simulation CPU, memory, JVM heap, and MySQL buffer-pool capacity during initial seeding; omit it and recreate the containers before benchmarking.
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

Ship 3 removed `backend/src/main/java/com/tnl/logistics/model/StaffType.java`. The final account entity and DTOs expose role-only identities. `.review/four-role-ship-3-evidence.md` retains the baseline capability trace, company-column removal evidence, migration controls, and final verification reports.

### 50,000-shipment read optimization
- `backend/src/main/java/com/tnl/logistics/dto/CollectionTotals.java`: internal shared collection totals DTO (total due, total collected, outstanding balance, active clients count) for Dashboard and Weekly Collections.
- `backend/src/main/java/com/tnl/logistics/repository/CycleShipmentSummary.java`: SQL-aggregated cycle shipment count, parcel count, and total charges projection for Dashboard.
- `backend/src/main/java/com/tnl/logistics/repository/PersonalTrackingEventRepository.java`: staff-scoped history fragment.
- `backend/src/main/java/com/tnl/logistics/repository/PersonalTrackingEventRepositoryImpl.java`: ID pagination, exact count, bounded relationship fetch.
- `backend/src/main/java/com/tnl/logistics/repository/ClientCollectionTotals.java`: per-client financial projection.
- `backend/src/main/java/com/tnl/logistics/repository/ClientAgingProjection.java`: SQL-aggregated client aging and live receivables projection.
- `backend/src/main/java/com/tnl/logistics/repository/PeriodShipmentTotals.java`: SQL-aggregated period shipment count and billed revenue projection.
- `backend/src/main/java/com/tnl/logistics/repository/ClientPeriodShipmentTotals.java`: SQL-aggregated client-level period shipment count and billed revenue projection.
- `backend/src/main/java/com/tnl/logistics/repository/ClientPeriodPaymentTotals.java`: SQL-aggregated client-level period collected revenue projection.
- `backend/src/main/java/com/tnl/logistics/repository/PaymentMethodTotals.java`: SQL-aggregated payment method distribution projection.
- `backend/src/main/java/com/tnl/logistics/repository/DeductionCategoryTotals.java`: SQL-aggregated SOA deduction categories projection.
- `backend/src/main/java/com/tnl/logistics/repository/DailyShipmentTotals.java`: SQL-aggregated daily registered shipment count projection.
- `backend/src/main/java/com/tnl/logistics/repository/DailyParcelTotals.java`: SQL-aggregated daily parcel count, weight, volume, and completed delivery projection.
- `backend/src/main/resources/db/migration/V40__cover_personal_history_and_metrics.sql`: additive courier covering indexes.
- `backend/src/test/java/com/tnl/logistics/controller/CollectionsAggregationIntegrationTest.java`: financial and boundary regressions.
- `frontend-web/tests/collectionsFallbackRemoval.test.mjs`: regression suite asserting complete removal of frontend fallback aggregator, prevention of zero balance fabrication, and propagation of structured 503 errors.
- `load-tests/endpoint-diagnostics.js`: sequential sampling with discarded warm-up and sanitized summaries.
- `load-tests/run-measurement.ps1`: environment-backed diagnostic and unchanged simulation runner.
- `load-tests/capture-financial-results.ps1`: synthetic financial response snapshots without credentials.
- `load-tests/query-diagnostics.sql`: repeatable query plans and index sizes.
- `load-tests/scan-write-diagnostics.sql`: rolled-back scan insert timing.
- `load-tests/monitor-resources.ps1`: per-run CPU/memory samples and connection-pool timeout counts.
- `load-tests/optimization-results.md`: slice verification, performance evidence, and unsuccessful-attempt ledger.

### Frontend progressive loading & navigation additions
- `frontend-web/src/components/common/Skeleton.js`: generic and domain-specific skeleton placeholders for immediate layout rendering.
- `frontend-web/src/services/api/responseCache.mjs`: bounded browser-memory preview cache with slot budgeting, 5-minute TTL, and `isResponseAcceptable` production session/query acceptance validation.
- `frontend-web/src/components/layout/navScrollPosition.mjs`: navigation scroll-offset state preservation across page transitions.
- `frontend-web/tests/responseCache.test.mjs`: unit tests for pure cache slot allocation, eviction, TTL, and canonical query parameter matching.
- `frontend-web/tests/responseCacheSession.test.mjs`: cache/session-core unit checks for invalidation, sliding renewal, response acceptance, and account isolation.
- `frontend-web/tests/progressiveLoadingFlows.test.mjs`: production screen/hook regression tests for first render, preview Print gating, tab resume metadata, late responses, empty-result stale handling, cycle cancellation, and actual client session/password boundaries; child UI rendering is stubbed.
- `frontend-web/tests/navScrollPosition.test.mjs`: regression tests for navigation scroll position retention.
- `frontend-web/src/components/layout/SignOutModal.js`: web confirmation modal for admin console signout with icon anchor, section dividers, and backdrop dismissal.
- `frontend-web/tests/signOutModal.test.mjs`: unit and interaction tests for signout popup presentation, callbacks, and Sidebar integration.
