# TNL Logistics - Admin Web Portal

Expo-based admin dashboard powered by **React Native Web**.

## Prerequisites

- **Node.js 18+**
- **npm** or **yarn**

## Getting Started

1. Navigate to this directory:
   ```bash
   cd frontend-web
   ```
2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Expo web bundler:
   ```bash
   npm run start
   ```
   *The dashboard will compile and open on [http://localhost:3000](http://localhost:3000).*

## Features Scaffolded

- **Axios API Client:** Configured in `api/client.js`.
- **Shipment Registration Form:** Located in `components/ShipmentForm.js`.
- **Dashboard:** Displays active shipments using standard React Native view components and polling in `app/index.js`.
- **UI System:** Integrated with `react-native-paper` component libraries.
