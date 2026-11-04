# Mechanic Pro — App Store, Play Store, EAS, and sandbox

## Canonical IDs (keep these aligned everywhere)

| Item | Value |
|------|--------|
| iOS bundle ID | `com.rydaid.mobile` |
| Android package | `com.rydaid.mobile` |
| Subscription product ID (iOS + Android SKU) | `com.rydaid.mechanic.pro.monthly` |

**Laravel** (`.env`):

```env
APP_STORE_MECHANIC_PRO_PRODUCT_ID=com.rydaid.mechanic.pro.monthly
GOOGLE_PLAY_MECHANIC_PRO_PRODUCT_ID=com.rydaid.mechanic.pro.monthly
GOOGLE_PLAY_PACKAGE_NAME=com.rydaid.mobile
APP_STORE_SHARED_SECRET=<from App Store Connect → app → Subscriptions → App-Specific Shared Secret>
APP_STORE_USE_SANDBOX=true
```

**Mobile** (`.env` or EAS `env` in `eas.json`):

```env
EXPO_PUBLIC_MECHANIC_PRO_PRODUCT_ID=com.rydaid.mechanic.pro.monthly
EXPO_PUBLIC_STORE_SANDBOX=true
```

---

## App Store Connect

1. Create app with bundle ID **`com.rydaid.mobile`**.
2. **Subscriptions** → create subscription group (e.g. `Mechanic Pro`).
3. Add auto-renewable subscription:
   - **Product ID:** `com.rydaid.mechanic.pro.monthly`
   - Duration: 1 month
   - Price tier (Philippines or base country)
4. Copy **App-Specific Shared Secret** into Laravel `APP_STORE_SHARED_SECRET`.
5. **Users and Access → Sandbox → Testers** — add sandbox Apple IDs for device testing.

Sandbox purchases only work on **development / TestFlight** builds signed with your team, not on production App Store users.

---

## Google Play Console

1. Create app with package **`com.rydaid.mobile`** (must match `android.package` in Expo).
2. **Monetize → Subscriptions** → create subscription ID **`com.rydaid.mechanic.pro.monthly`** with a base plan (monthly).
3. **Setup → API access** → link Google Cloud project → create **service account** with Play Console access → download JSON → set Laravel `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=/secure/path/play-service-account.json`.
4. **Internal testing** track: add testers, upload AAB from EAS `internal-android` profile.

Play license testers can make test purchases without being charged.

---

## EAS build profiles

| Profile | Use | Sandbox env |
|---------|-----|-------------|
| `development` | Dev client + IAP debugging | `EXPO_PUBLIC_STORE_SANDBOX=true` |
| `preview` | Internal APK/IPA for QA | sandbox |
| `testflight` | iOS TestFlight (store distribution) | sandbox |
| `internal-android` | Play internal testing AAB | sandbox |
| `production` | Live App Store / Play | `EXPO_PUBLIC_STORE_SANDBOX=false` |

### First-time setup

```bash
cd RydAidMobile
npm install
npx eas login
npx eas init   # links project; sets EXPO_PUBLIC_EAS_PROJECT_ID
```

Edit `eas.json` → replace `REPLACE_WITH_APPLE_TEAM_ID` and `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` under `submit`.

### Build commands

```bash
# iOS TestFlight (sandbox IAP while APP_STORE_USE_SANDBOX=true on API)
npx eas build --profile testflight --platform ios

# Android internal testing
npx eas build --profile internal-android --platform android

# Submit after build
npx eas submit --profile testflight --platform ios --latest
npx eas submit --profile internal-android --platform android --latest
```

IAP **does not work in Expo Go**. Use a build from the profiles above (`npx expo prebuild` is handled by EAS).

---

## End-to-end sandbox test

1. Laravel staging API reachable from the phone (`EXPO_PUBLIC_API_URL`).
2. Laravel: `APP_STORE_USE_SANDBOX=true`, shared secret set, product IDs match table above.
3. Build with `testflight` or `preview`, install on device.
4. Sign in with a **mechanic** account, exhaust free credits or use a fresh mechanic.
5. **Mechanic Pro → Subscribe** → complete sandbox purchase.
6. App calls `POST /api/v1/mechanic/subscription/verify-purchase` with `sandbox: true` when `EXPO_PUBLIC_STORE_SANDBOX=true`.
7. Confirm **Mechanic Pro** active and accept HELP requests without `SUBSCRIPTION_REQUIRED`.

---

## Troubleshooting

- **Product not found:** SKU mismatch between store console, `EXPO_PUBLIC_MECHANIC_PRO_PRODUCT_ID`, and Laravel env.
- **Verification failed:** wrong shared secret, sandbox receipt sent to production verify URL (API auto-retries sandbox on 21007), or Google service account lacks permission.
- **Purchase succeeds but Pro not active:** check API logs for verify-purchase; ensure user is authenticated with Sanctum token.
