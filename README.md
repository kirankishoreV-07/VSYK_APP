# VSYK App

Mobile app for VSYK Chit Funds — built with Expo (React Native) and a Node.js backend.

## Project Structure

```
VSYK_APP/
├── Frontend/          # Expo React Native app (Expo Go)
│   ├── app/           # Screens (expo-router)
│   ├── components/    # UI components
│   ├── lib/           # Supabase, API, utilities
│   └── supabase/      # Database migrations
└── Backend/           # Express API server
    └── src/           # Server routes & logic
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo Go](https://expo.dev/go) on your phone (iOS / Android)
- Supabase project (URL + anon key)

## Quick Start — Expo Go

### 1. Frontend (Mobile App)

```bash
cd Frontend
cp .env.example .env
# Edit .env with your Supabase credentials
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

**Share with testers (different network):**

```bash
npx expo start --tunnel
```

### 2. Backend (API Server)

```bash
cd Backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

Runs on `http://localhost:5000` by default.

> For physical devices, set `EXPO_PUBLIC_API_URL` in `Frontend/.env` to your machine's LAN IP (e.g. `http://192.168.1.10:5000`) or a deployed backend URL.

## Environment Variables

| File | Variable | Description |
|------|----------|-------------|
| `Frontend/.env` | `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `Frontend/.env` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `Frontend/.env` | `EXPO_PUBLIC_API_URL` | Backend API base URL |
| `Backend/.env` | `PORT` | Server port (default 5000) |
| `Backend/.env` | `SUPABASE_URL` | Supabase project URL |
| `Backend/.env` | `SUPABASE_ANON_KEY` | Supabase anon key |
| `Backend/.env` | `RAZORPAY_KEY_ID` | Razorpay key (payments) |
| `Backend/.env` | `RAZORPAY_KEY_SECRET` | Razorpay secret |

## Database Migrations

SQL migrations are in `Frontend/supabase/migrations/`. Apply them in your Supabase dashboard (SQL Editor) or via the Supabase CLI.

## Scripts

| Location | Command | Description |
|----------|---------|-------------|
| `Frontend/` | `npm start` | Start Expo dev server |
| `Frontend/` | `npm run android` | Open on Android emulator |
| `Frontend/` | `npm run ios` | Open on iOS simulator |
| `Backend/` | `npm run dev` | Start API with hot reload |
| `Backend/` | `npm run build` | Compile TypeScript |
| `Backend/` | `npm start` | Run compiled server |