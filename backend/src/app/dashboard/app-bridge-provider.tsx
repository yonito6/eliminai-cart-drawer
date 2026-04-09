'use client';

import { ReactNode, useEffect } from 'react';

interface Props { children: ReactNode; }

export default function AppBridgeProvider({ children }: Props) {
  useEffect(() => {
    // Detect if we're inside Shopify admin iframe
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host');
    const shop = params.get('shop');

    if (host && shop) {
      // Store context for API calls
      (window as any).__shopifyHost = host;
      (window as any).__shopifyShop = shop;
    }
  }, []);

  return <>{children}</>;
}
