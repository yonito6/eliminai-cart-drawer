'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AppBridgeProvider from './app-bridge-provider';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '\u2261' },
  { href: '/dashboard/addons', label: 'Addons', icon: '\u2699' },
  { href: '/dashboard/results', label: 'Test History', icon: '\uD83D\uDCCA' },
];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Preserve shop/host/hmac params on nav links (critical for Shopify embedded mode)
  function navHref(base: string) {
    const keep = ['shop', 'host', 'hmac', 'timestamp', 'session'];
    const params = new URLSearchParams();
    keep.forEach(k => { const v = searchParams.get(k); if (v) params.set(k, v); });
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <AppBridgeProvider>
      <style>{`
        .dash-wrap { display: flex; min-height: 100vh; }
        .dash-nav {
          width: 220px; background: #111827; padding: 24px 0;
          display: flex; flex-direction: column; flex-shrink: 0;
        }
        .dash-mobile-toggle { display: none; }
        .dash-main { flex: 1; overflow: auto; min-width: 0; }
        @media (max-width: 768px) {
          .dash-wrap { flex-direction: column; }
          .dash-nav {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
            width: 220px;
            transform: translateX(-100%); transition: transform 0.25s ease;
          }
          .dash-nav.open { transform: translateX(0); }
          .dash-nav-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.4);
            z-index: 99; display: none;
          }
          .dash-nav-overlay.open { display: block; }
          .dash-mobile-toggle {
            display: flex; align-items: center; gap: 8px;
            padding: 12px 16px; background: #111827; color: #fff;
            border: none; font-size: 16px; font-weight: 600;
            cursor: pointer; width: 100%;
          }
          .dash-main { width: 100%; }
        }
      `}</style>
      <div className="dash-wrap">
        {/* Mobile hamburger */}
        <button className="dash-mobile-toggle" onClick={() => setMobileNavOpen(true)}>
          <span style={{ fontSize: 20 }}>☰</span> Cart Optimizer
        </button>

        {/* Overlay */}
        <div
          className={`dash-nav-overlay${mobileNavOpen ? ' open' : ''}`}
          onClick={() => setMobileNavOpen(false)}
        />

        <nav className={`dash-nav${mobileNavOpen ? ' open' : ''}`}>
          <div style={{ padding: '0 20px 24px', fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Cart Optimizer
          </div>
          {NAV.map(n => {
            const active = n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href);
            return (
              <a
                key={n.href}
                href={navHref(n.href)}
                onClick={() => setMobileNavOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#fff' : '#9ca3af',
                  background: active ? '#1f2937' : 'transparent',
                  textDecoration: 'none',
                  borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                {n.label}
              </a>
            );
          })}
        </nav>
        <main className="dash-main">
          {children}
        </main>
      </div>
    </AppBridgeProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#fafafa' }} />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
