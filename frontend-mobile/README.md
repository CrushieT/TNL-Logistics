# TNL Logistics - Courier Field App

Field Operations scanning and mobile client interface built with **Expo** and **React Native**.

## Prerequisites

- **Node.js 18+**
- **npm** or **yarn**
- **Expo Go** application installed on a physical iOS/Android device, or an active simulator.

## Getting Started

1. Navigate to this directory:
   ```bash
   cd frontend-mobile
   ```
2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
   *Note: If you are deploying on a physical device, replace `localhost` in the `.env` file with your development computer's local IP address (e.g., `http://192.168.x.x:8080`).*
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Expo bundler:
   ```bash
   npx expo start
   ```
5. Scan the QR code displayed in your terminal using the **Expo Go** app (Android) or the default Camera app (iOS) to load the application.

## Features Scaffolded

- **Expo Camera View Integration:** Located in `app/(main)/scan.js` to scan parcel QR tags.
- **REST Sync:** Connects to Spring Boot backend API `/api/v1/shipments/{id}/status` endpoints using Axios (`api/client.js`).
- **File-based Routing:** Implemented using `expo-router` with structure:
  - `(auth)/login.js` - Login view
  - `(main)/home.js` - Operations panel and stats
  - `(main)/scan.js` - Interactive barcode/QR camera view
- **ESC/POS Label Printing Hook:** Pre-integrated with `react-native-bluetooth-escpos-printer` placeholder configuration.
