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
4. Start the Expo bundler (runs on port 8082 to avoid conflicting with frontend-web on 8081):
   ```bash
   npm start
   ```
5. Scan the QR code displayed in your terminal using the **Expo Go** app (Android) or the default Camera app (iOS) to load the application.

## Implemented Architecture & Features (Phase 6.1)

- **Cryptographic Server-Enforced Device Binding:** Password sign-in (`(auth)/login.js`) issues a 256-bit CSPRNG device token stored in hardware-backed `expo-secure-store`. Fast shift unlock (`(auth)/pin.js`) requires both device credentials and a 4-digit PIN.
- **Mandatory First-Boot Password Rotation:** Provisional session guards route flagged users to `(auth)/change-password.js` before device binding or PIN configuration can occur.
- **PIN Setup & Confirmation Flow:** Dedicated PIN creation flow (`(auth)/setup-pin.js`) with 4-dot tactile indicator, 3x4 mechanical numeric keypad, and automatic session JWT rotation.
- **Role-Aware Operational Shell:** Dynamic root screen (`(main)/index.js`) switching between:
  - **Office Dashboard:** Label printing shortcut, parcel registration, QR scanner, and thermal printer setup.
  - **Field Dashboard:** Scan-only operations, camera QR scanner, courier scan history, and account overview.
- **Expo Camera Viewfinder:** Real-time camera viewfinder located in `(main)/scan.js` to scan parcel QR tags and advance physical status.
- **Fail-Closed Secure Storage:** Hardware-backed `services/storage/secureStore.js` with fail-closed native enforcement (unencrypted storage fallbacks rejected on Android/iOS).
- **In-App Lifecycle Modals:** Custom animated `StatusModal.js` replacing OS alerts for admin PIN reset notifications and unbinding confirmation.

## File-based Routing Structure

Implemented using `expo-router` with structure:
- `src/app/_layout.js` - Root Stack navigator and AuthProvider lifecycle wrapper
- `src/app/(auth)/login.js` - Username and password credential login with device binding
- `src/app/(auth)/change-password.js` - Mandatory first-boot password change screen
- `src/app/(auth)/setup-pin.js` - 4-digit PIN creation and confirmation keypad
- `src/app/(auth)/pin.js` - Quick shift unlock keypad with bound staff profile card
- `src/app/(main)/_layout.js` - Authenticated and bound device route guard
- `src/app/(main)/index.js` - Role-aware home (Office vs Field Dashboard)
- `src/app/(main)/scan.js` - Interactive barcode/QR camera viewfinder
