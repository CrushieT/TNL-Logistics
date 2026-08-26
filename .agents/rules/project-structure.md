# Project Structure

**TNL Logistics uses a monorepo layout with three independent codebases sharing a common backend API.**

### Complete Directory Structure

```
tnl-logistics/
├── backend/                          # Spring Boot API (Java 21)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/tnl/logistics/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── shipment/
│   │   │   │   │   │   ├── Shipment.java
│   │   │   │   │   │   ├── ShipmentRepository.java
│   │   │   │   │   │   └── ShipmentService.java
│   │   │   │   │   ├── billing/
│   │   │   │   │   ├── tracking/
│   │   │   │   │   │   ├── TrackingEvent.java
│   │   │   │   │   │   ├── TrackingEventRepository.java
│   │   │   │   │   │   └── TrackingEventService.java
│   │   │   │   │   └── parcel/
│   │   │   │   │       ├── ParcelUnit.java
│   │   │   │   │       ├── ParcelUnitRepository.java
│   │   │   │   │       └── ParcelUnitService.java
│   │   │   │   ├── service/
│   │   │   │   │   ├── QRGenerationService.java
│   │   │   │   │   ├── BillingService.java
│   │   │   │   │   └── WeeklyCollectionService.java
│   │   │   │   ├── controller/
│   │   │   │   │   └── api/v1/
│   │   │   │   │       ├── ShipmentController.java
│   │   │   │   │       ├── ParcelController.java
│   │   │   │   │       └── BillingController.java
│   │   │   │   ├── repository/
│   │   │   │   ├── entity/
│   │   │   │   ├── config/
│   │   │   │   │   ├── SecurityConfig.java
│   │   │   │   │   ├── CorsConfig.java
│   │   │   │   │   └── OpenApiConfig.java
│   │   │   │   └── TnlLogisticsApplication.java
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       ├── application-dev.yml
│   │   │       ├── application-prod.yml
│   │   │       └── db/migration/
│   │   │           └── V1__init_schema.sql
│   │   └── test/java/com/tnl/logistics/
│   ├── pom.xml
│   ├── Dockerfile
│   ├── .gitignore
│   └── README.md
│
├── frontend-web/                     # React/Next.js Admin Dashboard (JavaScript)
│   ├── public/
│   │   └── (favicon, assets)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ShipmentForm.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── common/
│   │   ├── pages/
│   │   │   ├── index.jsx
│   │   │   ├── dashboard.jsx
│   │   │   ├── shipments.jsx
│   │   │   └── clients.jsx
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── index.jsx
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── next.config.js (if using Next.js)
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

**Backend (by domain):** Features live in vertical slices (`domain/shipment/`, `domain/billing/`). Each domain owns its entities, repos, and services. Controllers sit at the API layer and delegate to services.

- **Why:** Domain-driven design reduces coupling. Adding a new feature (e.g., `domain/returns/`) requires no changes to existing domains.
- **Example:** A request to register a shipment flows: `ShipmentController` → `ShipmentService` → `ShipmentRepository` → `Shipment` entity. All within `domain/shipment/`.

**Frontend Web:** Standard React structure — components, pages, API client, hooks, utilities.

- **Why:** Familiar layout for any React dev. Easy to scale horizontally (add new pages/components).
- **API client:** Centralized in `api/client.js` — shared by all components, single point to change the backend URL.

**Frontend Mobile:** Expo Router file-based routing. Screens in `app/`, components in `components/`, API client shared pattern.

- **Why:** File-based routing mirrors Next.js; juniors transitioning between web and mobile see consistency.
- **Parallel with web:** Both use `api/client.js` pattern — no special mobile API logic, just HTTP calls.

**Root:** Configuration files that coordinate all three services (docker-compose, .gitignore, README).

- **Why:** Monorepo makes it easy to `docker-compose up` and have all three apps running locally in one command.
