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
  const [store, setStore] = useState<StoreInfo | null>(() => {
    // Pre-fill from cache for instant render (will be validated by fetch)
    try {
      const cached = localStorage.getItem('ccd_store');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shop = searchParams.get('shop');
    const url = shop
      ? '/api/stores/resolve?shop=' + encodeURIComponent(shop)
      : '/api/stores/resolve';

    fetch(url)
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

  // If we have a cached store, don't show loading
  return { store, storeId: store?.id || null, loading: store ? false : loading, error };
}
