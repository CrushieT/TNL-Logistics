# Project Structure

**TNL Logistics uses a monorepo layout with three independent codebases sharing a common backend API.**

### Complete Directory Structure

```
tnl-logistics/
├── backend/                          # Spring Boot API (Java 21)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/tnl/logistics/
│   │   │   │   ├── config/
│   │   │   │   │   ├── CorsConfig.java
│   │   │   │   │   └── SecurityConfig.java
│   │   │   │   ├── controller/
│   │   │   │   │   └── ShipmentController.java
│   │   │   │   ├── dto/
│   │   │   │   │   └── .gitkeep
│   │   │   │   ├── model/
│   │   │   │   │   └── Shipment.java
│   │   │   │   ├── repository/
│   │   │   │   │   └── ShipmentRepository.java
│   │   │   │   ├── service/
│   │   │   │   │   └── ShipmentService.java
│   │   │   │   └── TnlLogisticsApplication.java
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       ├── application-dev.properties
│   │   │       ├── application-prod.properties
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

**Backend (layered):** Features are structured using a traditional layered architecture (`config`, `controller`, `dto`, `model`, `repository`, `service`). 

- **Why:** Clear separation of concerns by technical layers. Standard layout that is instantly familiar to Java/Spring developers.
- **Example:** A request to register a shipment flows: `ShipmentController` (Controller layer) → `ShipmentService` (Service layer) → `ShipmentRepository` (Data access layer) → `Shipment` (Model/Entity layer).

**Frontend Web:** Standard React structure — components, pages, API client, hooks, utilities.

- **Why:** Familiar layout for any React dev. Easy to scale horizontally (add new pages/components).
- **API client:** Centralized in `api/client.js` — shared by all components, single point to change the backend URL.

**Frontend Mobile:** Expo Router file-based routing. Screens in `app/`, components in `components/`, API client shared pattern.

- **Why:** File-based routing mirrors Next.js; juniors transitioning between web and mobile see consistency.
- **Parallel with web:** Both use `api/client.js` pattern — no special mobile API logic, just HTTP calls.

**Root:** Configuration files that coordinate all three services (docker-compose, .gitignore, README).

- **Why:** Monorepo makes it easy to `docker-compose up` and have all three apps running locally in one command.
