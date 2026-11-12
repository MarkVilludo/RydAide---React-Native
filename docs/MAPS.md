# Maps (RydAid Mobile)

## Android (Find mechanic)

Uses **`expo-maps` → Google Maps**. It does **not** load OpenStreetMap volunteer tiles (`tile.openstreetmap.org`), so you should not see the OSM “access blocked” overlay.

If the map is **gray or empty** on Android — or a **release APK crashes after login** when opening an active job / mechanic map — add a Google Maps API key (free tier):

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs → enable **Maps SDK for Android** (and iOS if needed)  
2. Create an API key restricted to your app (package + SHA-1) and to that API  
3. Local `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
   ```
4. For **EAS builds**, also set the same var as an EAS secret or under the profile `env` in `eas.json` (it must be present at **build** time so `app.config.js` can write it into the native project)  
5. Restart: `npx expo start -c` (Expo Go) or rebuild the APK/AAB  

Set a **$0 budget alert** in Google Cloud if you enable billing.

## iOS (Find mechanic)

Uses **Apple Maps** via `react-native-maps` (no OSM tile URLs).

## After any change

```bash
npx expo start -c
```

Force-quit Expo Go on the phone so old JavaScript (with UrlTile / OSM) is not reused.
