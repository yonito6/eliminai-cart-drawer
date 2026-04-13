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
  WINNER_FOUND: { bg: '#dcfce7', color: '#16a34a', label: 'Winner Found' },
  NO_DIFFERENCE: { bg: '#f3f4f6', color: '#6b7280', label: 'No Difference' },
  REVERTED: { bg: '#fef2f2', color: '#dc2626', label: 'Reverted' },
  PAUSED: { bg: '#fef3c7', color: '#d97706', label: 'Paused' },
  INVALIDATED: { bg: '#fef2f2', color: '#dc2626', label: 'Invalidated' },
};

export default function ResultsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading history...</div>}>
      <ResultsPage />
    </Suspense>
  );
}

function ResultsPage() {
  const { storeId, loading: storeLoading, error: storeError } = useStore();
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  if (storeLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading store...</div>;
  if (storeError || !storeId) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Store not found.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading history...</div>;

  const filtered = filter === 'all' ? experiments : experiments.filter(e => e.status === filter);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Test History</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Every A/B test your store has run. Results are saved permanently so you can always track what worked.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Tests', value: String(summary.totalTests), color: '#111827' },
            { label: 'Active Now', value: String(summary.activeTests), color: '#7c3aed' },
            { label: 'Win Rate', value: summary.winRate + '%', color: '#111827' },
            { label: 'Cumulative Lift', value: '+' + summary.cumulativeLift + '%', color: '#16a34a' },
          ].map((card, i) => (
            <div key={i} style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px 20px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {card.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: card.color, marginTop: 4 }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Best Change callout */}
      {summary?.bestChange && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>{'\uD83C\uDFC6'}</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Best performing change: </span>
            <span style={{ fontSize: 13, color: '#374151' }}>{summary.bestChange.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginLeft: 8 }}>
              +{summary.bestChange.lift?.toFixed(1)}% lift
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'RUNNING', label: 'Running' },
          { key: 'WINNER_FOUND', label: 'Winners' },
          { key: 'NO_DIFFERENCE', label: 'No Difference' },
          { key: 'PAUSED', label: 'Paused' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: filter === f.key ? '1px solid #7c3aed' : '1px solid #e5e7eb',
              background: filter === f.key ? '#ede9fe' : '#fff',
              color: filter === f.key ? '#7c3aed' : '#6b7280',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
          >
            {f.label}
            {f.key !== 'all' && (
              <span style={{ marginLeft: 4, opacity: 0.6 }}>
                {experiments.filter(e => e.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Experiment Cards */}
      {filtered.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#9ca3af', background: '#fff',
          borderRadius: 12, border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{'\uD83E\uDDEA'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No tests yet</div>
          <div style={{ fontSize: 13 }}>Start an A/B test on any addon to see results here.</div>
        </div>
      )}

      {filtered.map(exp => {
        const badge = STATUS_BADGE[exp.status] || { bg: '#f3f4f6', color: '#6b7280', label: exp.status };
        const isExpanded = expandedId === exp.id;
        const winnerVariant = exp.variants.find(v => v.id === exp.winnerVariantId);

        // Calculate observed lift from variant purchase rates
        const sortedByRate = [...exp.variants].sort((a, b) => {
          const rateA = a.stats.cartOpens > 0 ? a.stats.orders / a.stats.cartOpens * 100 : 0;
          const rateB = b.stats.cartOpens > 0 ? b.stats.orders / b.stats.cartOpens * 100 : 0;
          return rateB - rateA;
        });
        const topPurchaseRate = sortedByRate[0]?.stats.cartOpens > 0 ? (sortedByRate[0].stats.orders / sortedByRate[0].stats.cartOpens * 100) : 0;
        const runnerPurchaseRate = sortedByRate[1]?.stats.cartOpens > 0 ? (sortedByRate[1].stats.orders / sortedByRate[1].stats.cartOpens * 100) : 0;
        const observedLift = runnerPurchaseRate > 0 ? ((topPurchaseRate - runnerPurchaseRate) / runnerPurchaseRate * 100) : 0;

        return (
          <div
            key={exp.id}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 0,
              marginBottom: 10,
              border: isExpanded ? '1px solid #7c3aed' : '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
          >
            {/* Collapsed header */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : exp.id)}
              style={{
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              {/* Status dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: badge.color,
                boxShadow: exp.status === 'RUNNING' ? '0 0 0 3px ' + badge.bg : 'none',
              }} />

              {/* Name + slot */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{exp.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                  {new Date(exp.startedAt).toLocaleDateString()} {exp.endedAt ? '\u2192 ' + new Date(exp.endedAt).toLocaleDateString() : '\u2192 ongoing'}
                  {' \u00B7 '}{exp.durationDays}d{' \u00B7 '}{exp.totalVisitors} visitors
                </div>
              </div>

              {/* Lift */}
              {observedLift > 0 && exp.variants.length >= 2 && (
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: exp.status === 'WINNER_FOUND' ? '#16a34a' : '#7c3aed',
                }}>
                  +{observedLift.toFixed(0)}%
                </div>
              )}

              {/* Badge */}
              <span style={{
                padding: '3px 10px', borderRadius: 10, fontSize: 10, fontWeight: 600,
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

            {/* Expanded details */}
            {isExpanded && (
              <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f3f4f6' }}>
                {/* Variant comparison */}
                <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 14 }}>
                  {exp.variants.map(v => {
                    const isWinner = v.id === exp.winnerVariantId;
                    const purchaseRate = v.stats.cartOpens > 0 ? (v.stats.orders / v.stats.cartOpens * 100).toFixed(1) : '0.0';
                    return (
                      <div key={v.id} style={{
                        flex: 1,
                        padding: 12,
                        background: isWinner ? '#f0fdf4' : '#f9fafb',
                        borderRadius: 10,
                        border: isWinner ? '2px solid #86efac' : '1px solid #e5e7eb',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                            {v.label || v.name}
                          </span>
                          {isWinner && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 8 }}>
                              WINNER
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
                          <div>
                            <span style={{ color: '#9ca3af' }}>Cart Opens</span>
                            <div style={{ fontWeight: 600, color: '#374151' }}>{v.stats.cartOpens}</div>
                          </div>
                          <div>
                            <span style={{ color: '#9ca3af' }}>Checkouts</span>
                            <div style={{ fontWeight: 600, color: '#374151' }}>{v.stats.checkouts}</div>
                          </div>
                          <div>
                            <span style={{ color: '#9ca3af' }}>Orders</span>
                            <div style={{ fontWeight: 600, color: '#374151' }}>{v.stats.orders}</div>
                          </div>
                          <div>
                            <span style={{ color: '#9ca3af' }}>Purchase Rate</span>
                            <div style={{ fontWeight: 700, color: isWinner ? '#16a34a' : '#374151' }}>{purchaseRate}%</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Lift summary */}
                {observedLift > 0 && exp.variants.length >= 2 && (
                  <div style={{
                    padding: '10px 14px', background: exp.status === 'WINNER_FOUND' ? '#f0fdf4' : '#f5f3ff',
                    border: '1px solid ' + (exp.status === 'WINNER_FOUND' ? '#bbf7d0' : '#ddd6fe'),
                    borderRadius: 10, textAlign: 'center', marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: exp.status === 'WINNER_FOUND' ? '#16a34a' : '#7c3aed' }}>
                      +{observedLift.toFixed(0)}% purchase rate
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {(sortedByRate[0]?.label || sortedByRate[0]?.name || 'A')} converts at {topPurchaseRate.toFixed(1)}% vs {runnerPurchaseRate.toFixed(1)}%
                    </div>
                  </div>
                )}

                {/* Confidence */}
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                  <span>Confidence: <strong style={{ color: '#374151' }}>{exp.confidence}%</strong></span>
                  {exp.endedAt && <span>Ended: {new Date(exp.endedAt).toLocaleDateString()}</span>}
                </div>

                {/* Timeline Notes */}
                {exp.notes.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Timeline
                    </div>
                    {exp.notes.map((note, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 8, fontSize: 11, padding: '4px 0',
                        borderBottom: i < exp.notes.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}>
                        <span style={{ color: '#9ca3af', minWidth: 70, flexShrink: 0 }}>
                          {new Date(note.timestamp).toLocaleDateString()}
                        </span>
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
  );
}
