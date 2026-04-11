'use client';

import { ReactNode, useEffect, useState } from 'react';

interface Props { children: ReactNode; }

export default function AppBridgeProvider({ children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host');
    const shop = params.get('shop');

    if (host && shop) {
      (window as any).__shopifyHost = host;
      (window as any).__shopifyShop = shop;
    }

    // Check if we're inside Shopify admin (embedded mode)
    const isEmbedded = params.get('embedded') === '1' || !!host;

    if (isEmbedded) {
      // Wait for App Bridge to initialize (shopify global)
      const check = () => {
        if ((window as any).shopify) {
          setReady(true);
        } else {
          // Retry — app-bridge.js loads async from CDN
          setTimeout(check, 100);
        }
      };
      check();

      // Safety timeout — don't block forever
      setTimeout(() => setReady(true), 3000);
    } else {
      // Not embedded — render immediately
      setReady(true);
    }
  }, []);

  if (!ready) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#fafafa',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Loading Cart Optimizer...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
