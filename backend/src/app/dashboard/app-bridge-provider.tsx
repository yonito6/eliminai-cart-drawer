'use client';

import { ReactNode, useEffect } from 'react';
import Script from 'next/script';

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

  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  return (
    <>
      {apiKey && (
        <Script
          src={`https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${apiKey}`}
          strategy="beforeInteractive"
        />
      )}
      {children}
    </>
  );
}
