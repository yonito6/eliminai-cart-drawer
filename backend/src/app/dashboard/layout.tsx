'use client';

import { usePathname } from 'next/navigation';
import AppBridgeProvider from './app-bridge-provider';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '≡' },
  { href: '/dashboard/addons', label: 'Addons', icon: '⚙' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AppBridgeProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <nav style={{
          width: 220,
          background: '#111827',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column' as const,
          flexShrink: 0,
        }}>
          <div style={{ padding: '0 20px 24px', fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Cart Optimizer
          </div>
          {NAV.map(n => {
            const active = n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href);
            return (
              <a
                key={n.href}
                href={n.href}
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
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </AppBridgeProvider>
  );
}