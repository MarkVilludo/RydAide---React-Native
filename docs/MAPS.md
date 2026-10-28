# Maps (RydAid Mobile)

## Android (Find mechanic)

Uses **`expo-maps` → Google Maps**. It does **not** load OpenStreetMap volunteer tiles (`tile.openstreetmap.org`), so you should not see the OSM “access blocked” overlay.

If the map is **gray or empty** on Android, add a Google Maps API key (free tier):

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs → enable **Maps SDK for Android** only  
2. Create an API key restricted to your app (package + SHA-1) and to that API  
3. `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
   ```
4. Restart: `npx expo start -c`  
5. Force-quit **Expo Go** and scan the QR code again  

Set a **$0 budget alert** in Google Cloud if you enable billing.

## iOS (Find mechanic)

Uses **Apple Maps** via `react-native-maps` (no OSM tile URLs).

## After any change

```bash
npx expo start -c
```

Force-quit Expo Go on the phone so old JavaScript (with UrlTile / OSM) is not reused.
