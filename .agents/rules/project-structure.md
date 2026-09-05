# Project Structure

**TNL Logistics uses a monorepo layout with three independent codebases sharing a common backend API.**

### Complete Directory Structure

```
tnl-logistics/
├── .agents/
│   └── rules/
│       ├── build-plan.md             # Master 6-Phase development roadmap & progress tracking
│       ├── git-conventions.md        # Git workflow, branch naming & commit rules
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
│   │   │       └── db/migration/        # Flyway versioned SQL migrations (V1 to V16)
│   │   └── test/                        # Integration and unit test suites
│   └── pom.xml
│
├── frontend-web/                    # Admin Web Portal (React Native Web / Expo Router)
│   ├── src/
│   │   ├── app/                     # File-based routes
│   │   │   ├── _layout.js           # Root Stack navigator & Central Route Guard
│   │   │   ├── +not-found.js        # Catch-all 404 Route Not Found operations card
│   │   │   ├── login.js             # Screen 01 Desktop Login with TC & CT branding
│   │   │   ├── index.js             # Dashboard
│   │   │   ├── register.js          # Register Shipment (form + result view)
│   │   │   ├── shipments/           # Shipments list and detail views
│   │   │   ├── vehicles.js          # Vehicle fleet management
│   │   │   ├── clients.js           # Client directory & profile view
│   │   │   ├── waybills.js          # Waybills & printable manifest
│   │   │   ├── payments.js          # Screen 18 Payment recording & installment ledger
│   │   │   ├── weekly-collections.js# Screen 19 Weekly Collections consolidation dashboard
│   │   │   ├── statements.js        # Screen 20 Statement of Account (SOA) preview & deductions
│   │   │   └── statements/
│   │   │       └── print.js         # Screen 22 Dedicated isolated printable SOA document
│   │   ├── components/              # Shared design system (common/ atoms, layout/ AppShell)
│   │   ├── features/                # Domain feature modules (shipments, vehicles, clients, waybills, payments, collections)
│   │   ├── services/api/            # Core infrastructure (client.js with JWT auth & role protection, sseClient.js)
│   │   ├── theme/                   # Design tokens (colors, fonts, typography, spacing)
│   │   └── utils/                   # Pure utilities (qr.js in-memory vector QR encoder)
│   ├── assets/                      # favicon.png, tracking-logo.png
│   ├── app.json                     # Expo web configuration
│   ├── package.json
│   └── README.md
│
├── frontend-mobile/                  # React Native (Expo) Field Operations (JavaScript)
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login.js
│   │   │   └── _layout.js
│   │   ├── (main)/
│   │   │   ├── home.js
│   │   │   ├── scan.js
│   │   │   ├── history.js
│   │   │   └── _layout.js
│   │   └── _layout.js
│   ├── api/
│   │   └── client.js
│   ├── components/
│   │   ├── QRScanner.js
│   │   ├── LabelPrinter.js
│   │   └── common/
│   ├── hooks/
│   ├── app.json                      # Expo configuration
│   ├── eas.json                      # EAS Build configuration
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
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
