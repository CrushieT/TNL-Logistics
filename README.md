# TNL Logistics Monorepo

Welcome to the **TNL Logistics** project! This is a multi-platform parcel management system that connects a centralized Spring Boot backend with both web and mobile frontends.

## Project Structure

This project uses a monorepo layout separating independent application concerns:

```
tnl-logistics/
├── backend/            # Spring Boot 3.4.2 + Java 21 REST API
├── frontend-web/       # React / Next.js 14 Web Dashboard (Admin interface)
├── frontend-mobile/    # Expo / React Native Field Agent App (QR Scan & Label Print)
├── docker-compose.yml  # Orchestrates development MySQL & Backend services
└── README.md           # Root documentation
```

## Tech Stack

- **Backend:** Spring Boot 3.x, Hibernate/JPA, Flyway (DB migrations), MySQL 8.0, Lombok, Springdoc OpenAPI (Swagger).
- **Web App:** Next.js 14 (JavaScript), SWR (data fetching), Tailwind CSS, Axios.
- **Mobile App:** Expo 51 (React Native), Expo Router, React Native Paper (UI), Expo Camera (QR barcode scanning).

---

## Getting Started

Follow these steps to run the complete environment locally:

### 1. Database & Backend API

To start the MySQL database and backend service in containers:
```bash
docker-compose up --build
```
- **MySQL** will bind to `localhost:3306` (Credentials: `root` / `root`, DB: `tnl_dev`).
- **Backend API** will run at [http://localhost:8080](http://localhost:8080).
- **Swagger Documentation:** Access the interactive API explorer at [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html).

*Alternatively, you can run the backend service bare-metal (Prerequisites: JDK 21, Maven 3.9):*
```bash
cd backend
mvn spring-boot:run
```

### 2. Admin Web Dashboard
The React / Next.js administration portal allows managers to view and dispatch shipments.
```bash
cd frontend-web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Courier Field Mobile App
The React Native app is used by couriers on-site to scan parcel QRs and trigger status updates.
```bash
cd frontend-mobile
npm install
npx expo start
```
*   Scan the generated CLI QR code using **Expo Go** on iOS/Android to run it on your physical device.
*   **Important:** To run on physical mobile devices, ensure your `.env` points to your computer's local IP (e.g. `192.168.x.x:8080`) rather than `localhost`.

---

## API Summary Quick-links

- **Create Shipment:** `POST /api/v1/shipments`
- **Get Shipment Details:** `GET /api/v1/shipments/{id}`
- **List All Shipments:** `GET /api/v1/shipments` (supports `clientId` query filter)
- **Update Shipment Status:** `PATCH /api/v1/shipments/{id}/status?status={PENDING|IN_TRANSIT|DELIVERED|CANCELLED}`

---

## Contributing and TODOs
- **QR Code Generation:** Implement backend generator logic to produce custom code payloads to match Flyway `qr_codes` mapping.
- **Thermal Belt Printing:** Pair ESC/POS bluetooth streams in `frontend-mobile/app/(main)/home.js`.
- **Stateless Authentication:** Replace HTTP basic security fallback in `SecurityConfig.java` with production JWT verification filter.
