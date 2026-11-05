# RydAidMobile — deployment build (summary)

Full stack guide: **[RydAid/docs/DEPLOYMENT.md](../RydAid/docs/DEPLOYMENT.md)** (path from monorepo; adjust if repos are separate).

## Quick steps

1. **Deploy Laravel** (API + admin + `/privacy` on one domain). Production example:
   - Admin: `https://rydaid.quantumrealm.tech/admin/login`
   - Mobile API: `https://rydaid.quantumrealm.tech/api/v1`

2. **Expo env** — `eas.json` already sets `EXPO_PUBLIC_API_URL` for `internal-android` / `production`. Local dev uses `RydAidMobile/.env` (LAN IP). See `src/config.ts` and `.env.example`.

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
