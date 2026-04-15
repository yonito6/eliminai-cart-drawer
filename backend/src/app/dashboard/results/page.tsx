'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useStore } from '@/lib/hooks/use-store';

interface VariantStat {
  id: string;
  name: string;
  label?: string;
  features: Record<string, any>;
  stats: {
    visitors: number;
    cartOpens: number;
    checkouts: number;
    orders: number;
    revenue: number;
    checkoutRate: string;
  };
}

interface DailyEntry {
  date: string;
  variants: Record<string, { cartOpens: number; checkouts: number; orders: number; revenue: number; visitors: number }>;
}

interface ExperimentRecord {
  id: string;
  name: string;
  slot: string;
  status: string;
  variants: VariantStat[];
  winnerVariantId: string | null;
  confidence: number;
  liftPercent: number | null;
  startedAt: string;
  endedAt: string | null;
  durationDays: number;
  notes: Array<{ timestamp: string; type: string; detail: string }>;
  tournament: any;
  totalVisitors: number;
  dailyBreakdown: DailyEntry[];
}

interface Summary {
  totalTests: number;
  activeTests: number;
  winRate: string;
  cumulativeLift: string;
  bestChange: { name: string; lift: number } | null;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string; glow?: string }> = {
  RUNNING: { bg: 'rgba(124,58,237,0.12)', color: '#7c3aed', label: 'Running', glow: '0 0 12px rgba(124,58,237,0.25)' },
  WINNER_FOUND: { bg: 'rgba(22,163,106,0.12)', color: '#16a34a', label: 'Winner Found', glow: '0 0 12px rgba(22,163,106,0.2)' },
  NO_DIFFERENCE: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'No Difference' },
  REVERTED: { bg: 'rgba(220,38,38,0.1)', color: '#dc2626', label: 'Reverted' },
  PAUSED: { bg: 'rgba(217,119,6,0.1)', color: '#d97706', label: 'Paused' },
  INVALIDATED: { bg: 'rgba(220,38,38,0.1)', color: '#dc2626', label: 'Invalid' },
};

const SLOT_LABELS: Record<string, { label: string; icon: string }> = {
  trustBadges: { label: 'Trust Badges', icon: '\uD83D\uDEE1\uFE0F' },
  shippingBar: { label: 'Shipping Progress Bar', icon: '\uD83D\uDE9A' },
  scarcity: { label: 'Scarcity Timer', icon: '\u23F1\uFE0F' },
  upsell: { label: 'Upsell Offers', icon: '\uD83D\uDCB0' },
  giftWithPurchase: { label: 'Gift with Purchase', icon: '\uD83C\uDF81' },
  countdown: { label: 'Countdown Timer', icon: '\u231B' },
  socialProof: { label: 'Social Proof', icon: '\uD83D\uDC65' },
  recentlyViewed: { label: 'Recently Viewed', icon: '\uD83D\uDC41\uFE0F' },
};

/* ── Google Font injection ────────────────────────────────────────── */
function useFontLink() {
  useEffect(() => {
    if (document.getElementById('results-fonts')) return;
    const link = document.createElement('link');
    link.id = 'results-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
}

/* ── Shared style tokens ──────────────────────────────────────────── */
const T = {
  font: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  // colors
  bg: '#f8f9fb',
  surface: '#ffffff',
  surfaceHover: '#fafbfc',
  border: '#e8eaed',
  borderLight: '#f0f1f3',
  text: '#1a1d23',
  textSecondary: '#5f6672',
  textMuted: '#8b919d',
  purple: '#7c3aed',
  purpleBg: 'rgba(124,58,237,0.08)',
  green: '#16a34a',
  greenBg: 'rgba(22,163,106,0.08)',
  radius: 14,
  radiusSm: 10,
};

export default function ResultsPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ padding: 60, textAlign: 'center', color: T.textMuted, fontSize: 16, fontFamily: T.font }}>
        Loading history...
      </div>
    }>
      <ResultsPage />
    </Suspense>
  );
}

function ResultsPage() {
  useFontLink();
  const { storeId, loading: storeLoading, error: storeError } = useStore();
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/stores/${storeId}/experiments/history`)
      .then(r => r.json())
      .then(data => {
        setExperiments(data.experiments || []);
        setSummary(data.summary || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storeId]);

  if (storeLoading || loading) return (
    <div style={{ padding: 80, textAlign: 'center', fontFamily: T.font }}>
      <div style={{ fontSize: 18, color: T.textMuted, fontWeight: 400 }}>Loading results...</div>
    </div>
  );
  if (storeError || !storeId) return (
    <div style={{ padding: 80, textAlign: 'center', fontFamily: T.font }}>
      <div style={{ fontSize: 18, color: '#dc2626', fontWeight: 500 }}>Store not found.</div>
    </div>
  );

  const slotGroups: Record<string, ExperimentRecord[]> = {};
  for (const exp of experiments) {
    const slot = exp.slot || 'other';
    if (!slotGroups[slot]) slotGroups[slot] = [];
    slotGroups[slot].push(exp);
  }

  const sortedSlots = Object.entries(slotGroups).sort(([, a], [, b]) => {
    const aRunning = a.some(e => e.status === 'RUNNING') ? 1 : 0;
    const bRunning = b.some(e => e.status === 'RUNNING') ? 1 : 0;
    if (aRunning !== bRunning) return bRunning - aRunning;
    return new Date(b[0]?.startedAt || 0).getTime() - new Date(a[0]?.startedAt || 0).getTime();
  });

  const toggleSlot = (slot: string) => {
    setCollapsedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  return (
    <div style={{ padding: '36px 32px 60px', maxWidth: 1160, margin: '0 auto', fontFamily: T.font, background: T.bg, minHeight: '100vh' }}>

      {/* ── Page Header ──────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2,
        }}>
          Test Results
        </h1>
        <p style={{ fontSize: 16, color: T.textSecondary, margin: '8px 0 0', lineHeight: 1.5, fontWeight: 400 }}>
          A/B test performance organized by feature. Click any test for detailed breakdown.
        </p>
      </div>

      {/* ── Summary Cards ────────────────────────────────────── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Tests', value: String(summary.totalTests), sub: 'completed', color: T.text },
            { label: 'Active Now', value: String(summary.activeTests), sub: 'running', color: T.purple },
            { label: 'Win Rate', value: summary.winRate + '%', sub: 'of tests', color: T.text },
            { label: 'Total Lift', value: '+' + summary.cumulativeLift + '%', sub: 'cumulative', color: T.green },
          ].map((card, i) => (
            <div key={i} style={{
              background: T.surface,
              borderRadius: T.radius,
              padding: '24px 26px',
              border: `1px solid ${T.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                fontSize: 13, color: T.textMuted, fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              }}>
                {card.label}
              </div>
              <div style={{
                fontSize: 36, fontWeight: 700, color: card.color,
                lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: T.mono,
              }}>
                {card.value}
              </div>
              <div style={{ fontSize: 14, color: T.textMuted, marginTop: 4 }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Best Change Banner ───────────────────────────────── */}
      {summary?.bestChange && (
        <div style={{
          marginBottom: 28, padding: '18px 24px',
          background: 'linear-gradient(135deg, rgba(22,163,106,0.06) 0%, rgba(22,163,106,0.02) 100%)',
          border: `1px solid rgba(22,163,106,0.15)`,
          borderRadius: T.radius, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{'\uD83C\uDFC6'}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Best performing: </span>
            <span style={{ fontSize: 16, color: T.textSecondary, fontWeight: 400 }}>{summary.bestChange.name}</span>
          </div>
          <span style={{
            fontSize: 20, fontWeight: 700, color: T.green, fontFamily: T.mono,
          }}>
            +{summary.bestChange.lift?.toFixed(1)}%
          </span>
        </div>
      )}

      {/* ── Empty State ──────────────────────────────────────── */}
      {sortedSlots.length === 0 && (
        <div style={{
          padding: '80px 40px', textAlign: 'center', background: T.surface,
          borderRadius: T.radius, border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>{'\uD83E\uDDEA'}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: T.text, marginBottom: 8 }}>No tests yet</div>
          <div style={{ fontSize: 16, color: T.textMuted, maxWidth: 360, margin: '0 auto' }}>
            Start an A/B test on any addon to see results here.
          </div>
        </div>
      )}

      {/* ── Addon Groups (Tree) ──────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sortedSlots.map(([slot, slotExps]) => {
          const slotInfo = SLOT_LABELS[slot] || { label: slot, icon: '\uD83E\uDDEA' };
          const isCollapsed = collapsedSlots.has(slot);
          const hasRunning = slotExps.some(e => e.status === 'RUNNING');
          const totalTests = slotExps.length;

          const winnerExps = slotExps.filter(e => e.status === 'WINNER_FOUND' && e.liftPercent && e.liftPercent > 0);
          const bestLift = winnerExps.length > 0 ? Math.max(...winnerExps.map(e => e.liftPercent || 0)) : null;

          return (
            <div key={slot} style={{
              borderRadius: T.radius,
              border: `1px solid ${hasRunning ? 'rgba(124,58,237,0.2)' : T.border}`,
              background: T.surface,
              boxShadow: hasRunning ? '0 0 0 1px rgba(124,58,237,0.05), 0 2px 8px rgba(124,58,237,0.06)' : '0 1px 3px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              {/* ── Slot Header ────────────────────────────────── */}
              <div
                onClick={() => toggleSlot(slot)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px',
                  cursor: 'pointer', userSelect: 'none',
                  borderBottom: isCollapsed ? 'none' : `1px solid ${T.borderLight}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Arrow */}
                <svg width="12" height="12" viewBox="0 0 12 12" style={{
                  transition: 'transform 0.2s ease',
                  transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                  flexShrink: 0,
                }}>
                  <path d="M4 2l4 4-4 4" fill="none" stroke={T.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {/* Icon */}
                <span style={{ fontSize: 26, lineHeight: 1 }}>{slotInfo.icon}</span>

                {/* Slot info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 19, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>
                    {slotInfo.label}
                  </div>
                  <div style={{ fontSize: 14, color: T.textMuted, marginTop: 3 }}>
                    {totalTests} test{totalTests !== 1 ? 's' : ''}
                    {hasRunning && (
                      <span style={{
                        color: T.purple, fontWeight: 600, marginLeft: 10,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', background: T.purple,
                          display: 'inline-block', boxShadow: '0 0 6px rgba(124,58,237,0.4)',
                        }} />
                        1 active
                      </span>
                    )}
                  </div>
                </div>

                {/* Best lift pill */}
                {bestLift !== null && (
                  <div style={{
                    padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 700,
                    background: T.greenBg, color: T.green, fontFamily: T.mono,
                  }}>
                    +{bestLift.toFixed(0)}%
                  </div>
                )}
              </div>

              {/* ── Tests under slot ───────────────────────────── */}
              {!isCollapsed && (
                <div>
                  {slotExps.map((exp, expIdx) => {
                    const badge = STATUS_BADGE[exp.status] || { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: exp.status };
                    const isExpanded = expandedId === exp.id;

                    const sortedByRate = [...exp.variants].sort((a, b) => {
                      const rateA = a.stats.cartOpens > 0 ? a.stats.orders / a.stats.cartOpens * 100 : 0;
                      const rateB = b.stats.cartOpens > 0 ? b.stats.orders / b.stats.cartOpens * 100 : 0;
                      return rateB - rateA;
                    });
                    const topRate = sortedByRate[0]?.stats.cartOpens > 0 ? (sortedByRate[0].stats.orders / sortedByRate[0].stats.cartOpens * 100) : 0;
                    const runnerRate = sortedByRate[1]?.stats.cartOpens > 0 ? (sortedByRate[1].stats.orders / sortedByRate[1].stats.cartOpens * 100) : 0;
                    const observedLift = runnerRate > 0 ? ((topRate - runnerRate) / runnerRate * 100) : 0;

                    const dimensionName = exp.name.includes('\u2014') ? exp.name.split('\u2014')[1]?.trim() : exp.name;

                    return (
                      <div key={exp.id}>
                        {/* ── Test Row ─────────────────────────── */}
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                          style={{
                            padding: '18px 24px 18px 64px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            borderTop: expIdx > 0 ? `1px solid ${T.borderLight}` : 'none',
                            background: isExpanded ? '#fafbfd' : T.surface,
                            transition: 'background 0.12s',
                            position: 'relative',
                          }}
                          onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = T.surfaceHover; }}
                          onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = T.surface; }}
                        >
                          {/* Tree connector */}
                          <div style={{
                            position: 'absolute', left: 40, top: '50%',
                            width: 14, height: 1, background: T.borderLight,
                          }} />
                          <div style={{
                            position: 'absolute', left: 40, top: 0,
                            width: 1, height: expIdx === slotExps.length - 1 ? '50%' : '100%',
                            background: T.borderLight,
                          }} />

                          {/* Status dot */}
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                            background: badge.color,
                            boxShadow: badge.glow || 'none',
                          }} />

                          {/* Name + metadata */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>
                              {dimensionName}
                            </div>
                            <div style={{ fontSize: 14, color: T.textMuted, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span>{new Date(exp.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span style={{ color: T.borderLight }}>|</span>
                              <span>{exp.durationDays} day{exp.durationDays !== 1 ? 's' : ''}</span>
                              <span style={{ color: T.borderLight }}>|</span>
                              <span style={{ fontFamily: T.mono, fontSize: 13 }}>{exp.totalVisitors.toLocaleString()} visitors</span>
                            </div>
                          </div>

                          {/* Lift indicator */}
                          {observedLift > 0 && exp.variants.length >= 2 && (
                            <div style={{
                              fontSize: 18, fontWeight: 700, fontFamily: T.mono,
                              color: exp.status === 'WINNER_FOUND' ? T.green : T.purple,
                            }}>
                              +{observedLift.toFixed(1)}%
                            </div>
                          )}

                          {/* Status badge */}
                          <span style={{
                            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: badge.bg, color: badge.color,
                            letterSpacing: '0.03em', whiteSpace: 'nowrap',
                          }}>
                            {badge.label}
                          </span>

                          {/* Chevron */}
                          <svg width="10" height="10" viewBox="0 0 10 10" style={{
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            flexShrink: 0,
                          }}>
                            <path d="M3 1.5l3.5 3.5L3 8.5" fill="none" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>

                        {/* ── Expanded Details ─────────────────── */}
                        {isExpanded && (
                          <div style={{
                            padding: '0 24px 28px 64px',
                            background: '#fafbfd',
                            borderTop: `1px solid ${T.borderLight}`,
                          }}>
                            {/* Variant comparison cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${exp.variants.length}, 1fr)`, gap: 16, marginTop: 24, marginBottom: 20 }}>
                              {exp.variants.map(v => {
                                const isWinner = v.id === exp.winnerVariantId;
                                const purchaseRate = v.stats.cartOpens > 0 ? (v.stats.orders / v.stats.cartOpens * 100).toFixed(2) : '0.00';
                                return (
                                  <div key={v.id} style={{
                                    padding: '22px 24px', borderRadius: T.radiusSm,
                                    background: isWinner ? 'linear-gradient(135deg, rgba(22,163,106,0.04) 0%, rgba(22,163,106,0.01) 100%)' : T.surface,
                                    border: isWinner ? '2px solid rgba(22,163,106,0.25)' : `1px solid ${T.border}`,
                                    boxShadow: isWinner ? '0 2px 8px rgba(22,163,106,0.06)' : '0 1px 2px rgba(0,0,0,0.03)',
                                  }}>
                                    {/* Variant header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                      <span style={{ fontWeight: 600, fontSize: 17, color: T.text }}>
                                        {v.label || v.name}
                                      </span>
                                      {isWinner && (
                                        <span style={{
                                          fontSize: 11, fontWeight: 700, color: T.green,
                                          background: T.greenBg, padding: '4px 12px', borderRadius: 16,
                                          letterSpacing: '0.05em', textTransform: 'uppercase',
                                        }}>
                                          Winner
                                        </span>
                                      )}
                                    </div>

                                    {/* Stats grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px 16px' }}>
                                      <StatCell label="Visitors" value={v.stats.visitors.toLocaleString()} />
                                      <StatCell label="Cart Opens" value={v.stats.cartOpens.toLocaleString()} />
                                      <StatCell label="Checkouts" value={v.stats.checkouts.toLocaleString()} />
                                      <StatCell label="Orders" value={v.stats.orders.toLocaleString()} />
                                      <StatCell
                                        label="Purchase Rate"
                                        value={purchaseRate + '%'}
                                        highlight
                                        color={isWinner ? T.green : T.purple}
                                      />
                                      <StatCell label="Checkout Rate" value={v.stats.checkoutRate + '%'} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Lift banner */}
                            {observedLift > 0 && exp.variants.length >= 2 && (
                              <div style={{
                                padding: '20px 24px', borderRadius: T.radiusSm, textAlign: 'center', marginBottom: 20,
                                background: exp.status === 'WINNER_FOUND'
                                  ? 'linear-gradient(135deg, rgba(22,163,106,0.06) 0%, rgba(22,163,106,0.02) 100%)'
                                  : 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(124,58,237,0.02) 100%)',
                                border: '1px solid ' + (exp.status === 'WINNER_FOUND' ? 'rgba(22,163,106,0.15)' : 'rgba(124,58,237,0.15)'),
                              }}>
                                <div style={{
                                  fontSize: 28, fontWeight: 700, fontFamily: T.mono, letterSpacing: '-0.02em',
                                  color: exp.status === 'WINNER_FOUND' ? T.green : T.purple,
                                }}>
                                  +{observedLift.toFixed(1)}%
                                </div>
                                <div style={{ fontSize: 15, color: T.textSecondary, marginTop: 6 }}>
                                  purchase rate lift &mdash; {sortedByRate[0]?.label || sortedByRate[0]?.name || 'A'} at {topRate.toFixed(2)}% vs {runnerRate.toFixed(2)}%
                                </div>
                              </div>
                            )}

                            {/* Confidence + metadata */}
                            <div style={{
                              display: 'flex', gap: 28, fontSize: 15, color: T.textSecondary, marginBottom: 20,
                              padding: '14px 0', borderTop: `1px solid ${T.borderLight}`, borderBottom: `1px solid ${T.borderLight}`,
                            }}>
                              <span>
                                Confidence:{' '}
                                <strong style={{ color: T.text, fontFamily: T.mono }}>
                                  {typeof exp.confidence === 'number' && exp.confidence < 1
                                    ? (exp.confidence * 100).toFixed(1) : exp.confidence}%
                                </strong>
                              </span>
                              {exp.endedAt && (
                                <span>
                                  Ended:{' '}
                                  <strong style={{ color: T.text }}>
                                    {new Date(exp.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </strong>
                                </span>
                              )}
                              <span>
                                Duration:{' '}
                                <strong style={{ color: T.text }}>{exp.durationDays} days</strong>
                              </span>
                            </div>

                            {/* Daily chart */}
                            {exp.dailyBreakdown && exp.dailyBreakdown.length > 0 && (
                              <DailyBreakdown daily={exp.dailyBreakdown} variants={exp.variants} winnerVariantId={exp.winnerVariantId} />
                            )}

                            {/* Timeline */}
                            {exp.notes.length > 0 && (
                              <div style={{ marginTop: 20 }}>
                                <div style={{
                                  fontSize: 13, fontWeight: 600, color: T.textMuted,
                                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
                                }}>
                                  Timeline
                                </div>
                                {exp.notes.map((note, i) => (
                                  <div key={i} style={{
                                    display: 'flex', gap: 14, fontSize: 14, padding: '10px 0',
                                    borderBottom: i < exp.notes.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                                    alignItems: 'baseline',
                                  }}>
                                    <span style={{
                                      color: T.textMuted, minWidth: 100, flexShrink: 0,
                                      fontFamily: T.mono, fontSize: 13,
                                    }}>
                                      {new Date(note.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span style={{ color: T.textSecondary }}>{note.detail}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Stat Cell ────────────────────────────────────────────────────── */

function StatCell({ label, value, highlight, color }: {
  label: string; value: string; highlight?: boolean; color?: string;
}) {
  return (
    <div>
      <div style={{
        color: T.textMuted, fontSize: 12, marginBottom: 4, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </div>
      <div style={{
        fontWeight: highlight ? 700 : 600,
        fontSize: highlight ? 22 : 18,
        color: color || T.text,
        fontFamily: T.mono,
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}>
        {value}
      </div>
    </div>
  );
}

/* ── Daily Breakdown Chart ────────────────────────────────────────── */

const VARIANT_COLORS = ['#7c3aed', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#f97316'];

function DailyBreakdown({ daily, variants, winnerVariantId }: {
  daily: DailyEntry[];
  variants: VariantStat[];
  winnerVariantId: string | null;
}) {
  const [metric, setMetric] = useState<'purchaseRate' | 'cartOpens' | 'orders'>('purchaseRate');

  const series = variants.map((v, vi) => ({
    id: v.id,
    name: v.label || v.name,
    color: VARIANT_COLORS[vi % VARIANT_COLORS.length],
    isWinner: v.id === winnerVariantId,
    points: daily.map(d => {
      const s = d.variants[v.id] || { cartOpens: 0, checkouts: 0, orders: 0, revenue: 0, visitors: 0 };
      if (metric === 'purchaseRate') return s.cartOpens > 0 ? (s.orders / s.cartOpens) * 100 : 0;
      if (metric === 'orders') return s.orders;
      return s.cartOpens;
    }),
  }));

  const allValues = series.flatMap(s => s.points);
  const maxVal = Math.max(...allValues, 1);
  const dayCount = daily.length;
  const W = 640, H = 240, padL = 52, padR = 20, padT = 20, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  function xPos(i: number) { return padL + (dayCount > 1 ? (i / (dayCount - 1)) * chartW : chartW / 2); }
  function yPos(val: number) { return padT + chartH - (val / maxVal) * chartH; }
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxVal / 4) * i);

  return (
    <div>
      {/* Header + metric toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Daily Performance
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
          {(['purchaseRate', 'cartOpens', 'orders'] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: metric === m ? T.surface : 'transparent',
              color: metric === m ? T.purple : T.textMuted,
              boxShadow: metric === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>
              {m === 'purchaseRate' ? 'Rate' : m === 'orders' ? 'Orders' : 'Cart Opens'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{
        background: T.surface, borderRadius: T.radiusSm,
        border: `1px solid ${T.border}`, padding: '14px 8px 8px', overflow: 'hidden',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line x1={padL} y1={yPos(tick)} x2={W - padR} y2={yPos(tick)} stroke={T.borderLight} strokeWidth={0.8} />
              <text x={padL - 10} y={yPos(tick) + 4} textAnchor="end" fontSize={11} fill={T.textMuted} fontFamily="'JetBrains Mono', monospace">
                {metric === 'purchaseRate' ? tick.toFixed(1) + '%' : Math.round(tick)}
              </text>
            </g>
          ))}
          {/* Data lines */}
          {series.map(s => (
            <g key={s.id}>
              {/* Area fill */}
              <path
                fill={s.color}
                fillOpacity={0.04}
                d={`M ${s.points.map((val, i) => `${xPos(i)},${yPos(val)}`).join(' L ')} L ${xPos(dayCount - 1)},${padT + chartH} L ${xPos(0)},${padT + chartH} Z`}
              />
              <polyline fill="none" stroke={s.color} strokeWidth={s.isWinner ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round"
                points={s.points.map((val, i) => `${xPos(i)},${yPos(val)}`).join(' ')} />
              {s.points.map((val, i) => (
                <circle key={i} cx={xPos(i)} cy={yPos(val)} r={s.isWinner ? 4.5 : 3.5} fill={s.color} stroke={T.surface} strokeWidth={2} />
              ))}
            </g>
          ))}
          {/* X axis labels */}
          {daily.map((d, i) => {
            const step = Math.max(1, Math.ceil(dayCount / 10));
            if (i % step !== 0 && i !== dayCount - 1) return null;
            const label = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <text key={i} x={xPos(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={T.textMuted}
                fontFamily="'DM Sans', sans-serif">
                {label}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', padding: '12px 12px 6px', flexWrap: 'wrap' }}>
          {series.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: T.textSecondary }}>
              <div style={{
                width: 14, height: 4, borderRadius: 2, background: s.color, flexShrink: 0,
              }} />
              <span style={{ fontWeight: s.isWinner ? 600 : 400 }}>{s.name}</span>
              {s.isWinner && <span style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>W</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Table */}
      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{
          width: '100%', fontSize: 14, borderCollapse: 'separate', borderSpacing: 0,
          background: T.surface, borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              <th style={{
                textAlign: 'left', padding: '12px 16px', color: T.textMuted,
                fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
                borderBottom: `2px solid ${T.border}`,
              }}>
                Date
              </th>
              {variants.map((v, vi) => (
                <th key={v.id} colSpan={3} style={{
                  textAlign: 'center', padding: '12px 8px', fontWeight: 600, fontSize: 13,
                  color: VARIANT_COLORS[vi % VARIANT_COLORS.length],
                  borderBottom: `2px solid ${T.border}`,
                  borderLeft: `1px solid ${T.borderLight}`,
                }}>
                  {v.label || v.name}
                </th>
              ))}
            </tr>
            <tr style={{ background: '#fcfcfd' }}>
              <th style={{ padding: '8px 16px', borderBottom: `1px solid ${T.borderLight}` }} />
              {variants.map(v => (
                <React.Fragment key={v.id}>
                  <th style={{
                    textAlign: 'center', padding: '8px 8px', color: T.textMuted,
                    fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${T.borderLight}`,
                    borderLeft: `1px solid ${T.borderLight}`,
                  }}>Opens</th>
                  <th style={{
                    textAlign: 'center', padding: '8px 8px', color: T.textMuted,
                    fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${T.borderLight}`,
                  }}>Orders</th>
                  <th style={{
                    textAlign: 'center', padding: '8px 8px', color: T.textMuted,
                    fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${T.borderLight}`,
                  }}>Rate</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {daily.map((d, di) => (
              <tr key={d.date} style={{
                borderBottom: di < daily.length - 1 ? `1px solid ${T.borderLight}` : 'none',
              }}>
                <td style={{
                  padding: '10px 16px', color: T.text, fontWeight: 500, whiteSpace: 'nowrap',
                  fontSize: 14, fontFamily: T.font,
                  borderBottom: di < daily.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                }}>
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </td>
                {variants.map((v, vi) => {
                  const s = d.variants[v.id] || { cartOpens: 0, orders: 0 };
                  const rate = s.cartOpens > 0 ? (s.orders / s.cartOpens * 100).toFixed(1) : '0.0';
                  return (
                    <React.Fragment key={v.id}>
                      <td style={{
                        textAlign: 'center', padding: '10px 8px', color: T.textSecondary,
                        fontFamily: T.mono, fontSize: 13,
                        borderBottom: di < daily.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                        borderLeft: `1px solid ${T.borderLight}`,
                      }}>{s.cartOpens}</td>
                      <td style={{
                        textAlign: 'center', padding: '10px 8px', color: T.textSecondary,
                        fontFamily: T.mono, fontSize: 13,
                        borderBottom: di < daily.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                      }}>{s.orders}</td>
                      <td style={{
                        textAlign: 'center', padding: '10px 8px',
                        fontWeight: 600, fontFamily: T.mono, fontSize: 13,
                        color: VARIANT_COLORS[vi % VARIANT_COLORS.length],
                        borderBottom: di < daily.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                      }}>{rate}%</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
