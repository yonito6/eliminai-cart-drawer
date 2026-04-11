'use client';

import { ReactNode, useEffect } from 'react';

interface Props { children: ReactNode; }

export default function AppBridgeProvider({ children }: Props) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host');
    const shop = params.get('shop');

    if (host && shop) {
      (window as any).__shopifyHost = host;
      (window as any).__shopifyShop = shop;
    }
  }, []);

  return <>{children}</>;
}
