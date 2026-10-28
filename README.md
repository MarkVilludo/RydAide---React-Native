# RydAid Mobile (Expo)

## Requirements

- **Expo SDK 58** (matches current Expo Go from the App Store / Play Store)
- Node.js **20.19+** or **22.13+** (`nvm use` — see `.nvmrc`)
- Laravel API running and reachable on your network

## Setup

```bash
cd RydAidMobile
nvm use
cp .env.example .env
# Mac IP (Wi‑Fi): ipconfig getifaddr en0
# Edit .env — EXPO_PUBLIC_API_URL=http://THAT_IP:8000/api/v1
npm install
```

## Run (Expo Go)

Stop any old Metro/Expo process first (SDK must match Expo Go).

```bash
nvm use
npm start
```

Scan the QR code with **Expo Go** (same Wi‑Fi as your computer).

If you see “SDK 57 vs SDK 58”, pull latest, run `npm install`, and restart `npm start`.

## Upgrade Expo SDK (maintainers)

```bash
nvm use 22   # or 20.19+ if 22 is unavailable
npx expo install expo@^58.0.0 --fix
```

## API (from project root)

```bash
cd ../RydAid
php artisan serve --host=0.0.0.0 --port=8000
```

On your phone’s browser (same Wi‑Fi), open `http://YOUR_MAC_IP:8000/api/v1/app-config` — you should see JSON. If that fails, the app cannot reach the API either.

**Do not** suspend the server with Ctrl+Z — use Ctrl+C. If you suspended an old `php artisan serve`, run `jobs` then `kill %1` so only one server listens on port 8000.

After any `.env` change, restart Expo: `npx expo start -c`.

### Find mechanic map

**Android:** Google Maps via `expo-maps` (no OSM tiles). Add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` if the map is blank. See [docs/MAPS.md](docs/MAPS.md).

**Optional:** set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` only if you want Google Maps SDK tiles; restrict the key to Maps SDK for Android/iOS and set a $0 budget alert (details in `docs/MAPS.md`).

Admin CMS: http://localhost:8000/admin/login (default `admin@rydaid.test` / `password` after seeding).
