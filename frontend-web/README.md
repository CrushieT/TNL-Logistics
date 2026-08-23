# TNL Logistics - Admin Web Dashboard

React-based admin dashboard powered by **Next.js 14**.

## Prerequisites

- **Node.js 18+**
- **npm** or **yarn**

## Getting Started

1. Navigate to this directory:
   ```bash
   cd frontend-web
   ```
2. Copy the environment variables template and configure it:
   ```bash
   cp .env.example .env.local
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the local development server:
   ```bash
   npm run dev
   ```
   *The dashboard will run on [http://localhost:3000](http://localhost:3000).*

## Features Scaffolded

- **Axios API Client:** Configured in `src/api/client.js` with base URL environment routing.
- **Shipment Registration Form:** Located in `src/components/ShipmentForm.jsx`.
- **Admin Dashboard:** Displays active shipments using reactive `swr` polling in `src/pages/Dashboard.jsx`.
- **Tailwind CSS integration.**
