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

  // Resolve the shop domain from multiple sources (priority order):
  // 1. URL ?shop= param (most reliable — Shopify always passes on initial load)
  // 2. window.__shopifyShop (set by AppBridgeProvider from initial URL)
  // 3. localStorage cache (only if it matches one of the above)
  function getShopDomain(): string | null {
    if (typeof window === 'undefined') return null;
    const urlShop = new URLSearchParams(window.location.search).get('shop');
    if (urlShop) return urlShop;
    const bridgeShop = (window as any).__shopifyShop;
    if (bridgeShop) return bridgeShop;
    return null;
  }

  const [store, setStore] = useState<StoreInfo | null>(() => {
    try {
      const cached = localStorage.getItem('ccd_store');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // Only use cache if it matches the current shop context
      const currentShop = getShopDomain();
      if (currentShop && parsed.shopDomain !== currentShop) return null;
      return parsed;
    } catch {}
    return null;
  });
  const [allStores, setAllStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Use searchParams first, then fall back to AppBridge global
    const shop = searchParams.get('shop') || getShopDomain();
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
