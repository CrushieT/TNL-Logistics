# Project Structure

**TNL Logistics uses a monorepo layout with three independent codebases sharing a common backend API.**

### Complete Directory Structure

```
tnl-logistics/
├── .agents/
│   └── rules/
│       ├── build-plan.md             # Master 6-Phase development roadmap & progress tracking
│       ├── git-conventions.md        # Git workflow, branch naming & commit rules
│       ├── hardening-plan.md         # Post-review system hardening & lifecycle remediation plan
│       ├── karpathy-guidelines.md    # LLM coding best practices
│       └── project-structure.md      # Project directory layout & philosophies
├── .github/
│   └── pull_request_template.md      # GitHub Pull Request template
├── backend/                          # Spring Boot API (Java 21)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/tnl/logistics/
│   │   │   │   ├── config/              # SecurityConfig, CorsConfig, JwtTokenProvider, DataSeeder
│   │   │   │   ├── controller/          # REST endpoints (Shipment, Vehicle, Client, Waybill, Payment, Collections, SOA)
│   │   │   │   ├── dto/                 # Request & Response DTOs
│   │   │   │   ├── model/               # JPA Entities (Client, Shipment, ParcelUnit, Vehicle, Waybill, Payment, Soa, etc.)
│   │   │   │   ├── repository/          # Spring Data Repositories & Batch Group By Queries
│   │   │   │   └── service/             # Business Logic & Service Interfaces (impl/)
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       ├── application-dev.properties
│   │   │       └── db/migration/        # Flyway versioned SQL migrations (V1 to V27)
│   │   └── test/                        # Integration and unit test suites
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
│   │   │   ├── users.js             # Screen 27 User & Staff Management
│   │   │   └── settings.js          # Screen 28 System Settings
│   │   ├── components/              # Shared design system (common/ atoms, layout/ AppShell)
│   │   ├── features/                # Domain feature modules (shipments, vehicles, clients, waybills, payments, collections, tracking-logs, reports, users, settings)
│   │   │   └── settings/            # AdminSecurityCard, ConfirmPasswordModal, settings components
│   │   ├── services/api/            # Core infrastructure (client.js with JWT auth & role protection, sseClient.js)
│   │   ├── theme/                   # Design tokens (colors, fonts, typography, spacing)
│   │   └── utils/                   # Pure utilities (qr.js in-memory vector QR encoder)
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
│   │   │   │   ├── setup-pin.js      # Mobile PIN creation & confirmation
│   │   │   │   └── pin.js            # Screen 29 PIN quick shift unlock
│   │   │   └── (main)/
│   │   │       ├── _layout.js        # Authenticated route guard
│   │   │       ├── index.js          # Role-aware home (Office vs Field Dashboard)
│   │   │       └── scan.js           # Screen 45 Camera QR scanner
│   │   ├── components/               # Shared UI atoms (Keypad, PinIndicator, PressableScale, ActionCard, MetricCard, NoticeBanner, StatusModal)
│   │   │   ├── common/
│   │   │   └── layout/               # MobileHeader
│   │   ├── features/                 # Domain feature slices (auth, office, field)
│   │   ├── services/
│   │   │   ├── api/client.js         # Axios API client with Bearer auth
│   │   │   └── storage/secureStore.js# Hardware-backed SecureStore adapter
│   │   └── theme/index.js            # TNL design tokens (canvas, ink, accent, keypad)
│   ├── app.json                      # Expo configuration
│   ├── eas.json                      # EAS Build configuration
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── docker-compose.yml                # Local dev: MySQL + Backend
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

**Frontend Mobile:** Expo Router file-based routing targeting iOS and Android natively.

- **Why:** Provides standard, high-performance native experiences for mobile sensors (camera scan, bluetooth).
- **Parallel with web:** Uses a similar structure and the exact same API connection pattern to communicate with the Spring Boot backend.

**Root:** Configuration files that coordinate all three services (docker-compose, .gitignore, README).

- **Why:** Monorepo makes it easy to `docker-compose up` and have all three apps running locally in one command.
