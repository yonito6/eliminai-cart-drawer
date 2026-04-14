'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface StoreInfo {
  id: string;
  shopName: string;
  shopDomain: string;
  currency: string;
}

export function useStore() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [store, setStore] = useState<StoreInfo | null>(() => {
    try {
      const cached = localStorage.getItem('ccd_store');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // If ?shop= is in the URL and it doesn't match cached store, ignore cache
      if (typeof window !== 'undefined') {
        const urlShop = new URLSearchParams(window.location.search).get('shop');
        if (urlShop && parsed.shopDomain !== urlShop) return null;
      }
      return parsed;
    } catch {}
    return null;
  });
  const [allStores, setAllStores] = useState<StoreInfo[]>([]);
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
        if (data.allStores) setAllStores(data.allStores);
      })
      .catch(() => setError('Failed to resolve store'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const switchStore = useCallback((domain: string) => {
    // Clear cache and reload with the selected store
    try { localStorage.removeItem('ccd_store'); } catch {}
    const params = new URLSearchParams(window.location.search);
    params.set('shop', domain);
    router.push(window.location.pathname + '?' + params.toString());
  }, [router]);

  return {
    store,
    storeId: store?.id || null,
    loading: store ? false : loading,
    error,
    allStores,
    switchStore,
  };
}
