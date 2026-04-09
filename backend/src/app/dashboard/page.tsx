'use client';

import { useState, useEffect, useCallback } from 'react';
import CartPreview from './cart-preview';

const STORE_ID = 'cmnriegez0000jc70ro9nltw2';
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
  { key: 'showTrustBadges', label: 'Trust Badges', desc: 'Payment icons + secure checkout text below checkout button' },
  { key: 'showScarcityTimer', label: 'Scarcity Timer', desc: 'Countdown timer above checkout \u2014 "Cart reserved for 14:59"' },
  { key: 'showProgressBar', label: 'Free Shipping Bar', desc: 'Visual bar showing distance to free shipping threshold' },
  { key: 'showUpsells', label: 'Upsell Recommendations', desc: '"You might also like" product suggestion in cart' },
  { key: 'stickyCheckout', label: 'Sticky Checkout', desc: 'Checkout button stays pinned when scrolling cart items' },
  { key: 'showSocialProof', label: 'Social Proof', desc: '"23 people viewing right now" live indicator' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [exps, setExps] = useState<Exp[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('cart-drawer');
  const [ctrlF, setCtrlF] = useState<Record<string, boolean>>({});
  const [varF, setVarF] = useState<Record<string, boolean>>({});
  const [days, setDays] = useState(14);
  const [previewExp, setPreviewExp] = useState<string | null>(null);

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
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  async function createExp(e: React.FormEvent) {
    e.preventDefault(); setCreating(true);
    try {
      const r = await fetch(API + '/api/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: STORE_ID, name, slot, maxDays: days,
          variants: [
            { id: 'control', name: 'Control', features: ctrlF },
            { id: 'variant-b', name: 'Variant B', features: varF },
          ],
        }),
      });
      if (r.ok) { setShowCreate(false); setName(''); setCtrlF({}); setVarF({}); await load(); }
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#e2e8f0' }}>
      <div style={{ fontSize: 18 }}>Loading dashboard...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>Cart Optimizer Dashboard</h1>
            <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 14 }}>
              {stats?.store.shopDomain || 'Loading...'} &middot; Auto-refreshes every 15s
            </p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            {showCreate ? 'Cancel' : '+ New Experiment'}
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { l: 'Total Sessions', v: stats.totals.sessions, s: stats.last7Days.sessions + ' last 7d' },
              { l: 'Cart Opens', v: stats.totals.cartOpens, s: stats.last7Days.cartOpens + ' last 7d' },
              { l: 'Checkouts', v: stats.totals.checkouts, s: stats.last7Days.checkouts + ' last 7d' },
              { l: 'Checkout Rate', v: stats.totals.checkoutRate + '%', s: stats.last7Days.checkoutRate + '% last 7d' },
              { l: 'Active Tests', v: stats.experiments.active, s: stats.experiments.completed + ' completed' },
              { l: 'Orders', v: stats.totals.orders, s: stats.store.currency || 'USD' },
            ].map((c, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 12, padding: '20px 16px', border: '1px solid #334155' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1 }}>{c.l}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', marginTop: 4 }}>{c.v}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{c.s}</div>
              </div>
            ))}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <form onSubmit={createExp} style={{ background: '#1e293b', borderRadius: 12, padding: 24, marginBottom: 32, border: '1px solid #334155' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', color: '#f1f5f9' }}>Create New Experiment</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Trust Badges Test"
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Slot</label>
                <input value={slot} onChange={e => setSlot(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Max Days</label>
                <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={1} max={90}
                  style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' as const }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', margin: '0 0 12px' }}>Control (A)</h3>
                {FEATS.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={!!ctrlF[f.key]} onChange={e => setCtrlF(p => ({ ...p, [f.key]: e.target.checked }))} />
                    <span>{f.label}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>&mdash; {f.desc}</span>
                  </label>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#60a5fa', margin: '0 0 12px' }}>Variant B</h3>
                {FEATS.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" checked={!!varF[f.key]} onChange={e => setVarF(p => ({ ...p, [f.key]: e.target.checked }))} />
                    <span>{f.label}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>&mdash; {f.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={creating || !name}
              style={{ padding: '10px 24px', background: creating ? '#475569' : '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: creating ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
              {creating ? 'Creating...' : 'Create & Start Experiment'}
            </button>
          </form>
        )}

        {/* Experiments List */}
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px', color: '#f1f5f9' }}>Experiments</h2>
        {exps.length === 0 ? (
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 32, textAlign: 'center' as const, border: '1px solid #334155' }}>
            <p style={{ color: '#64748b', margin: 0 }}>No experiments yet. Create one above.</p>
          </div>
        ) : exps.map(exp => (
          <div key={exp.id} style={{ background: '#1e293b', borderRadius: 12, padding: 24, marginBottom: 16, border: '1px solid #334155' }}>
            {/* Experiment Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#f1f5f9' }}>
                  {exp.name}
                  <span style={{
                    marginLeft: 12, fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 500,
                    background: exp.status === 'RUNNING' ? '#166534' : exp.status === 'PAUSED' ? '#92400e' : '#1e40af',
                    color: exp.status === 'RUNNING' ? '#4ade80' : exp.status === 'PAUSED' ? '#fbbf24' : '#93c5fd',
                  }}>{exp.status}</span>
                </h3>
                <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>
                  Slot: {exp.slot} &middot; Started: {new Date(exp.startedAt).toLocaleDateString()} &middot; Max: {exp.maxDays}d &middot; {exp.totalVisitors} visitors
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {exp.status === 'RUNNING' && (
                  <button onClick={() => act(exp.id, 'pause')}
                    style={{ padding: '6px 14px', background: '#92400e', color: '#fbbf24', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    Pause
                  </button>
                )}
                {exp.status === 'PAUSED' && (
                  <button onClick={() => act(exp.id, 'resume')}
                    style={{ padding: '6px 14px', background: '#166534', color: '#4ade80', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    Resume
                  </button>
                )}
                {(exp.status === 'RUNNING' || exp.status === 'PAUSED') && (
                  <button onClick={() => {
                    const w = prompt('Winner variant ID (e.g. variant-b) or empty:');
                    act(exp.id, 'end', w ? { winner: w } : {});
                  }}
                    style={{ padding: '6px 14px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    End Test
                  </button>
                )}
              </div>
            </div>

            {/* Variant Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {exp.variantStats.map(v => (
                <div key={v.id} style={{ background: '#0f172a', borderRadius: 8, padding: 12, border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: v.id === 'control' ? '#94a3b8' : '#60a5fa', marginBottom: 8 }}>
                    {v.name} {exp.winnerVariantId === v.id && <span style={{ color: '#4ade80' }}> Winner!</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    Features: {Object.entries(v.features || {}).filter(([, val]) => val).map(([k]) => k).join(', ') || 'None (baseline)'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, textAlign: 'center' as const }}>
                    {[
                      { l: 'Visitors', val: v.visitors },
                      { l: 'Cart Opens', val: v.cartOpens },
                      { l: 'Checkouts', val: v.checkoutClicks },
                      { l: 'Rate', val: v.checkoutRate + '%' },
                      { l: 'Orders', val: v.orders },
                    ].map((m, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' as const }}>{m.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: '#64748b' }}>
              Traffic: {Object.entries(exp.trafficSplit).map(([k, v]) => k + ': ' + (Number(v) * 100).toFixed(0) + '%').join(' / ')}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 32, padding: 16, textAlign: 'center' as const, color: '#475569', fontSize: 12 }}>
          Eliminai Cart Optimizer
        </div>
      </div>
    </div>
  );
}
