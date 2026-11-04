import { Platform } from 'react-native';
import { verifyMechanicProStorePurchase } from '../api/mechanicSubscription';
import { MECHANIC_PRO_SUBSCRIPTION_ID, STORE_SANDBOX } from '../constants/storeBilling';

type Purchase = Record<string, unknown>;

let iapModule: typeof import('expo-iap') | null | undefined;

async function loadIapModule(): Promise<typeof import('expo-iap') | null> {
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

export function mechanicProProductId(): string {
  return MECHANIC_PRO_SUBSCRIPTION_ID;
}

export function isNativeStoreBillingAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
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
    throw new Error(
      'In-app purchases require an EAS development or TestFlight build with expo-iap. Expo Go cannot run store billing.',
    );
  }

  await IAP.initConnection();

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
