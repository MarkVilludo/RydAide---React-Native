# Push notifications (RydAid Mobile + Laravel)

## Architecture

- **Delivery only**: No in-app notification bell or center — alerts are **push-only** (Expo / FCM).
- **Tokens**: Stored in `user_push_tokens`; Laravel sends via [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/) (`expo_push` channel).
- **Dedupe**: Server still writes to Laravel `notifications` for event deduplication; the app does not read that API.

## Laravel `.env`

```env
RYDAID_PUSH_ENABLED=true
# Optional — Expo push API access token for higher rate limits
EXPO_ACCESS_TOKEN=
```

Run migrations (includes `user_push_tokens`):

```bash
php artisan migrate
```

Help alerts are sent **synchronously** with the request (no queue worker required for push).

## Mobile

### Dev build required

**Expo Go does not support remote push.** Use a development build:

```bash
npx expo run:android
# or
npx expo run:ios
```

### EAS project ID

Set in `RydAidMobile/.env`:

```env
EXPO_PUBLIC_EAS_PROJECT_ID=<your-eas-project-uuid>
```

Create/link a project with `eas init` if needed. Without this, the app cannot obtain an Expo push token.

### Android FCM

1. Firebase project + Android app (package from `app.config.js`).
2. `google-services.json` in the project root.
3. Rebuild the dev client after adding FCM.

### Runtime

- Permissions are requested after login (`NotificationsProvider`).
- Token: `POST /api/v1/push-tokens`; removed on logout (`push_token` on `POST /auth/logout`).
- Tap push → owner `ActiveHelpRequest` / `HelpRequestDetail` or mechanic `ActiveJob` / `IncomingRequestDetail`.
- Cold start uses pending navigation + active job recovery APIs.

## Limitations

- Push is not guaranteed (Doze, force-stop, OEM battery savers).
- Payloads avoid sensitive data (no passwords, full addresses, or payment details).
