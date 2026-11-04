/**
 * Must match App Store Connect + Google Play Console subscription SKU
 * and Laravel APP_STORE_MECHANIC_PRO_PRODUCT_ID / GOOGLE_PLAY_MECHANIC_PRO_PRODUCT_ID.
 */
export const MECHANIC_PRO_SUBSCRIPTION_ID =
  process.env.EXPO_PUBLIC_MECHANIC_PRO_PRODUCT_ID?.trim() || 'com.rydaid.mechanic.pro.monthly';

/** iOS bundle ID — must match App Store Connect app record. */
export const IOS_BUNDLE_IDENTIFIER =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_ID?.trim() || 'com.rydaid.mobile';

/** Android application ID — must match Play Console package name. */
export const ANDROID_PACKAGE_NAME =
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE?.trim() || 'com.rydaid.mobile';

/** When true, receipt verification uses Apple sandbox / Play test tracks (backend must allow sandbox too). */
export const STORE_SANDBOX =
  process.env.EXPO_PUBLIC_STORE_SANDBOX === 'true' || (__DEV__ && process.env.EXPO_PUBLIC_STORE_SANDBOX !== 'false');
