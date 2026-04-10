'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/hooks/use-store';
import CartPreview from './cart-preview';

// STORE_ID resolved dynamically via useStore()
// STORE_DOMAIN resolved dynamically via useStore()
const API = '';

interface VS {
  id: string; name: string; features: Record<string, any>;
  visitors: number; cartOpens: number; checkoutClicks: number; orders: number; checkoutRate: string;
}
interface Exp {
  id: string; name: string; slot: string; status: string; variants: any[];
  trafficSplit: Record<string, number>; totalVisitors: number; variantStats: VS[];
  startedAt: string; endedAt: string | null; winnerVariantId: string | null; maxDays: number;
}
interface Stats {
  store: { id: string; shopDomain: string; currency: string; baselineCheckoutRate: number; baselineCartOpens: number };
  totals: { sessions: number; events: number; cartOpens: number; checkouts: number; orders: number; checkoutRate: string };
  experiments: { active: number; completed: number };
  last7Days: { sessions: number; cartOpens: number; checkouts: number; checkoutRate: string };
}

const FEATS = [
  { key: 'showTrustBadges', label: 'Trust Badges', desc: 'Visa/MC/Amex/PayPal icons + "Secure Checkout" below checkout button' },
  { key: 'showScarcityTimer', label: 'Scarcity Timer', desc: '"Cart reserved for 14:59 \u2014 items selling fast!" countdown' },
  { key: 'showProgressBar', label: 'Free Shipping Bar', desc: 'Visual progress bar to free shipping threshold' },
  { key: 'showUpsells', label: 'Upsell Recommendations', desc: '"You might also like" product suggestion in cart' },
  { key: 'stickyCheckout', label: 'Sticky Checkout', desc: 'Checkout button stays pinned when scrolling' },
  { key: 'showSocialProof', label: 'Social Proof', desc: '"23 people viewing right now" live indicator' },
];

export default function Dashboard() {
  const { storeId: STORE_ID, store: storeInfo, loading: storeLoading, error: storeError } = useStore();


  const [stats, setStats] = useState<Stats | null>(null);
  const [exps, setExps] = useState<Exp[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [nm, setNm] = useState('');
  const [slot, setSlot] = useState('cart-drawer');
  const [ctrlF, setCtrlF] = useState<Record<string, boolean>>({});
  const [varF, setVarF] = useState<Record<string, boolean>>({});
  const [days, setDays] = useState(14);
  const [previewExp, setPreviewExp] = useState<string | null>(null);
  const [showLiveCart, setShowLiveCart] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        fetch(API + '/api/stores/' + STORE_ID + '/stats'),
        fetch(API + '/api/experiments?storeId=' + STORE_ID),
      ]);
      if (s.ok) setStats(await s.json());
      if (e.ok) setExps(await e.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [STORE_ID]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  // ── Early returns (MUST be after all hooks) ──
  if (storeLoading) return <div style={{padding: 40, textAlign: 'center'}}>Loading store...</div>;
  if (storeError || !STORE_ID) return <div style={{padding: 40, textAlign: 'center', color: '#ef4444'}}>Store not found. Please install the app from Shopify.</div>;

  async function createExp(e: React.FormEvent) {
    e.preventDefault(); setCreating(true);
    try {
      const r = await fetch(API + '/api/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: STORE_ID, name: nm, slot, maxDays: days,
          variants: [
            { id: 'control', name: 'Control', features: ctrlF },
            { id: 'variant-b', name: 'Variant B', features: varF },
          ],
        }),
      });
      if (r.ok) { setShowCreate(false); setNm(''); setCtrlF({}); setVarF({}); await load(); }
    } finally { setCreating(false); }
  }

  async function act(id: string, a: string, extra?: any) {
    await fetch(API + '/api/experiments/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: a, ...extra }),
    });
    await load();
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <div style={{ fontSize: 16, color: '#6b7280' }}>Loading dashboard...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', color: '#111827', padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>Cart Optimizer</h1>
            <p style={{ color: '#9ca3af', margin: '4px 0 0', fontSize: 13 }}>
              {stats?.store.shopDomain || 'Loading...'} \u00b7 Auto-refreshes every 15s
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowLiveCart(!showLiveCart)}
              style={{ padding: '9px 18px', background: showLiveCart ? '#dc2626' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              {showLiveCart ? 'Close Live Cart' : '\ud83d\udc41 Live Cart Preview'}
            </button>
            <button onClick={() => setShowCreate(!showCreate)}
              style={{ padding: '9px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              {showCreate ? 'Cancel' : '+ New Experiment'}
            </button>
          </div>
        </div>

        {/* LIVE CART PREVIEW — Real store iframe */}
        {showLiveCart && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Live Store Preview</h2>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                  This is your real store. Add products to cart to see how the cart drawer looks with active experiments.
                </p>
              </div>
              <a href={'https://' + (stats?.store?.shopDomain || '')} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#7c3aed', textDecoration: 'none', fontWeight: 500 }}>
                Open in new tab \u2197
              </a>
            </div>
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', height: 700 }}>
              <iframe
                src={'https://' + (stats?.store?.shopDomain || '') + '/collections/all'}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Live Store Preview"
              />
            </div>
            <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 8, textAlign: 'center' as const }}>
              Tip: Add a product to cart to see the cart drawer with your active A/B test features
            </p>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 28 }}>
            {[
              { l: 'Sessions', v: stats.totals.sessions, s: stats.last7Days.sessions + ' last 7d', icon: '\ud83d\udc64' },
              { l: 'Cart Opens', v: stats.totals.cartOpens, s: stats.last7Days.cartOpens + ' last 7d', icon: '\ud83d\uded2' },
              { l: 'Checkouts', v: stats.totals.checkouts, s: stats.last7Days.checkouts + ' last 7d', icon: '\ud83d\udcb3' },
              { l: 'Checkout Rate', v: stats.totals.checkoutRate + '%', s: stats.last7Days.checkoutRate + '% last 7d', icon: '\ud83d\udcc8' },
              { l: 'Active Tests', v: stats.experiments.active, s: stats.experiments.completed + ' completed', icon: '\ud83e\uddea' },
              { l: 'Orders', v: stats.totals.orders, s: stats.store.currency || 'USD', icon: '\ud83d\udce6' },
            ].map((c, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '16px 14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, fontWeight: 500 }}>{c.l}</span>
                  <span style={{ fontSize: 16 }}>{c.icon}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>{c.v}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{c.s}</div>
              </div>
            ))}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <form onSubmit={createExp} style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Create New Experiment</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }}>Name</label>
                <input value={nm} onChange={e => setNm(e.target.value)} required placeholder="e.g. Trust Badges Test"
                  style={{ width: '100%', padding: '8px 12px', background: '#fafafa', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }}>Slot</label>
                <input value={slot} onChange={e => setSlot(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#fafafa', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }}>Max Days</label>
                <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1} max={90}
                  style={{ width: '100%', padding: '8px 12px', background: '#fafafa', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: '0 0 10px' }}>Control (A) \u2014 Features</h3>
                {FEATS.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={!!ctrlF[f.key]} onChange={e => setCtrlF(p => ({ ...p, [f.key]: e.target.checked }))} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontWeight: 500, color: '#374151' }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{f.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', margin: '0 0 10px' }}>Variant B \u2014 Features</h3>
                {FEATS.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={!!varF[f.key]} onChange={e => setVarF(p => ({ ...p, [f.key]: e.target.checked }))} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontWeight: 500, color: '#374151' }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{f.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Side-by-side feature comparison */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>Feature Comparison</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, justifyItems: 'center' }}>
                <CartPreview variant="control" features={ctrlF} label="Control (A)" color="#6b7280" />
                <CartPreview variant="variant-b" features={varF} label="Variant B" color="#7c3aed" />
              </div>
            </div>

            <button type="submit" disabled={creating || !nm}
              style={{ padding: '10px 24px', background: creating ? '#d1d5db' : '#111827', color: '#fff', border: 'none', borderRadius: 8, cursor: creating ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
              {creating ? 'Creating...' : 'Create & Start Experiment'}
            </button>
          </form>
        )}

        {/* Experiments List */}
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 14px' }}>Active Optimizations</h2>
        {exps.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center' as const, border: '1px solid #e5e7eb' }}>
            <p style={{ color: '#9ca3af', margin: 0 }}>No active optimizations running.</p>
          </div>
        ) : exps.filter(exp => exp.status === 'RUNNING').map(exp => (
          <div key={exp.id} style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 14, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#111827' }}>
                  {exp.name}
                  <span style={{
                    marginLeft: 10, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                    background: exp.status === 'RUNNING' ? '#dcfce7' : exp.status === 'PAUSED' ? '#fef3c7' : '#dbeafe',
                    color: exp.status === 'RUNNING' ? '#166534' : exp.status === 'PAUSED' ? '#92400e' : '#1e40af',
                  }}>{exp.status}</span>
                </h3>
                <p style={{ color: '#9ca3af', margin: '4px 0 0', fontSize: 12 }}>
                  Started {new Date(exp.startedAt).toLocaleDateString()} · {exp.totalVisitors} visitors
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPreviewExp(previewExp === exp.id ? null : exp.id)}
                  style={{ padding: '6px 14px', background: previewExp === exp.id ? '#ede9fe' : '#f3f4f6', color: previewExp === exp.id ? '#7c3aed' : '#6b7280', border: '1px solid ' + (previewExp === exp.id ? '#c4b5fd' : '#e5e7eb'), borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                  {previewExp === exp.id ? 'Hide Preview' : 'Preview'}
                </button>
                {exp.status === 'RUNNING' && (
                  <button onClick={() => act(exp.id, 'pause')}
                    style={{ padding: '6px 14px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Pause</button>
                )}
                {exp.status === 'PAUSED' && (
                  <button onClick={() => act(exp.id, 'resume')}
                    style={{ padding: '6px 14px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Resume</button>
                )}
                {(exp.status === 'RUNNING' || exp.status === 'PAUSED') && (
                  <button onClick={() => { const w = prompt('Winner variant ID (e.g. variant-b) or empty:'); act(exp.id, 'end', w ? { winner: w } : {}); }}
                    style={{ padding: '6px 14px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>End Test</button>
                )}
              </div>
            </div>

            {/* Side-by-Side Feature Preview */}
            {previewExp === exp.id && (
              <div style={{ marginBottom: 14, padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #f3f4f6' }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>A/B Test Comparison</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, justifyItems: 'center' }}>
                  {exp.variantStats.map(v => (
                    <CartPreview key={v.id} variant={v.id} features={v.features || {}} label={v.name} color={v.id === 'control' ? '#6b7280' : '#7c3aed'} />
                  ))}
                </div>
              </div>
            )}

            {/* Variant Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {exp.variantStats.map(v => (
                <div key={v.id} style={{ background: '#fafafa', borderRadius: 8, padding: 12, border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: v.id === 'control' ? '#6b7280' : '#7c3aed', marginBottom: 6 }}>
                    {v.name} {exp.winnerVariantId === v.id && <span style={{ color: '#16a34a' }}> \u2714 Winner!</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                    {Object.entries(v.features || {}).filter(([, val]) => val).map(([k]) => k).join(', ') || 'No features (baseline)'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, textAlign: 'center' as const }}>
                    {[
                      { l: 'Visitors', val: v.visitors },
                      { l: 'Cart Opens', val: v.cartOpens },
                      { l: 'Checkouts', val: v.checkoutClicks },
                      { l: 'Rate', val: v.checkoutRate + '%' },
                      { l: 'Orders', val: v.orders },
                    ].map((m, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' as const, fontWeight: 500 }}>{m.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#d1d5db' }}>
              Traffic: {Object.entries(exp.trafficSplit).map(([k, v]) => k + ': ' + (Number(v) * 100).toFixed(0) + '%').join(' / ')}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 32, padding: 16, textAlign: 'center' as const, color: '#d1d5db', fontSize: 11 }}>
          Eliminai Cart Optimizer
        </div>
      </div>
    </div>
  );
}
