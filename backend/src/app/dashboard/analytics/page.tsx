'use client';

import { Suspense, useEffect, useState } from 'react';
import { useStore } from '@/lib/hooks/use-store';

interface CroResponse {
  currency: string;
  since: string | null;
  windowLabel: string;
  revenue: number | null;
  orders: number | null;
  aov: number | null;
  winsBanked: number;
  cumulativeLift: number;
  isTesting: boolean;
  activity: { name: string; status: string; liftPercent: number | null; endedAt: string | null }[];
  trend: { weekStart: string; revenue: number; orders: number }[];
  wins: { name: string; lift: number | null; endedAt: string }[];
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

// ── light palette (matches the rest of the dashboard) ──────────────────────
const T = {
  font: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  bg: '#f8f9fb',
  surface: '#ffffff',
  border: '#e8eaed',
  borderLight: '#f0f1f3',
  text: '#1a1d23',
  textSecondary: '#5f6672',
  textMuted: '#8b919d',
  purple: '#7c3aed',
  purpleBg: 'rgba(124,58,237,0.08)',
  green: '#16a34a',
  greenBg: 'rgba(22,163,106,0.08)',
  amber: '#d97706',
  amberBg: 'rgba(217,119,6,0.10)',
  radius: 14,
};

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

function useFontLink() {
  useEffect(() => {
    if (document.getElementById('analytics-fonts')) return;
    const link = document.createElement('link');
    link.id = 'analytics-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap';
    document.head.appendChild(link);
  }, []);
}

function AnalyticsInner() {
  useFontLink();
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

  if (storeLoading || !storeId) return <Shell><div style={{ padding: 60, textAlign: 'center', color: T.textMuted }}>Loading store…</div></Shell>;
  if (storeError) return <Shell><div style={{ padding: 60, textAlign: 'center', color: T.textMuted }}>Store not found.</div></Shell>;

  const c = data?.currency ?? 'USD';

  if (loading) {
    return <Shell><div style={{ padding: 60, textAlign: 'center', color: T.textMuted }}>Loading your numbers…</div></Shell>;
  }
  if (!data) {
    return <Shell><div style={{ padding: 60, textAlign: 'center', color: T.textMuted }}>Couldn&apos;t load your data right now.</div></Shell>;
  }

  const hasOrders = (data.orders ?? 0) > 0;

  return (
    <Shell>
      {/* ── 1. REAL PERFORMANCE HERO ─────────────────────────────────── */}
      <section style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius,
        padding: '26px 28px', marginBottom: 18,
      }}>
        <div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted, fontWeight: 600 }}>
          Your smart cart · {sinceLabel(data.since)}
        </div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 10 }}>Revenue through your cart — {data.windowLabel}</div>
        <div style={{ fontSize: 46, fontWeight: 700, color: T.text, lineHeight: 1.1, letterSpacing: '-0.02em', marginTop: 2 }}>
          {money(data.revenue, c)}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: T.textMuted }}>
          Real numbers, straight from your Shopify orders.
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12, marginTop: 20,
        }}>
          <StatTile big={`${data.orders ?? 0}`} label={`orders · ${data.windowLabel}`} />
          <StatTile big={money(data.aov, c)} label="average order value" />
          <StatTile
            big={`${data.winsBanked}`}
            label="winning tests"
            help="A/B tests we ran that found a clear winner and improved your cart. Each one is a proven upgrade kept live."
            sub={data.winsBanked > 0 && data.cumulativeLift > 0 ? `+${data.cumulativeLift}% combined lift` : undefined}
          />
        </div>

        {!hasOrders && (
          <div style={{ marginTop: 14, fontSize: 13, color: T.textMuted }}>
            No orders recorded in this window yet — this fills in as orders come through.
          </div>
        )}
      </section>

      {/* ── 2. REVENUE TREND GRAPH ───────────────────────────────────── */}
      <section style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius,
        padding: '20px 22px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Weekly revenue</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>last 8 weeks · ◆ = winning test</div>
        </div>
        <TrendChart trend={data.trend} wins={data.wins} currency={c} />
      </section>

      {/* ── 3. NEXT-MOVES ROADMAP ────────────────────────────────────── */}
      <section style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>🚀 Next up on your testing roadmap</div>
        <div style={{ fontSize: 13, color: T.textSecondary, margin: '4px 0 14px' }}>
          Your autopilot runs the highest-impact test next.
        </div>
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        {!data.roadmap.active && data.roadmap.queue.length === 0 && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius,
            padding: '16px 18px', color: T.textSecondary, fontSize: 14,
          }}>
            Your autopilot queue is being planned.
          </div>
        )}
        {data.roadmap.active && (
          <div style={{
            background: T.surface, border: `1px solid ${T.purple}`, borderRadius: T.radius,
            padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 0 0 3px rgba(124,58,237,0.06)',
          }}>
            <div style={{ minWidth: 80 }}>
              <div style={{ fontSize: 11, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Testing now</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>
                {data.roadmap.active.name ?? data.roadmap.active.slot ?? 'Optimization in progress'}
              </div>
              {data.roadmap.active.reason && (
                <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>{data.roadmap.active.reason}</div>
              )}
            </div>
          </div>
        )}
        {data.roadmap.queue.map((q, i) => (
          <RoadmapItem key={q.slot ?? i} n={i + 1} item={q} />
        ))}
      </section>

      {/* ── 4. RESEARCH SUGGESTIONS (locked while a test runs) ────────── */}
      <section style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              💡 Suggested new tactics (research-backed)
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, margin: '4px 0 0' }}>
              {data.isTesting
                ? 'Locked while a test is running — we finish one test before queuing the next.'
                : 'Tailored to your store. Activate any to add it to your testing queue.'}
            </div>
          </div>
          {data.isTesting && (
            <span style={{
              flexShrink: 0, fontSize: 12, fontWeight: 700, color: T.amber, background: T.amberBg,
              border: `1px solid ${T.amber}`, borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap',
            }}>
              🔒 Test in progress
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {data.suggestions.map(s => (
            <SuggestionCard
              key={s.key} s={s}
              activated={data.activatedSuggestions.includes(s.key)}
              locked={data.isTesting}
              storeId={storeId as string}
            />
          ))}
          {data.suggestions.length === 0 && (
            <div style={{ color: T.textSecondary, fontSize: 13 }}>No new tactics queued right now — check back soon.</div>
          )}
        </div>
      </section>
    </Shell>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: T.font }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
        {children}
      </div>
    </div>
  );
}

function StatTile({ big, label, sub, help }: { big: string; label: string; sub?: string; help?: string }) {
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: T.text }}>{big}</div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
        {label}
        {help && <span title={help} style={{ cursor: 'help', color: T.textMuted, fontWeight: 700 }}>ⓘ</span>}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TrendChart({
  trend, wins, currency,
}: {
  trend: { weekStart: string; revenue: number; orders: number }[];
  wins: { name: string; lift: number | null; endedAt: string }[];
  currency: string;
}) {
  const nonEmpty = trend.filter(t => t.revenue > 0).length;
  if (!trend || trend.length < 2 || nonEmpty < 2) {
    return (
      <div style={{
        background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: 12,
        padding: '36px 16px', textAlign: 'center', color: T.textMuted, fontSize: 13,
      }}>
        Collecting data — your weekly revenue trend appears once a few weeks of orders are in.
      </div>
    );
  }

  const W = 640;
  const H = 220;
  const pad = { t: 18, b: 34, l: 12, r: 12 };
  const ys = trend.map(p => p.revenue);
  const max = Math.max(...ys) * 1.1 || 1;
  const min = 0;
  const span = max - min || 1;

  const x = (i: number) => pad.l + (i / (trend.length - 1)) * (W - pad.l - pad.r);
  const y = (val: number) => pad.t + (1 - (val - min) / span) * (H - pad.t - pad.b);

  const linePts = trend.map((p, i) => `${x(i)},${y(p.revenue)}`);
  const linePath = `M${linePts.join(' L')}`;
  const areaPath = `M${linePts.join(' L')} L${x(trend.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;

  // map each win's endedAt to the nearest week bucket index
  const markers = wins.map(w => {
    const t = new Date(w.endedAt).getTime();
    let best = -1; let bestDelta = Infinity;
    trend.forEach((p, i) => {
      const d = Math.abs(new Date(p.weekStart).getTime() - t);
      if (d < bestDelta) { bestDelta = d; best = i; }
    });
    return { w, idx: best };
  }).filter(m => m.idx >= 0);

  const fmtWeek = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={T.purple} stopOpacity=".18" />
            <stop offset="1" stopColor={T.purple} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#revFill)" />
        <path d={linePath} fill="none" stroke={T.purple} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.revenue)} r={3} fill={T.surface} stroke={T.purple} strokeWidth={2} />
        ))}
        {markers.map(({ w, idx }, k) => (
          <g key={k}>
            <line x1={x(idx)} y1={pad.t} x2={x(idx)} y2={H - pad.b} stroke={T.green} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            <rect x={x(idx) - 5} y={y(trend[idx].revenue) - 5} width={10} height={10} rx={2}
              transform={`rotate(45 ${x(idx)} ${y(trend[idx].revenue)})`}
              fill={T.surface} stroke={T.green} strokeWidth={2} />
          </g>
        ))}
        {/* x-axis labels: first, middle, last */}
        {[0, Math.floor((trend.length - 1) / 2), trend.length - 1].map(i => (
          <text key={i} x={x(i)} y={H - 12} fontSize={11} fill={T.textMuted} textAnchor="middle">{fmtWeek(trend[i].weekStart)}</text>
        ))}
      </svg>
      {markers.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          {markers.map(({ w }, k) => (
            <span key={k} style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
              ◆ {w.name}{w.lift != null ? ` +${w.lift}%` : ''}
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
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius,
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ minWidth: 34, textAlign: 'center', color: T.textMuted, fontSize: 20, fontWeight: 700 }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{item.dimension || item.addonKey}</div>
        {item.reason && <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>{item.reason}</div>}
      </div>
    </div>
  );
}

function SuggestionCard({
  s, activated, locked, storeId,
}: {
  s: CroResponse['suggestions'][number];
  activated: boolean;
  locked: boolean;
  storeId: string;
}) {
  const [requested, setRequested] = useState(false);
  const isActivated = activated || requested;
  const disabled = isActivated || locked;
  return (
    <div style={{
      background: locked && !isActivated ? T.bg : T.surface,
      border: `1px solid ${T.borderLight}`, borderRadius: 12,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14,
      opacity: locked && !isActivated ? 0.7 : 1,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          {s.label}
          {s.watchStar && <span title="Made for watch stores">⭐</span>}
          {s.impact && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: T.purple,
              background: T.purpleBg, border: `1px solid ${T.purple}`,
              borderRadius: 999, padding: '1px 8px',
            }}>
              {s.impact}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{s.blurb}</div>
        {s.evidence && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
            {s.evidence}{s.source ? ` (${s.source})` : ''}
          </div>
        )}
      </div>
      <button
        disabled={disabled}
        title={locked && !isActivated ? 'Finish the current test before queuing a new tactic' : undefined}
        onClick={() => {
          if (disabled) return;
          setRequested(true);
          fetch(`/api/stores/${storeId}/cro/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: s.key }),
          }).catch(() => {});
        }}
        style={{
          background: isActivated ? 'transparent' : (locked ? T.borderLight : T.purple),
          color: isActivated ? T.green : (locked ? T.textMuted : '#fff'),
          border: isActivated ? `1px solid ${T.green}` : 'none',
          borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {isActivated ? 'Requested ✓' : (locked ? '🔒 Locked' : 'Activate')}
      </button>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: 'center', background: T.bg, color: T.textMuted, minHeight: '100vh' }}>Loading…</div>}>
      <AnalyticsInner />
    </Suspense>
  );
}
