# RydAidMobile — deployment build (summary)

Full stack guide: **[RydAid/docs/DEPLOYMENT.md](../RydAid/docs/DEPLOYMENT.md)** (path from monorepo; adjust if repos are separate).

## Quick steps

1. **Deploy Laravel API** with HTTPS (see backend doc). Note the URL: `https://api.yourdomain.com/api/v1`.

2. **Expo env** (expo.dev → your project → Environment variables):
   - Profile `internal-android` or `production`
   - `EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1`

3. **Build** (not Expo Go):

   ```bash
   npx eas build --profile internal-android --platform android
   ```

4. **Submit to Play**:

   ```bash
   npx eas submit --profile internal-android --platform android --latest
   ```

5. Play Console → internal testing → install from opt-in link.

6. **Production** when ready:

   ```bash
   npx eas build --profile production --platform android
   npx eas submit --profile production --platform android --latest
   ```

Set `EXPO_PUBLIC_STORE_SANDBOX=false` on production profile; Laravel `STORE_VERIFICATION_MODE=live`.
