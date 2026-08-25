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
├── app/                          # Expo Router file-based routes
│   ├── _layout.js                # Root Stack navigator
│   ├── index.js                  # Dashboard
│   ├── register.js               # Register Shipment (form + result view)
│   ├── shipments/
│   │   ├── index.js              # Shipments list (search/filter/table)
│   │   └── [shipmentId]/
│   │       ├── index.js          # Shipment detail (units, payment)
│   │       └── units/
│   │           └── [trackingId].js  # Parcel unit detail + tracking history
│   ├── tracking-logs.js          # placeholder — wire to GET /tracking-logs
│   ├── clients.js                # placeholder — wire to GET /clients
│   ├── payments.js               # placeholder
│   ├── weekly-collections.js     # placeholder
│   ├── statements.js             # placeholder — Statements of Account (SOA)
│   ├── reports.js                # placeholder
│   ├── users.js                  # placeholder
│   └── settings.js               # placeholder
│
├── components/
│   ├── ShipmentForm.js           # Register Shipment form
│   ├── ShipmentResultView.js     # Post-registration confirmation screen
│   ├── ShipmentsTable.js         # Shipments list table
│   ├── PrintLabelsModal.js       # "Print · N Labels" modal
│   ├── LabelPreview.js           # Physical label card (QR + meta)
│   └── common/
│       ├── AppShell.js           # Sidebar + top bar + scroll wrapper
│       ├── Sidebar.js            # Left nav (Operations/Billing/Admin)
│       ├── TopBar.js             # Shipment/parcel count strip + date
│       ├── PageHeader.js         # Eyebrow + title + action slot
│       ├── Card.js               # Bordered panel used everywhere
│       ├── Button.js             # primary/accent/secondary/ghost/danger
│       ├── FormField.js          # Labeled text input
│       ├── SelectField.js        # Labeled dropdown (native <select> on web)
│       ├── SearchFilterBar.js    # Search box + filter dropdowns
│       ├── StatusBadge.js        # Status/payment/label pill
│       ├── MetricCard.js         # Dashboard top-row tile
│       ├── DonutChart.js         # Parcel units by status
│       ├── BarChart.js           # Weekly registrations
│       ├── ComparisonBars.js     # Outstanding vs collected
│       ├── ActivityRow.js        # Recent activity list row
│       ├── QRPlaceholder.js      # Deterministic pseudo-QR (swap for real lib)
│       ├── Toast.js              # Bottom-right success toast
│       └── ComingSoon.js         # Placeholder screen for unbuilt sections
│
├── api/
│   ├── client.js                 # Axios instance, JWT auto-attach, 401 handling
│   └── shipments.js              # Shipment/client/tracking request functions
│
├── constants/
│   └── theme.js                  # Design tokens: colors, type, spacing, status maps
│
├── app.json                      # Expo web configuration
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Design tokens

All colors, type, spacing, and status-pill mappings live in
`constants/theme.js`. Nothing else should hardcode a hex value or font —
import from there so a future re-theme only touches one file.

Key choices lifted from the prototype:
- **Font:** system monospace stack throughout (labels, values, buttons — everything)
- **Canvas:** `#F3F2ED` off-white; **Surface:** `#FFFFFF` cards on hairline `#E1DFD5` borders
- **Accent:** `#C6491F` burnt orange-red, reserved for primary actions, active nav, and balances due
- **Status pills:** blue = Registered/QR Generated, muted = Loaded on Truck, green = Arrived/Loaded to Hauler

## Wiring up the real backend

Every list/detail screen currently ships with realistic fallback data so
the UI renders before the API exists. Each screen calls its real endpoint
first (see `api/shipments.js`) and only falls back on request failure —
so as soon as the corresponding Spring Boot endpoint returns real JSON in
the same shape, the fallback data stops being used automatically. No
screen code needs to change.

Expected endpoints (adjust paths in `api/shipments.js` to match your
actual controller mappings):

| Function | Method | Path |
|---|---|---|
| `getDashboardSummary()` | GET | `/dashboard/summary` |
| `listShipments(params)` | GET | `/shipments` |
| `getShipment(id)` | GET | `/shipments/{id}` |
| `registerShipment(payload)` | POST | `/shipments` |
| `getParcelUnit(trackingId)` | GET | `/parcel-units/{trackingId}` |
| `listClients()` | GET | `/clients` |
| `printLabels(shipmentId, packageIds)` | POST | `/shipments/{id}/labels/print` |
| `listTrackingLogs(params)` | GET | `/tracking-logs` |

## Notes / TODO for whoever picks this up

- `QRPlaceholder.js` renders a **visual, non-scannable** stand-in QR so the
  UI is demoable without a QR-generation dependency. Swap in a real QR
  library (e.g. `react-native-qrcode-svg`) once the backend returns the
  actual QR payload (the plain tracking-ID string per the locked schema
  decision).
- `PrintLabelsModal`'s "Print" button currently just closes the modal —
  wire it to the browser print dialog (`window.print()` scoped to the
  label grid) or to `printLabels()` + a generated PDF from the backend.
- Auth/login screen isn't included yet — `api/client.js` already handles
  JWT storage and 401s, so a login screen just needs to call `setToken()`
  on success.
- Placeholder screens (Tracking Logs, Clients, Payments, Weekly
  Collections, Statements, Reports, Users, Settings) exist so sidebar
  navigation never 404s — replace `<ComingSoon />` with real screens as
  each is built out.
