# Share an Android APK (internal testing)

## Build

From `RydAidMobile/` (Node 22+):

```bash
npm run build:android:apk
```

Uses EAS profile **`internal-apk`**: release APK, production API (`EXPO_PUBLIC_API_URL` in `eas.json`).

## Install

Open the build page on Expo (link in terminal), **Download APK**, install on device. Allow install from browser/Files if prompted.

## Startup crash (WorkManager / WorkDatabase)

If the app crashes immediately with `InitializationProvider` / `WorkDatabase.canonicalName`, the release APK hit an **Expo SDK 58 + R8** issue. The project adds ProGuard keep rules via **`expo-build-properties`** in `app.config.js`. Rebuild the APK after pulling that fix.

## Rebuild after code changes

```bash
npm run build:android:apk
```

APK download links expire on EAS after ~14 days; create a new build to share again.
