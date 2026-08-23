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
├── frontend-web/                     # React Native (Expo) Admin Web (JavaScript)
│   ├── app/
│   │   ├── _layout.js
│   │   └── index.js
│   ├── api/
│   │   └── client.js
│   ├── components/
│   │   ├── ShipmentForm.js
│   │   └── common/
│   ├── app.json                      # Expo web configuration
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
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

**Frontend Web:** Expo Router file-based routing configured for Web (React Native Web). Structure mirrors the mobile app structure.

- **Why:** Allows sharing design guidelines, components, and libraries with the mobile app while keeping separate, web-specific desktop layouts.
- **API client:** Centralized in `api/client.js` — shared by all components, single point to change the backend URL for web admin actions.

**Frontend Mobile:** Expo Router file-based routing targeting iOS and Android natively.

- **Why:** Provides standard, high-performance native experiences for mobile sensors (camera scan, bluetooth).
- **Parallel with web:** Uses a similar structure and the exact same `api/client.js` connection pattern to communicate with the Spring Boot backend.

**Root:** Configuration files that coordinate all three services (docker-compose, .gitignore, README).

- **Why:** Monorepo makes it easy to `docker-compose up` and have all three apps running locally in one command.
