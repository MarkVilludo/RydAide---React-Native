import { useEffect, useState } from 'react';
import {
  fetchMechanicProStorePrices,
  type MechanicProStorePrices,
} from '../services/mechanicProStore';

const EMPTY: MechanicProStorePrices = { monthly: null, yearly: null };

/**
 * Prefer store `displayPrice` for UI; CMS amounts remain fallback when IAP is unavailable.
 */
export function useMechanicProStorePrices(monthlyProductId: string, yearlyProductId?: string) {
  const [storePrices, setStorePrices] = useState<MechanicProStorePrices>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const result = await fetchMechanicProStorePrices({
        monthlyProductId,
        yearlyProductId,
      });
      if (!cancelled) {
        setStorePrices(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthlyProductId, yearlyProductId]);

  return { storePrices, storePricesLoading: loading };
}
