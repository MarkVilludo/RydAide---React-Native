# Google Play — after you create the app

You created the Play Console app. Confirm **package name** is exactly:

`com.rydaid.mobile`

If you used a different package, either create a new app with this ID or change `app.config.js` / `eas.json` to match (not recommended — keep `com.rydaid.mobile`).

---

## Step 1 — Finish Play “setup” tasks (required before internal release)

In Play Console → your app → **Dashboard**, complete items that block releases, typically:

- App access  
- Ads declaration  
- Content rating (questionnaire)  
- Target audience  
- News app (usually “No”)  
- **Privacy policy** URL — use your public **`https://your-domain.com/privacy`** (page is built into Laravel at `/privacy`). For Play review you need **HTTPS** on a stable host (not raw LAN IP); use staging or ngrok until production is live.  
- Data safety form  

Until these are done, you often **cannot** publish even to internal testing.

---

## Step 2 — Create Mechanic Pro subscription

1. **Monetize with Play → Products → Subscriptions** → **Create subscription**.  
2. **Product ID:** `com.rydaid.mechanic.pro.monthly` (must match Laravel + EAS).  
3. **Base plans** → add **Monthly** plan → set price → **Activate** base plan and subscription.

Status should be **Active**, not draft-only.

---

## Step 3 — License testers (test purchases, no real charge)

1. **Setup → License testing**.  
2. Add Gmail address(es) used on your test phone’s Play Store account.  
3. Save.

---

## Step 4 — Google Play Developer API (Laravel verifies purchases)

Required when you test **real** Subscribe (not green “Simulate payment”).

1. **Setup → API access** → link Google Cloud project.  
2. Create / select **service account** → **Grant access** in Play Console (follow Google’s permission checklist).  
3. Google Cloud Console → that service account → **Keys** → **Add key → JSON** → download.  
4. On your Mac, save JSON outside git, e.g. `RydAid/storage/app/play-service-account.json`.  
5. Laravel `.env`:

```env
STORE_VERIFICATION_MODE=live
GOOGLE_PLAY_PACKAGE_NAME=com.rydaid.mobile
GOOGLE_PLAY_MECHANIC_PRO_PRODUCT_ID=com.rydaid.mechanic.pro.monthly
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=/full/path/to/play-service-account.json
```

Restart `php artisan serve` after changing `.env`.

For **local Expo + Simulate payment** only, keep `STORE_VERIFICATION_MODE=testing` (no JSON needed).

---

## Step 5 — EAS build (internal testing)

Set API URL for the build (phone must reach Laravel):

```bash
# On Mac — use this in EAS env or RydAidMobile/.env before build
ipconfig getifaddr en0
# Example: EXPO_PUBLIC_API_URL=http://192.168.1.8:8000/api/v1
```

In [expo.dev](https://expo.dev) → your project → **Environment variables** → profile **internal-android**:

- `EXPO_PUBLIC_API_URL` = your LAN or staging HTTPS API  

Then:

```bash
cd RydAidMobile
npx eas login
npx eas build --profile internal-android --platform android
npx eas submit --profile internal-android --platform android --latest
```

First build: accept EAS creating an Android **keystore** (save credentials).

---

## Step 6 — Internal testing track

1. Play Console → **Testing → Internal testing**.  
2. If submit didn’t auto-create release: **Create new release** → upload the `.aab` from EAS.  
3. **Testers** tab → email list → add Gmail(s) → copy **opt-in link**.  
4. On Android phone: open link → join test → install **RydAid** from Play Store.

---

## Step 7 — Test Mechanic Pro

1. Laravel: `php artisan serve --host=0.0.0.0 --port=8000` (same Wi‑Fi as phone if using LAN API URL).  
2. Log in: `mechanic.paytest@rydaid.test` / `password`.  
3. **Mechanic Pro** → **Subscribe via Google Play** → complete test purchase.  
4. Pro should show **ACTIVE** → accept a HELP request.

---

## iOS later (App Store Connect)

When you add iPhone: App Store Connect → app with bundle **`com.rydaid.mobile`** → subscription **`com.rydaid.mechanic.pro.monthly`** → sandbox testers → EAS profile **`testflight`**. See `IAP-EAS.md`.
