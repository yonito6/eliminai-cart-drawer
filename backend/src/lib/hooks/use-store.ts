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

    if (shop) {
      // Production path: resolve by shop domain
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
      return;
    }

    // No ?shop= param — try localStorage cache first
    try {
      const cached = localStorage.getItem('ccd_store');
      if (cached) {
        setStore(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch {}

    // Dev fallback: resolve the first store in the DB
    fetch('/api/stores/resolve')
      .then(r => r.json())
      .then(data => {
        if (data.store) {
          setStore(data.store);
          try { localStorage.setItem('ccd_store', JSON.stringify(data.store)); } catch {}
        } else {
          setError('No store found. Install the app from Shopify first.');
        }
      })
      .catch(() => setError('Failed to resolve store'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  return { store, storeId: store?.id || null, loading, error };
}
