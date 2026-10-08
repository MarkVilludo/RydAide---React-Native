# RydAid Mobile (Expo)

## Requirements

- Node.js **20+** (`nvm use 20`)
- [Expo Go](https://expo.dev/go) on your phone
- Laravel API running and reachable on your network

## Setup

```bash
cd RydAidMobile
cp .env.example .env
# Edit EXPO_PUBLIC_API_URL — use your Mac LAN IP, e.g. http://192.168.1.10:8000/api/v1
npm install
```

## Run (Expo Go)

```bash
nvm use 20
npm start
```

Scan the QR code with Expo Go (same Wi‑Fi as your computer).

## API (from project root)

```bash
cd ../RydAid
php artisan serve --host=0.0.0.0 --port=8000
```

Admin CMS: http://localhost:8000/admin/login (default `admin@rydaid.test` / `password` after seeding).
