'use client';

import { Suspense, useEffect, useState } from 'react';
import { useStore } from '@/lib/hooks/use-store';

interface CroResponse {
  currency: string;
  baselineCheckoutRate: number | null;
  baseline: { aov: number } | null;
  current: { aov: number | null; checkoutRate: number | null };
  lift: {
    aov: { absolute: number; percent: number | null };
    checkoutRate: { absolute: number; percent: number | null };
  };
  activity: { name: string; status: string; liftPercent: number | null; endedAt: string | null }[];
  value: {
    extraOrders: number;
    extraRevenue: number;
    aovLift: number;
    convLift: number;
    winsBanked: number;
    thisWeekRevenue: number;
  };
  before: { conversion: number; aov: number | null; ordersPerMonth: number };
  now: { conversion: number; aov: number | null; ordersPerMonth: number };
  trend: { date: string; conversion: number }[];
  milestones: { date: string; addonKey: string; label: string; lift: number | null }[];
  fuel: { visitors: number };
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
function asPct(frac: number | null | undefined) {
  if (frac == null) return '—';
  return `${(frac * 100).toFixed(2)}%`;
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
    return <Shell><div style={{ padding: 32, color: MUTE }}>Loading your momentum…</div></Shell>;
  }

  if (!data?.baseline) {
    return (
      <Shell>
        <div style={{ padding: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: INK }}>Your cart momentum</h1>
          <div style={{
            background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.3)',
            borderRadius: 14, padding: 20, marginTop: 18, color: '#fcd9a0', lineHeight: 1.5,
          }}>
            We&apos;re still capturing your baseline from Shopify. Once we have a few days of data,
            this page lights up with the exact dollar value your new cart is generating versus your old one.
          </div>
        </div>
      </Shell>
    );
  }

  const v = data.value;

  return (
    <Shell>
      {/* ── 1. VALUE SCOREBOARD HERO ─────────────────────────────────── */}
      <section style={{ padding: '28px 28px 22px', background: 'linear-gradient(135deg,#11183a,#0b1020)' }}>
        <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: FAINT }}>
          Your cart vs. your old cart · last 30 days
        </div>
        <div style={{ fontSize: 13, color: MUTE, marginTop: 8 }}>We generated you</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: TEAL, lineHeight: 1.05 }}>
          +{money(v.extraRevenue, c)}{' '}
          <span style={{ fontSize: 18, color: MUTE, fontWeight: 600 }}>in extra revenue</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: FAINT }}>
          vs. what your old cart would have earned at the same traffic. Estimated from your real conversion + AOV gains.
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginTop: 18,
        }}>
          <DeltaTile big={`+${v.extraOrders}`} label="more orders" />
          <DeltaTile big={`+${money(v.aovLift, c)}`} label="higher AOV" />
          <DeltaTile big={`+${v.convLift}pp`} label="conversion rate" />
          <DeltaTile big={`${v.winsBanked}`} label="wins banked" />
        </div>

        <div style={{
          marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(94,234,212,.12)', border: '1px solid rgba(94,234,212,.3)',
          color: TEAL, padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
        }}>
          ▲ +{money(v.thisWeekRevenue, c)} this week · accelerating
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: FAINT }}>
          All scoreboard figures are estimated from your live conversion and AOV gains.
        </div>
      </section>

      {/* ── 2. BEFORE → NOW ──────────────────────────────────────────── */}
      <section style={{
        padding: '18px 28px 6px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14, alignItems: 'stretch',
      }}>
        <CompareCard
          title="Your old cart" accent={FAINT} valueColor="#cbd6f0" border="#1d2950"
          conversion={asPct(data.before.conversion)} aov={money(data.before.aov, c)}
          ordersPerMonth={data.before.ordersPerMonth}
        />
        <CompareCard
          title="Your cart now" accent={TEAL} valueColor={TEAL} border="#2a6655"
          conversion={asPct(data.now.conversion)} aov={money(data.now.aov, c)}
          ordersPerMonth={data.now.ordersPerMonth}
        />
      </section>

      {/* ── 3. CONVERSION TREND GRAPH ────────────────────────────────── */}
      <section style={{ padding: '14px 28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Conversion rate over time</div>
          <div style={{ fontSize: 12, color: FAINT }}>rolling · through today</div>
        </div>
        <TrendChart trend={data.trend} milestones={data.milestones} />
      </section>

      {/* ── 4. FUEL CALLOUT ──────────────────────────────────────────── */}
      <section style={{
        margin: '0 28px 24px', background: 'linear-gradient(135deg,#1a2348,#11183a)',
        border: '1px solid #2b3a6e', borderRadius: 14, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 30 }}>⚡</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
            {data.fuel.visitors.toLocaleString()} shoppers analyzed — your cart is learning fast.
          </div>
          <div style={{ fontSize: 13, color: MUTE, marginTop: 2 }}>
            More visitors = quicker wins. Drive traffic and the autopilot improves faster.
          </div>
        </div>
      </section>

      {/* ── 5. NEXT-MOVES ROADMAP ────────────────────────────────────── */}
      <section style={{ padding: '0 28px 6px' }}>
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

      {/* ── 6. RESEARCH SUGGESTIONS ──────────────────────────────────── */}
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
            <SuggestionCard key={s.key} s={s} activated={data.activatedSuggestions.includes(s.key)} />
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

function CompareCard({
  title, accent, valueColor, border, conversion, aov, ordersPerMonth,
}: {
  title: string; accent: string; valueColor: string; border: string;
  conversion: string; aov: string; ordersPerMonth: number;
}) {
  return (
    <div style={{ background: '#0e1530', border: `1px solid ${border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, color: accent, textTransform: 'uppercase', letterSpacing: '.1em' }}>{title}</div>
      <Row label="Conversion" value={conversion} valueColor={valueColor} first />
      <Row label="AOV" value={aov} valueColor={valueColor} />
      <Row label="Orders /mo" value={`~${ordersPerMonth}`} valueColor={valueColor} />
    </div>
  );
}

function Row({ label, value, valueColor, first }: { label: string; value: string; valueColor: string; first?: boolean }) {
  return (
    <div style={{
      marginTop: first ? 10 : 6, fontSize: 13, color: MUTE,
      display: 'flex', justifyContent: 'space-between',
    }}>
      <span>{label}</span>
      <b style={{ color: valueColor }}>{value}</b>
    </div>
  );
}

function TrendChart({
  trend, milestones,
}: {
  trend: { date: string; conversion: number }[];
  milestones: { date: string; addonKey: string; label: string; lift: number | null }[];
}) {
  if (!trend || trend.length < 2) {
    return (
      <div style={{
        background: '#0e1530', border: '1px solid #1d2950', borderRadius: 14,
        padding: '32px 16px', textAlign: 'center', color: FAINT, fontSize: 13,
      }}>
        Collecting data — your conversion trend appears once we have a few days of history.
      </div>
    );
  }

  const W = 600;
  const H = 200;
  const pad = { t: 16, b: 16, l: 8, r: 8 };
  const ys = trend.map(p => p.conversion);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max === min) { max = min + (min === 0 ? 1 : min * 0.1); }
  const span = max - min;

  const x = (i: number) => pad.l + (i / (trend.length - 1)) * (W - pad.l - pad.r);
  const y = (val: number) => pad.t + (1 - (val - min) / span) * (H - pad.t - pad.b);

  const linePts = trend.map((p, i) => `${x(i)},${y(p.conversion)}`);
  const linePath = `M${linePts.join(' L')}`;
  const areaPath = `M${linePts.join(' L')} L${x(trend.length - 1)},${H} L${x(0)},${H} Z`;

  // milestone markers: map milestone dates onto trend indices
  const dateToIndex = new Map<string, number>();
  trend.forEach((p, i) => dateToIndex.set(p.date, i));
  const markers = milestones
    .map(m => ({ m, idx: dateToIndex.get(m.date) }))
    .filter((e): e is { m: typeof milestones[number]; idx: number } => e.idx != null);

  return (
    <div style={{ background: '#0e1530', border: '1px solid #1d2950', borderRadius: 14, padding: '18px 16px 8px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={TEAL} stopOpacity=".35" />
            <stop offset="1" stopColor={TEAL} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendFill)" />
        <path d={linePath} fill="none" stroke={TEAL} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {markers.map(({ m, idx }) => (
          <circle key={m.date + m.addonKey} cx={x(idx)} cy={y(trend[idx].conversion)} r={6}
            fill={NAVY} stroke={GOLD} strokeWidth={3} />
        ))}
      </svg>
      {markers.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
          {markers.map(({ m }) => (
            <span key={m.date + m.addonKey} style={{ fontSize: 12, color: GOLD }}>
              ● {m.label}{m.lift != null ? ` +${m.lift}%` : ''}
            </span>
          ))}
        </div>
      )}
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
  s, activated,
}: {
  s: CroResponse['suggestions'][number];
  activated: boolean;
}) {
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
        disabled={activated}
        style={{
          background: activated ? 'transparent' : VIOLET,
          color: activated ? TEAL : '#fff',
          border: activated ? `1px solid ${TEAL}` : 'none',
          borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
          cursor: activated ? 'default' : 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {activated ? 'Requested ✓' : 'Activate'}
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
