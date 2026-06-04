'use client';

import { Suspense, useEffect, useState } from 'react';
import { useStore } from '@/lib/hooks/use-store';

interface CroResponse {
  currency: string;
  since: string | null;
  revenue30d: number | null;
  orders30d: number | null;
  aov: number | null;
  winsBanked: number;
  activity: { name: string; status: string; liftPercent: number | null; endedAt: string | null }[];
  milestones: { date: string; addonKey: string; label: string; lift: number | null }[];
  roadmap: {
    active: { name?: string; slot?: string; reason?: string } | null;
    queue: { slot: string; addonKey: string; dimension: string; phase: string; reason: string }[];
    phase: string;
  };
  suggestions: {
    key: string;
    label: string;
    blurb: string;
    evidence: string;
    source: string;
    impact: string;
    metric: string;
    fit: string;
    watchStar?: boolean;
  }[];
  activatedSuggestions: string[];
}

// ── palette ──────────────────────────────────────────────────────────────
const TEAL = '#5eead4';
const NAVY = '#0b1020';
const GOLD = '#fbbf24';
const VIOLET = '#6d4fcf';
const INK = '#e8edf6';
const MUTE = '#9fb0d6';
const FAINT = '#7c8db5';

function money(n: number | null, c: string) {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: c || 'USD' }).format(n);
}

function sinceLabel(iso: string | null): string {
  if (!iso) return 'since you installed';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'since you installed';
  return `since you installed · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

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

  if (storeLoading || !storeId) return <Shell><div style={{ padding: 32, color: MUTE }}>Loading store…</div></Shell>;
  if (storeError) return <Shell><div style={{ padding: 32, color: MUTE }}>Store not found.</div></Shell>;

  const c = data?.currency ?? 'USD';

  if (loading) {
    return <Shell><div style={{ padding: 32, color: MUTE }}>Loading your numbers…</div></Shell>;
  }

  if (!data) {
    return <Shell><div style={{ padding: 32, color: MUTE }}>Couldn&apos;t load your data right now.</div></Shell>;
  }

  const hasOrders = (data.orders30d ?? 0) > 0;

  return (
    <Shell>
      {/* ── 1. REAL PERFORMANCE HERO ─────────────────────────────────── */}
      <section style={{ padding: '28px 28px 22px', background: 'linear-gradient(135deg,#11183a,#0b1020)' }}>
        <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: FAINT }}>
          Your smart cart · {sinceLabel(data.since)}
        </div>
        <div style={{ fontSize: 13, color: MUTE, marginTop: 8 }}>Revenue through your cart — last 30 days</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: TEAL, lineHeight: 1.05 }}>
          {money(data.revenue30d, c)}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: FAINT }}>
          Real numbers, straight from your Shopify orders over the last 30 days.
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginTop: 18,
        }}>
          <DeltaTile big={`${data.orders30d ?? 0}`} label="orders · last 30 days" />
          <DeltaTile big={money(data.aov, c)} label="average order value" />
          <DeltaTile big={`${data.winsBanked}`} label="A/B test wins banked" />
        </div>

        {!hasOrders && (
          <div style={{ marginTop: 14, fontSize: 13, color: FAINT }}>
            No orders recorded in the last 30 days yet — this fills in as orders come through.
          </div>
        )}
      </section>

      {/* ── 2. NEXT-MOVES ROADMAP ────────────────────────────────────── */}
      <section style={{ padding: '20px 28px 6px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>🚀 Next up on your testing roadmap</div>
        <div style={{ fontSize: 13, color: MUTE, margin: '4px 0 14px' }}>
          Your autopilot runs the highest-impact test next. You can also activate a suggestion below.
        </div>
      </section>
      <section style={{ padding: '0 28px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!data.roadmap.active && data.roadmap.queue.length === 0 && (
          <div style={{
            background: '#0e1530', border: '1px solid #1d2950', borderRadius: 14,
            padding: '16px 18px', color: MUTE, fontSize: 14,
          }}>
            Your autopilot queue is being planned.
          </div>
        )}
        {data.roadmap.active && (
          <div style={{
            background: '#0e1530', border: `1px solid ${TEAL}`, borderRadius: 14,
            padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ minWidth: 72 }}>
              <div style={{ fontSize: 11, color: TEAL, fontWeight: 700, textTransform: 'uppercase' }}>Testing now</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: INK }}>
                {data.roadmap.active.name ?? data.roadmap.active.slot ?? 'Optimization in progress'}
              </div>
              {data.roadmap.active.reason && (
                <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>{data.roadmap.active.reason}</div>
              )}
            </div>
          </div>
        )}
        {data.roadmap.queue.map((q, i) => (
          <RoadmapItem key={q.slot ?? i} n={i + 1} item={q} />
        ))}
      </section>

      {/* ── 3. RESEARCH SUGGESTIONS ──────────────────────────────────── */}
      <section style={{
        margin: '0 28px 28px', background: 'linear-gradient(135deg,#231a3a,#13112a)',
        border: `1px solid ${VIOLET}`, borderRadius: 14, padding: 18,
      }}>
        <div style={{ fontSize: 13, color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          💡 Suggested new tactics (research-backed)
        </div>
        <div style={{ fontSize: 13, color: '#b9aee0', margin: '4px 0 14px' }}>
          Tailored to your store. Activate any to add it to your testing queue.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.suggestions.map(s => (
            <SuggestionCard key={s.key} s={s} activated={data.activatedSuggestions.includes(s.key)} storeId={storeId as string} />
          ))}
          {data.suggestions.length === 0 && (
            <div style={{ color: '#b9aee0', fontSize: 13 }}>No new tactics queued right now — check back soon.</div>
          )}
        </div>
      </section>
    </Shell>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: NAVY, minHeight: '100vh', color: INK }}>
      <div style={{
        maxWidth: 880, margin: '0 auto', background: NAVY,
        fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
      }}>
        {children}
      </div>
    </div>
  );
}

function DeltaTile({ big, label }: { big: string; label: string }) {
  return (
    <div style={{
      background: 'rgba(94,234,212,.08)', border: '1px solid rgba(94,234,212,.25)',
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: TEAL }}>{big}</div>
      <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function RoadmapItem({
  n, item,
}: {
  n: number;
  item: { slot: string; addonKey: string; dimension: string; phase: string; reason: string };
}) {
  return (
    <div style={{
      background: '#0e1530', border: '1px solid #1d2950', borderRadius: 14,
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ minWidth: 40, textAlign: 'center', color: FAINT, fontSize: 22, fontWeight: 800 }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#cbd6f0' }}>{item.dimension || item.addonKey}</div>
        {item.reason && <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>{item.reason}</div>}
      </div>
    </div>
  );
}

function SuggestionCard({
  s, activated, storeId,
}: {
  s: CroResponse['suggestions'][number];
  activated: boolean;
  storeId: string;
}) {
  const [requested, setRequested] = useState(false);
  const isActivated = activated || requested;
  return (
    <div style={{
      background: '#1a1530', border: '1px solid #3a2f5e', borderRadius: 12,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e8e0ff', display: 'flex', alignItems: 'center', gap: 6 }}>
          {s.label}
          {s.watchStar && <span title="Made for watch stores">⭐</span>}
          {s.impact && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#c4b5fd',
              background: 'rgba(196,181,253,.12)', border: '1px solid rgba(196,181,253,.3)',
              borderRadius: 999, padding: '1px 8px',
            }}>
              {s.impact}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#b9aee0', marginTop: 2 }}>{s.blurb}</div>
        {s.evidence && (
          <div style={{ fontSize: 11, color: '#8e82b8', marginTop: 4 }}>
            {s.evidence}{s.source ? ` (${s.source})` : ''}
          </div>
        )}
      </div>
      <button
        disabled={isActivated}
        onClick={() => {
          if (isActivated) return;
          setRequested(true);
          fetch(`/api/stores/${storeId}/cro/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: s.key }),
          }).catch(() => {});
        }}
        style={{
          background: isActivated ? 'transparent' : VIOLET,
          color: isActivated ? TEAL : '#fff',
          border: isActivated ? `1px solid ${TEAL}` : 'none',
          borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
          cursor: isActivated ? 'default' : 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {isActivated ? 'Requested ✓' : 'Activate'}
      </button>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, background: NAVY, color: MUTE, minHeight: '100vh' }}>Loading…</div>}>
      <AnalyticsInner />
    </Suspense>
  );
}
