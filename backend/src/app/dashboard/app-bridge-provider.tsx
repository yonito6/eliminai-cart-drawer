'use client';

import { ReactNode, useEffect, useState, Component, ErrorInfo } from 'react';

interface Props { children: ReactNode; }

// Error boundary to catch and DISPLAY React crashes
class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message + '\n' + error.stack };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'system-ui', background: '#fef2f2', minHeight: '100vh' }}>
          <h2 style={{ color: '#dc2626', fontSize: 16 }}>Dashboard Error</h2>
          <pre style={{ fontSize: 11, color: '#991b1b', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppBridgeProvider({ children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function tryInit() {
      if (cancelled) return;

      try {
        const params = new URLSearchParams(window.location.search);
        const host = params.get('host');
        const shop = params.get('shop');

        if (host && shop) {
          (window as any).__shopifyHost = host;
          (window as any).__shopifyShop = shop;
        }
      } catch (e) {
        console.error('AppBridgeProvider init error:', e);
      }

      // Check if App Bridge is available (may take time on mobile)
      const shopify = (window as any).shopify;
      if (shopify || attempts >= 15) {
        // Either App Bridge loaded or we've waited long enough — render anyway
        setReady(true);
      } else {
        attempts++;
        setTimeout(tryInit, 200);
      }
    }

    tryInit();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontFamily: 'system-ui' }}>
        Loading...
      </div>
    );
  }

  return (
    <DashboardErrorBoundary>
      {children}
    </DashboardErrorBoundary>
  );
}
