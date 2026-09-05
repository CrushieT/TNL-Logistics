# TNL Logistics — Admin Web Portal

React Native Web (Expo Router) admin console for TNL Logistics. This is the
desktop/office-side app: register shipments, generate parcel QR labels,
track shipment status, and manage billing. It shares the Spring Boot +
MySQL backend with the mobile field app.

Built to match the approved prototype 1:1 — monospace type, off-white
canvas, black ink, single burnt-orange accent for primary actions and
alerts.

## Stack

- Expo SDK 51 + Expo Router (file-based routes)
- React Native Web
- Axios (`api/client.js`) with automatic JWT injection
- Plain JavaScript (no TypeScript), matching the rest of the monorepo

## Getting started

```bash
npm install
cp .env.example .env
# edit .env and point EXPO_PUBLIC_API_URL at your local Spring Boot backend
npm run web
```

The dev server opens at `http://localhost:8081` (or whatever port Expo
picks). Every screen currently falls back to realistic demo data if the
backend endpoint isn't reachable yet, so the UI is fully clickable before
the API is wired up.

## Project structure

```
frontend-web/
├── src/
│   ├── app/                          # Expo Router file-based routes
│   │   ├── _layout.js                # Root Stack navigator & route guard
│   │   ├── +not-found.js             # Catch-all 404 Route Not Found operations card
│   │   ├── login.js                  # Screen 01 Desktop Login with brand logo & rate limiting
│   │   ├── index.js                  # Operations Dashboard
│   │   ├── register.js               # Register Shipment (form + result view)
│   │   ├── shipments/
│   │   │   ├── index.js              # Shipments list (search/filter/table)
│   │   │   └── [shipmentId]/
│   │   │       ├── index.js          # Shipment detail (units, payment)
│   │   │       └── units/
│   │   │           └── [trackingId].js  # Parcel unit detail + tracking history
│   │   ├── vehicles.js               # Vehicle fleet management & smart delete
│   │   ├── clients.js                # Client directory & profile view
│   │   ├── waybills.js               # Waybill management & printable manifests
│   │   ├── payments.js               # Screen 18 Payment recording & installment ledger
│   │   ├── weekly-collections.js     # Screen 19 Weekly Collections consolidation dashboard
│   │   ├── statements.js             # Screen 20 Statements of Account (SOA) preview & deductions
│   │   └── statements/
│   │       └── print.js              # Screen 22 Dedicated isolated printable SOA document
│   │
│   ├── components/                   # Common UI Components
│   │   ├── layout/
│   │   │   ├── AppShell.js           # Responsive Sidebar + TopBar shell
│   │   │   ├── Sidebar.js            # Left nav (Operations / Billing / Admin)
│   │   │   └── TopBar.js             # Real-time parcel & shipment KPI strip
│   │   └── common/                   # MetricCards, StatusBadges, Buttons, Inputs
│   │
│   ├── features/                     # Domain Feature Modules
│   │   ├── shipments/                # Shipment registration, table, QR preview
│   │   ├── vehicles/                 # Fleet registry, CRUD modals, live counters
│   │   ├── clients/                  # Client directory, profile view, rate models
│   │   ├── waybills/                 # Waybill manifest cards, hauler assignment
│   │   ├── payments/                 # Record payment modal, installment ledger modal
│   │   └── collections/              # Weekly table, Batch SOA modal, Statement paper card
│   │
│   ├── services/
│   │   └── api/
│   │       ├── client.js             # Axios client with JWT auto-refresh & 401/403 retry
│   │       └── sseClient.js          # Server-Sent Events real-time event subscriptions
│   │
│   └── theme/                        # Design System Tokens (Colors, Typography, Spacing)
│
├── package.json
└── README.md
```

## Design tokens

All colors, type, spacing, and status-pill mappings live in
`src/theme/`. Nothing else should hardcode a hex value or font —
import from there so a future re-theme only touches one file.

Key choices lifted from the prototype:
- **Font:** system monospace stack throughout (labels, values, buttons — everything)
- **Canvas:** `#F3F2ED` off-white; **Surface:** `#FFFFFF` cards on hairline `#E1DFD5` borders
- **Accent:** `#C6491F` burnt orange-red, reserved for primary actions, active nav, and balances due
- **Status pills:** blue = Registered/QR Generated, muted = Loaded on Truck, green = Arrived/Loaded to Hauler/SOA Generated

## Feature Implementations

1. **Shipment Management (Screens 1–5):** Full volumetric calculation, instant vector thermal QR printing, tracking inspection, and parcel timeline audit.
2. **Fleet & Client Management (Screens 7, 15, 16):** Live on-truck cargo counters, smart delete engine, and profile balance rollups.
3. **Waybills & Freight Manifests (Screens 11, 13):** Sequential auto-numbering, 3-stage custody transition, and landscape printable manifest.
4. **Payments & Installments Ledger (Screen 18):** Payment recording with balance ceiling restriction, reference validation (Cash, GCash, Bank Transfer, Cheque), and compounding ledger audit.
5. **Weekly Collections Consolidation (Screen 19):** Thursday consolidation dashboard, active cycle dropdown filters, and single & batch SOA generation triggers.
6. **Statement of Account Document & Print (Screens 20, 22):** Multi-page A4 printable document with dynamic pagination, continuation headers, deduction adjustments, authorized collector selection, and isolated browser printing.
7. **Authentication & Session Protection (Screen 01):** Desktop login with brand artwork, central route guarding with return URL redirection, in-memory rate limit lockout with live countdown, and sidebar user session controls.
