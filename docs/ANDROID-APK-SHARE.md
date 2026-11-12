# Share an Android APK (internal testing)

## Build

From `RydAidMobile/` (Node 22+):

```bash
npm run build:android:apk
```

Uses EAS profile **`internal-apk`**: release APK, production API (`EXPO_PUBLIC_API_URL` in `eas.json`).

## Install

Open the build page on Expo (link in terminal), **Download APK**, install on device. Allow install from browser/Files if prompted.

## Startup / post-login crash

### WorkManager / WorkDatabase
If the app crashes with `InitializationProvider` / `WorkDatabase.canonicalName` (often right after the splash / login while push registers), the release APK hit an **Expo SDK 58 + R8** issue. `app.config.js` keeps WorkManager/Room classes via **`expo-build-properties`**. Rebuild the APK after pulling that fix.

### Loading spinner then crash (active job / maps)
After login, an owner/mechanic with a live job is auto-opened onto a screen that mounts **Google Maps**. EAS builds need:

```bash
# Local .env AND EAS secrets / eas.json env for the build profile
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_sdk_key
```

Without the key, Android may hard-crash when the map mounts. See [MAPS.md](./MAPS.md).

## Rebuild after code changes

```bash
npm run build:android:apk
```

APK download links expire on EAS after ~14 days; create a new build to share again.
