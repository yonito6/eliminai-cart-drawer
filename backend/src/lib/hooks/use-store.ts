'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface StoreInfo {
  id: string;
  shopName: string;
  shopDomain: string;
  currency: string;
}

export function useStore() {
  const searchParams = useSearchParams();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shop = searchParams.get('shop');
    if (!shop) {
      // Fallback: try localStorage (for page refreshes without ?shop=)
      try {
        const cached = localStorage.getItem('ccd_store');
        if (cached) {
          setStore(JSON.parse(cached));
          setLoading(false);
          return;
        }
      } catch {}
      setError('No shop parameter');
      setLoading(false);
      return;
    }

    fetch('/api/stores/resolve?shop=' + encodeURIComponent(shop))
      .then(r => r.json())
      .then(data => {
        if (data.store) {
          setStore(data.store);
          try { localStorage.setItem('ccd_store', JSON.stringify(data.store)); } catch {}
        } else {
          setError(data.error || 'Store not found');
        }
      })
      .catch(() => setError('Failed to resolve store'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  return { store, storeId: store?.id || null, loading, error };
}
