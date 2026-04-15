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

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  RUNNING: { bg: '#ede9fe', color: '#7c3aed', label: 'Running' },
  WINNER_FOUND: { bg: '#dcfce7', color: '#16a34a', label: 'Winner' },
  NO_DIFFERENCE: { bg: '#f3f4f6', color: '#6b7280', label: 'No Diff' },
  REVERTED: { bg: '#fef2f2', color: '#dc2626', label: 'Reverted' },
  PAUSED: { bg: '#fef3c7', color: '#d97706', label: 'Paused' },
  INVALIDATED: { bg: '#fef2f2', color: '#dc2626', label: 'Invalid' },
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

export default function ResultsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 15 }}>Loading history...</div>}>
      <ResultsPage />
    </Suspense>
  );
}

function ResultsPage() {
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

  if (storeLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 15 }}>Loading store...</div>;
  if (storeError || !storeId) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 15 }}>Store not found.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 15 }}>Loading history...</div>;

  // Group experiments by slot (addon category)
  const slotGroups: Record<string, ExperimentRecord[]> = {};
  for (const exp of experiments) {
    const slot = exp.slot || 'other';
    if (!slotGroups[slot]) slotGroups[slot] = [];
    slotGroups[slot].push(exp);
  }

  // Sort slots: ones with running tests first, then by most recent test
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
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Test History</h1>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
          All A/B tests organized by feature. Click any test to see full details.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Tests', value: String(summary.totalTests), color: '#111827' },
            { label: 'Active Now', value: String(summary.activeTests), color: '#7c3aed' },
            { label: 'Win Rate', value: summary.winRate + '%', color: '#111827' },
            { label: 'Cumulative Lift', value: '+' + summary.cumulativeLift + '%', color: '#16a34a' },
          ].map((card, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 12, padding: '18px 22px',
              border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: card.color, marginTop: 6 }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Best Change callout */}
      {summary?.bestChange && (
        <div style={{
          marginBottom: 24, padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>{'\uD83C\uDFC6'}</span>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Best performing change: </span>
            <span style={{ fontSize: 14, color: '#374151' }}>{summary.bestChange.name}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', marginLeft: 8 }}>+{summary.bestChange.lift?.toFixed(1)}% lift</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedSlots.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#9ca3af', background: '#fff',
          borderRadius: 12, border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{'\uD83E\uDDEA'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No tests yet</div>
          <div style={{ fontSize: 14 }}>Start an A/B test on any addon to see results here.</div>
        </div>
      )}

      {/* Tree: Grouped by Addon Slot */}
      {sortedSlots.map(([slot, slotExps]) => {
        const slotInfo = SLOT_LABELS[slot] || { label: slot, icon: '\uD83E\uDDEA' };
        const isCollapsed = collapsedSlots.has(slot);
        const hasRunning = slotExps.some(e => e.status === 'RUNNING');
        const hasWinner = slotExps.some(e => e.status === 'WINNER_FOUND');
        const totalTests = slotExps.length;

        // Slot-level summary: best lift from winner tests
        const winnerExps = slotExps.filter(e => e.status === 'WINNER_FOUND' && e.liftPercent && e.liftPercent > 0);
        const bestLift = winnerExps.length > 0 ? Math.max(...winnerExps.map(e => e.liftPercent || 0)) : null;

        return (
          <div key={slot} style={{ marginBottom: 16 }}>
            {/* Slot Header (tree branch) */}
            <div
              onClick={() => toggleSlot(slot)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                background: hasRunning ? '#faf5ff' : '#fff',
                border: hasRunning ? '1px solid #ddd6fe' : '1px solid #e5e7eb',
                borderRadius: isCollapsed ? 12 : '12px 12px 0 0',
                cursor: 'pointer', userSelect: 'none',
                transition: 'all 0.15s',
              }}
            >
              {/* Expand/collapse arrow */}
              <span style={{
                fontSize: 14, color: '#9ca3af', transition: 'transform 0.2s',
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                fontFamily: 'monospace',
              }}>{'\u25B6'}</span>

              {/* Icon */}
              <span style={{ fontSize: 20 }}>{slotInfo.icon}</span>

              {/* Slot name + test count */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{slotInfo.label}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 1 }}>
                  {totalTests} test{totalTests !== 1 ? 's' : ''}
                  {hasRunning && <span style={{ color: '#7c3aed', fontWeight: 600, marginLeft: 8 }}>1 running</span>}
                </div>
              </div>

              {/* Best lift badge */}
              {bestLift !== null && (
                <div style={{
                  padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: '#dcfce7', color: '#16a34a',
                }}>
                  Best: +{bestLift.toFixed(0)}%
                </div>
              )}

              {/* Status indicators */}
              <div style={{ display: 'flex', gap: 4 }}>
                {hasRunning && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 0 3px #ede9fe' }} />}
                {hasWinner && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />}
              </div>
            </div>

            {/* Tests under this slot */}
            {!isCollapsed && (
              <div style={{
                border: hasRunning ? '1px solid #ddd6fe' : '1px solid #e5e7eb',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px',
                overflow: 'hidden',
              }}>
                {slotExps.map((exp, expIdx) => {
                  const badge = STATUS_BADGE[exp.status] || { bg: '#f3f4f6', color: '#6b7280', label: exp.status };
                  const isExpanded = expandedId === exp.id;

                  const sortedByRate = [...exp.variants].sort((a, b) => {
                    const rateA = a.stats.cartOpens > 0 ? a.stats.orders / a.stats.cartOpens * 100 : 0;
                    const rateB = b.stats.cartOpens > 0 ? b.stats.orders / b.stats.cartOpens * 100 : 0;
                    return rateB - rateA;
                  });
                  const topRate = sortedByRate[0]?.stats.cartOpens > 0 ? (sortedByRate[0].stats.orders / sortedByRate[0].stats.cartOpens * 100) : 0;
                  const runnerRate = sortedByRate[1]?.stats.cartOpens > 0 ? (sortedByRate[1].stats.orders / sortedByRate[1].stats.cartOpens * 100) : 0;
                  const observedLift = runnerRate > 0 ? ((topRate - runnerRate) / runnerRate * 100) : 0;

                  // Extract dimension name from experiment name (after the dash)
                  const dimensionName = exp.name.includes('\u2014') ? exp.name.split('\u2014')[1]?.trim() : exp.name;

                  return (
                    <div key={exp.id}>
                      {/* Test row */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                        style={{
                          padding: '14px 20px 14px 52px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          borderTop: expIdx > 0 ? '1px solid #f3f4f6' : 'none',
                          background: isExpanded ? '#fafafa' : '#fff',
                          transition: 'background 0.1s',
                        }}
                      >
                        {/* Tree branch connector line */}
                        <div style={{
                          position: 'relative',
                          width: 0, height: 0,
                        }}>
                          <div style={{
                            position: 'absolute', left: -32, top: -7,
                            width: 20, height: 1, background: '#d1d5db',
                          }} />
                        </div>

                        {/* Status dot */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: badge.color,
                          boxShadow: exp.status === 'RUNNING' ? '0 0 0 3px ' + badge.bg : 'none',
                        }} />

                        {/* Name + metadata */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{dimensionName}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                            {new Date(exp.startedAt).toLocaleDateString()}
                            {exp.endedAt ? ' \u2192 ' + new Date(exp.endedAt).toLocaleDateString() : ' \u2192 ongoing'}
                            {' \u00B7 '}{exp.durationDays}d
                            {' \u00B7 '}{exp.totalVisitors.toLocaleString()} visitors
                          </div>
                        </div>

                        {/* Lift */}
                        {observedLift > 0 && exp.variants.length >= 2 && (
                          <div style={{
                            fontSize: 14, fontWeight: 700,
                            color: exp.status === 'WINNER_FOUND' ? '#16a34a' : '#7c3aed',
                          }}>
                            +{observedLift.toFixed(0)}%
                          </div>
                        )}

                        {/* Badge */}
                        <span style={{
                          padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: badge.bg, color: badge.color,
                          textTransform: 'uppercase', letterSpacing: '0.03em',
                        }}>
                          {badge.label}
                        </span>

                        {/* Chevron */}
                        <span style={{
                          fontSize: 14, color: '#9ca3af', transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}>{'\u203A'}</span>
                      </div>

                      {/* Expanded test details */}
                      {isExpanded && (
                        <div style={{ padding: '0 20px 20px 52px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                          {/* Variant comparison cards */}
                          <div style={{ display: 'flex', gap: 12, marginTop: 16, marginBottom: 16 }}>
                            {exp.variants.map(v => {
                              const isWinner = v.id === exp.winnerVariantId;
                              const purchaseRate = v.stats.cartOpens > 0 ? (v.stats.orders / v.stats.cartOpens * 100).toFixed(1) : '0.0';
                              return (
                                <div key={v.id} style={{
                                  flex: 1, padding: 16, borderRadius: 12,
                                  background: isWinner ? '#f0fdf4' : '#fff',
                                  border: isWinner ? '2px solid #86efac' : '1px solid #e5e7eb',
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{v.label || v.name}</span>
                                    {isWinner && (
                                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 10px', borderRadius: 8 }}>
                                        WINNER
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 12px' }}>
                                    <StatCell label="Visitors" value={v.stats.visitors.toLocaleString()} />
                                    <StatCell label="Cart Opens" value={v.stats.cartOpens.toLocaleString()} />
                                    <StatCell label="Checkouts" value={v.stats.checkouts.toLocaleString()} />
                                    <StatCell label="Orders" value={v.stats.orders.toLocaleString()} />
                                    <StatCell label="Purchase Rate" value={purchaseRate + '%'} bold color={isWinner ? '#16a34a' : '#374151'} />
                                    <StatCell label="Checkout Rate" value={v.stats.checkoutRate + '%'} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Lift banner */}
                          {observedLift > 0 && exp.variants.length >= 2 && (
                            <div style={{
                              padding: '14px 18px', borderRadius: 12, textAlign: 'center', marginBottom: 16,
                              background: exp.status === 'WINNER_FOUND' ? '#f0fdf4' : '#f5f3ff',
                              border: '1px solid ' + (exp.status === 'WINNER_FOUND' ? '#bbf7d0' : '#ddd6fe'),
                            }}>
                              <div style={{ fontSize: 22, fontWeight: 700, color: exp.status === 'WINNER_FOUND' ? '#16a34a' : '#7c3aed' }}>
                                +{observedLift.toFixed(1)}% purchase rate lift
                              </div>
                              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
                                {(sortedByRate[0]?.label || sortedByRate[0]?.name || 'A')} at {topRate.toFixed(1)}% vs {runnerRate.toFixed(1)}%
                              </div>
                            </div>
                          )}

                          {/* Confidence */}
                          <div style={{ display: 'flex', gap: 20, fontSize: 14, color: '#6b7280', marginBottom: 14 }}>
                            <span>Confidence: <strong style={{ color: '#374151' }}>{typeof exp.confidence === 'number' && exp.confidence < 1 ? (exp.confidence * 100).toFixed(1) : exp.confidence}%</strong></span>
                            {exp.endedAt && <span>Ended: <strong style={{ color: '#374151' }}>{new Date(exp.endedAt).toLocaleDateString()}</strong></span>}
                          </div>

                          {/* Daily chart */}
                          {exp.dailyBreakdown && exp.dailyBreakdown.length > 0 && (
                            <DailyBreakdown daily={exp.dailyBreakdown} variants={exp.variants} winnerVariantId={exp.winnerVariantId} />
                          )}

                          {/* Timeline */}
                          {exp.notes.length > 0 && (
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Timeline</div>
                              {exp.notes.map((note, i) => (
                                <div key={i} style={{
                                  display: 'flex', gap: 10, fontSize: 13, padding: '6px 0',
                                  borderBottom: i < exp.notes.length - 1 ? '1px solid #f3f4f6' : 'none',
                                }}>
                                  <span style={{ color: '#9ca3af', minWidth: 80, flexShrink: 0 }}>{new Date(note.timestamp).toLocaleDateString()}</span>
                                  <span style={{ color: '#374151' }}>{note.detail}</span>
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
  );
}

function StatCell({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div>
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: bold ? 700 : 600, fontSize: 14, color: color || '#374151' }}>{value}</div>
    </div>
  );
}

/* ── Daily Breakdown Chart ─────────────────────────────────────────── */

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
  const W = 600, H = 220, padL = 44, padR = 16, padT = 16, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  function x(i: number) { return padL + (dayCount > 1 ? (i / (dayCount - 1)) * chartW : chartW / 2); }
  function y(val: number) { return padT + chartH - (val / maxVal) * chartH; }
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxVal / 4) * i);

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Performance</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['purchaseRate', 'cartOpens', 'orders'] as const).map(m => (
            <button key={m} onClick={() => setMetric(m)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: metric === m ? '1px solid #7c3aed' : '1px solid #e5e7eb',
              background: metric === m ? '#ede9fe' : '#fff',
              color: metric === m ? '#7c3aed' : '#6b7280',
            }}>
              {m === 'purchaseRate' ? 'Rate' : m === 'orders' ? 'Orders' : 'Cart Opens'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '10px 0', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line x1={padL} y1={y(tick)} x2={W - padR} y2={y(tick)} stroke="#e5e7eb" strokeWidth={0.5} />
              <text x={padL - 8} y={y(tick) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                {metric === 'purchaseRate' ? tick.toFixed(1) + '%' : Math.round(tick)}
              </text>
            </g>
          ))}
          {series.map(s => (
            <g key={s.id}>
              <polyline fill="none" stroke={s.color} strokeWidth={s.isWinner ? 2.5 : 1.5} strokeLinejoin="round" strokeLinecap="round"
                points={s.points.map((val, i) => `${x(i)},${y(val)}`).join(' ')} />
              {s.points.map((val, i) => (
                <circle key={i} cx={x(i)} cy={y(val)} r={s.isWinner ? 4 : 3} fill={s.color} />
              ))}
            </g>
          ))}
          {daily.map((d, i) => {
            const step = Math.max(1, Math.ceil(dayCount / 10));
            if (i % step !== 0 && i !== dayCount - 1) return null;
            const label = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">{label}</text>;
          })}
        </svg>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '8px 12px 4px', flexWrap: 'wrap' }}>
          {series.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
              <div style={{ width: 12, height: 3, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontWeight: s.isWinner ? 700 : 400 }}>{s.name}</span>
              {s.isWinner && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>W</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Table */}
      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Date</th>
              {variants.map((v, vi) => (
                <th key={v.id} colSpan={3} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600, color: VARIANT_COLORS[vi % VARIANT_COLORS.length] }}>
                  {v.label || v.name}
                </th>
              ))}
            </tr>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <th style={{ padding: '4px 10px' }} />
              {variants.map(v => (
                <React.Fragment key={v.id}>
                  <th style={{ textAlign: 'center', padding: '4px 6px', color: '#9ca3af', fontWeight: 500, fontSize: 11 }}>Opens</th>
                  <th style={{ textAlign: 'center', padding: '4px 6px', color: '#9ca3af', fontWeight: 500, fontSize: 11 }}>Orders</th>
                  <th style={{ textAlign: 'center', padding: '4px 6px', color: '#9ca3af', fontWeight: 500, fontSize: 11 }}>Rate</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {daily.map((d, di) => (
              <tr key={d.date} style={{ borderBottom: di < daily.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <td style={{ padding: '7px 10px', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </td>
                {variants.map((v, vi) => {
                  const s = d.variants[v.id] || { cartOpens: 0, orders: 0 };
                  const rate = s.cartOpens > 0 ? (s.orders / s.cartOpens * 100).toFixed(1) : '0.0';
                  return (
                    <React.Fragment key={v.id}>
                      <td style={{ textAlign: 'center', padding: '7px 6px', color: '#6b7280' }}>{s.cartOpens}</td>
                      <td style={{ textAlign: 'center', padding: '7px 6px', color: '#6b7280' }}>{s.orders}</td>
                      <td style={{ textAlign: 'center', padding: '7px 6px', fontWeight: 600, color: VARIANT_COLORS[vi % VARIANT_COLORS.length] }}>{rate}%</td>
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
