import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { verifyMechanicProStorePurchase } from '../api/mechanicSubscription';
import { MECHANIC_PRO_SUBSCRIPTION_ID, MECHANIC_PRO_YEARLY_SUBSCRIPTION_ID, STORE_SANDBOX } from '../constants/storeBilling';

type Purchase = Record<string, unknown>;

export const STORE_BILLING_UNAVAILABLE_MESSAGE =
  'Google Play / App Store billing is not available in Expo Go. Install a RydAid build from EAS (e.g. npm run build:android:apk), then open that app — not Expo Go — and try Subscribe again.';

let iapModule: typeof import('expo-iap') | null | undefined;
let nativeIapChecked = false;
let nativeIapAvailable = false;

function isExpoIapNativeLinked(): boolean {
  if (nativeIapChecked) {
    return nativeIapAvailable;
  }
  nativeIapChecked = true;
  if (isRunningInExpoGo()) {
    nativeIapAvailable = false;
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    requireNativeModule('ExpoIap');
    nativeIapAvailable = true;
  } catch {
    nativeIapAvailable = false;
  }
  return nativeIapAvailable;
}

/** True on iOS/Android dev client or store build where expo-iap native code is linked. */
export function isStoreBillingNativeAvailable(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && isExpoIapNativeLinked();
}

async function loadIapModule(): Promise<typeof import('expo-iap') | null> {
  if (!isStoreBillingNativeAvailable()) {
    iapModule = null;
    return null;
  }
  if (iapModule !== undefined) {
    return iapModule;
  }
  try {
    iapModule = await import('expo-iap');
    return iapModule;
  } catch {
    iapModule = null;
    return null;
  }
}

export function mechanicProMonthlyProductId(): string {
  return MECHANIC_PRO_SUBSCRIPTION_ID;
}

export function mechanicProYearlyProductId(): string {
  return MECHANIC_PRO_YEARLY_SUBSCRIPTION_ID;
}

/** @deprecated use mechanicProMonthlyProductId */
export function mechanicProProductId(): string {
  return MECHANIC_PRO_SUBSCRIPTION_ID;
}

export function isNativeStoreBillingAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type StoreProductPrice = {
  productId: string;
  /** Localized label from the store (e.g. "₱99.00"). */
  displayPrice: string;
  /** Numeric major units when provided — used for savings math. */
  price: number | null;
  currency: string | null;
};

export type MechanicProStorePrices = {
  monthly: StoreProductPrice | null;
  yearly: StoreProductPrice | null;
};

function normalizeStoreProduct(raw: Record<string, unknown>, fallbackId: string): StoreProductPrice | null {
  const productId =
    (typeof raw.id === 'string' && raw.id) ||
    (typeof raw.productId === 'string' && raw.productId) ||
    fallbackId;
  const offers = Array.isArray(raw.subscriptionOffers)
    ? (raw.subscriptionOffers as Array<Record<string, unknown>>)
    : [];
  const firstOffer = offers[0];
  const displayPrice =
    (typeof raw.displayPrice === 'string' && raw.displayPrice.trim()) ||
    (typeof raw.localizedPrice === 'string' && raw.localizedPrice.trim()) ||
    (typeof firstOffer?.displayPrice === 'string' && firstOffer.displayPrice.trim()) ||
    '';
  if (!displayPrice) {
    return null;
  }
  const priceFromOffer =
    typeof firstOffer?.price === 'number' && Number.isFinite(firstOffer.price) ? firstOffer.price : null;
  const price =
    typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : priceFromOffer;
  const currency =
    (typeof raw.currency === 'string' && raw.currency.trim()) ||
    (typeof firstOffer?.currency === 'string' && firstOffer.currency.trim()) ||
    null;
  return { productId, displayPrice, price, currency };
}

/**
 * Load localized subscription prices from App Store / Play (source of truth for billing UI).
 * Returns nulls when IAP is unavailable (Expo Go, sideload without billing, missing SKUs).
 */
export async function fetchMechanicProStorePrices(opts: {
  monthlyProductId: string;
  yearlyProductId?: string;
}): Promise<MechanicProStorePrices> {
  const empty: MechanicProStorePrices = { monthly: null, yearly: null };
  const IAP = await loadIapModule();
  if (!IAP) {
    return empty;
  }

  const monthlyId = opts.monthlyProductId.trim();
  const yearlyId = opts.yearlyProductId?.trim() || '';
  const skus = [monthlyId, yearlyId].filter(Boolean);
  if (skus.length === 0) {
    return empty;
  }

  try {
    await IAP.initConnection();
  } catch {
    return empty;
  }

  try {
    const products = await IAP.fetchProducts({ skus, type: 'subs' });
    const byId = new Map<string, StoreProductPrice>();
    for (const item of products ?? []) {
      const normalized = normalizeStoreProduct(item as unknown as Record<string, unknown>, '');
      if (normalized?.productId) {
        byId.set(normalized.productId, normalized);
      }
    }
    return {
      monthly: monthlyId ? byId.get(monthlyId) ?? null : null,
      yearly: yearlyId ? byId.get(yearlyId) ?? null : null,
    };
  } catch {
    return empty;
  } finally {
    void IAP.endConnection();
  }
}

function normalizePurchase(purchase: Purchase, fallbackProductId: string) {
  const productId =
    (typeof purchase.productId === 'string' && purchase.productId) ||
    (typeof purchase.productIdentifier === 'string' && purchase.productIdentifier) ||
    fallbackProductId;

  return {
    productId,
    transactionId:
      (typeof purchase.transactionId === 'string' && purchase.transactionId) ||
      (typeof purchase.orderId === 'string' && purchase.orderId) ||
      undefined,
    purchaseToken:
      (typeof purchase.purchaseToken === 'string' && purchase.purchaseToken) ||
      (typeof purchase.token === 'string' && purchase.token) ||
      undefined,
    receiptData:
      (typeof purchase.transactionReceipt === 'string' && purchase.transactionReceipt) ||
      (typeof purchase.receiptData === 'string' && purchase.receiptData) ||
      undefined,
    originalTransactionId:
      (typeof purchase.originalTransactionIdentifierIOS === 'string' &&
        purchase.originalTransactionIdentifierIOS) ||
      (typeof purchase.originalTransactionId === 'string' && purchase.originalTransactionId) ||
      undefined,
  };
}

async function androidSubscriptionOffers(
  IAP: typeof import('expo-iap'),
  productId: string,
): Promise<{ sku: string; offerToken: string }[] | undefined> {
  if (Platform.OS !== 'android') {
    return undefined;
  }

  const products = await IAP.fetchProducts({ skus: [productId], type: 'subs' });
  const first = products[0] as Purchase | undefined;
  const offers = first?.subscriptionOffers as Array<{ offerToken?: string; sku?: string }> | undefined;
  const token = offers?.[0]?.offerToken;
  if (!token) {
    return undefined;
  }

  return [{ sku: productId, offerToken: token }];
}

/**
 * Store subscription purchase → server verification → finish transaction.
 * Requires EAS dev/preview/TestFlight build with expo-iap (not Expo Go).
 */
export async function purchaseMechanicPro(productId: string = MECHANIC_PRO_SUBSCRIPTION_ID): Promise<void> {
  const IAP = await loadIapModule();
  if (!IAP) {
    throw new Error(STORE_BILLING_UNAVAILABLE_MESSAGE);
  }

  try {
    await IAP.initConnection();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ExpoIap|native module/i.test(msg)) {
      throw new Error(STORE_BILLING_UNAVAILABLE_MESSAGE);
    }
    if (/not connected|BillingClient|service disconnected|billing.*unavailable/i.test(msg)) {
      throw new Error(
        Platform.OS === 'android'
          ? 'Google Play Billing is not connected. Sideloaded debug APKs usually cannot purchase. Upload an AAB to Play Console (internal testing), install that build from Play Store while signed into a license-tester Google account, and ensure product com.rydaid.mechanic.pro.monthly exists. For local API testing, use Simulate payment when the server enables it.'
          : 'App Store is not connected. Use a TestFlight / sandbox build signed with your Apple team, and a Sandbox Apple ID.',
      );
    }
    throw e;
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = (purchaseSub: { remove: () => void }, errorSub: { remove: () => void }) => {
      purchaseSub.remove();
      errorSub.remove();
      void IAP.endConnection();
    };

    const fail = (purchaseSub: { remove: () => void }, errorSub: { remove: () => void }, error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup(purchaseSub, errorSub);
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const purchaseSub = IAP.purchaseUpdatedListener(async (purchase) => {
      if (settled) return;
      try {
        const normalized = normalizePurchase(purchase as Purchase, productId);
        await verifyMechanicProStorePurchase({
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          product_id: normalized.productId,
          purchase_token: normalized.purchaseToken,
          receipt_data: normalized.receiptData,
          transaction_id: normalized.transactionId,
          original_transaction_id: normalized.originalTransactionId,
          sandbox: STORE_SANDBOX,
        });
        await IAP.finishTransaction({ purchase, isConsumable: false });
        settled = true;
        cleanup(purchaseSub, errorSub);
        resolve();
      } catch (e) {
        fail(purchaseSub, errorSub, e);
      }
    });

    const errorSub = IAP.purchaseErrorListener((error) => {
      fail(purchaseSub, errorSub, error);
    });

    void (async () => {
      try {
        const subscriptionOffers = await androidSubscriptionOffers(IAP, productId);
        await IAP.requestPurchase({
          type: 'subs',
          request: {
            apple: { sku: productId },
            google: {
              skus: [productId],
              subscriptionOffers,
            },
          },
        });
      } catch (e) {
        fail(purchaseSub, errorSub, e);
      }
    })();
  });
}

/**
 * Restore: look up Mechanic Pro purchases the store already holds for this store account and send
 * them to the server for verification (same endpoint as a new purchase). Resolves to the number of
 * purchases verified; 0 means the store has nothing to restore.
 */
export async function restoreMechanicProPurchases(productIds: string[]): Promise<number> {
  const IAP = await loadIapModule();
  if (!IAP) {
    throw new Error(STORE_BILLING_UNAVAILABLE_MESSAGE);
  }
  await IAP.initConnection();
  try {
    const held = ((await IAP.getAvailablePurchases()) ?? []) as unknown as Purchase[];
    const wanted = new Set(productIds.filter(Boolean));
    let restored = 0;
    for (const purchase of held) {
      const normalized = normalizePurchase(purchase, productIds[0] ?? MECHANIC_PRO_SUBSCRIPTION_ID);
      if (wanted.size > 0 && !wanted.has(normalized.productId)) continue;
      await verifyMechanicProStorePurchase({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        product_id: normalized.productId,
        purchase_token: normalized.purchaseToken,
        receipt_data: normalized.receiptData,
        transaction_id: normalized.transactionId,
        original_transaction_id: normalized.originalTransactionId,
        sandbox: STORE_SANDBOX,
      });
      restored += 1;
    }
    return restored;
  } finally {
    void IAP.endConnection();
  }
}
