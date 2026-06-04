'use client';

import { Suspense, useEffect, useState } from 'react';
import { useStore } from '@/lib/hooks/use-store';

interface CroResponse {
  currency: string;
  baselineCheckoutRate: number | null;
  baseline: { capturedAt: string; orders30d: number; revenue30d: number; aov: number } | null;
  current: { aov: number | null; checkoutRate: number | null };
  lift: {
    aov: { absolute: number; percent: number | null };
    checkoutRate: { absolute: number; percent: number | null };
  };
  activity: { name: string; status: string; liftPercent: number | null; endedAt: string | null }[];
}

function money(n: number | null, c: string) {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: c || 'USD' }).format(n);
}
function pct(n: number | null) { return n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`; }
function rate(n: number | null) { return n == null ? '—' : `${(n * 100).toFixed(1)}%`; }

function AnalyticsInner() {
  const { storeId, loading: storeLoading, error: storeError } = useStore();
  const [data, setData] = useState<CroResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetch(`/api/stores/${storeId}/cro`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [storeId]);

  if (storeLoading || !storeId) return <div style={{ padding: 32 }}>Loading store…</div>;
  if (storeError) return <div style={{ padding: 32 }}>Store not found.</div>;

  const c = data?.currency ?? 'USD';

  return (
    <div style={{ padding: 32, maxWidth: 880 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Analytics</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        How your cart has improved since you installed.
      </p>

      {loading && <div>Loading…</div>}

      {!loading && !data?.baseline && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 16, marginBottom: 24, color: '#9a3412' }}>
          We're still capturing your baseline from Shopify. Check back shortly, or
          your store may have installed before analytics were available.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <Stat label="Average Order Value" value={money(data?.current.aov ?? null, c)}
              sub={`Baseline ${money(data?.baseline?.aov ?? null, c)}`} delta={pct(data?.lift.aov.percent ?? null)} />
        <Stat label="Cart Checkout Rate" value={rate(data?.current.checkoutRate ?? null)}
              sub={`Baseline ${rate(data?.baselineCheckoutRate ?? null)}`} delta={pct(data?.lift.checkoutRate.percent ?? null)} />
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>What we've done for you</h2>
      {(!data?.activity || data.activity.length === 0) && (
        <p style={{ color: '#6b7280' }}>No completed tests yet — your first optimization is on the way.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data?.activity?.map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
            <span>{a.name}</span>
            <span style={{ color: a.status === 'WINNER_FOUND' ? '#059669' : '#6b7280', fontWeight: 600 }}>
              {a.status === 'WINNER_FOUND' ? `Winner ${a.liftPercent != null ? `+${a.liftPercent}%` : ''}` : 'No difference'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, delta }: { label: string; value: string; sub: string; delta: string }) {
  const up = delta.startsWith('+');
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        <span style={{ color: up ? '#059669' : delta === '—' ? '#6b7280' : '#dc2626', fontWeight: 600 }}>{delta}</span>
        <span style={{ color: '#9ca3af', marginLeft: 8 }}>{sub}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading…</div>}>
      <AnalyticsInner />
    </Suspense>
  );
}
