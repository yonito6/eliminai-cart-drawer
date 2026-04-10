'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useStore } from '@/lib/hooks/use-store';

interface VariantStat {
  id: string;
  name: string;
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

const STATUS_COLORS: Record<string, string> = {
  RUNNING: '#3b82f6',
  WINNER_FOUND: '#22c55e',
  NO_DIFFERENCE: '#a3a3a3',
  REVERTED: '#ef4444',
  PAUSED: '#f59e0b',
  INVALIDATED: '#ef4444',
};

const NOTE_ICONS: Record<string, string> = {
  started: '\u25B6',
  winner_found: '\u2713',
  winner_applied: '\u2713\u2713',
  paused: '\u23F8',
  resumed: '\u25B6',
  settings_changed: '\u26A0',
  invalidated: '\u2718',
  user_event: '\uD83D\uDCDD',
  external_event: '\uD83D\uDED2',
  traffic_anomaly: '\u26A0',
  conversion_shift: '\u26A0',
  segment_drift: '\u26A0',
};

export default function ResultsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#a3a3a3' }}>Loading results...</div>}>
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

  if (storeLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading store...</div>;
  if (storeError || !storeId) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Store not found.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading results...</div>;

  const filtered = filter === 'all' ? experiments : experiments.filter(e => e.status === filter);

  return (
    <div style={{ display: 'flex', gap: 24, padding: 24, minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      {/* Timeline Feed — 65% */}
      <div style={{ flex: '0 0 65%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Test Results</h1>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['all', 'RUNNING', 'WINNER_FOUND', 'NO_DIFFERENCE', 'PAUSED', 'REVERTED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: filter === f ? '#3b82f6' : '#262626',
                color: filter === f ? '#fff' : '#a3a3a3',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Experiment Cards */}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#737373' }}>
            No experiments found. Start testing to see results here.
          </div>
        )}

        {filtered.map(exp => (
          <div
            key={exp.id}
            style={{
              background: '#171717',
              borderRadius: 12,
              padding: 20,
              marginBottom: 12,
              border: `1px solid ${expandedId === exp.id ? '#3b82f6' : '#262626'}`,
              cursor: 'pointer',
            }}
            onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{exp.name}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#737373' }}>{exp.slot}</span>
              </div>
              <span style={{
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                background: STATUS_COLORS[exp.status] || '#404040',
                color: '#fff',
              }}>
                {exp.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#a3a3a3', marginBottom: 8 }}>
              <span>{new Date(exp.startedAt).toLocaleDateString()} — {exp.endedAt ? new Date(exp.endedAt).toLocaleDateString() : 'ongoing'}</span>
              <span>{exp.durationDays}d</span>
              <span>{exp.totalVisitors} visitors</span>
              {exp.confidence > 0.5 && <span>{Math.round(Math.max(0, (exp.confidence - 0.5) / 0.5) * 100)}% confidence</span>}
              {exp.liftPercent !== null && (
                <span style={{ color: exp.liftPercent > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {exp.liftPercent > 0 ? '+' : ''}{exp.liftPercent.toFixed(1)}% lift
                </span>
              )}
            </div>

            {/* Expanded: Variants + Timeline */}
            {expandedId === exp.id && (
              <div style={{ marginTop: 16 }}>
                {/* Variant Stats */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  {exp.variants.map(v => (
                    <div key={v.id} style={{
                      flex: 1,
                      padding: 12,
                      background: '#0a0a0a',
                      borderRadius: 8,
                      border: v.id === exp.winnerVariantId ? '2px solid #22c55e' : '1px solid #262626',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                        {v.name} {v.id === exp.winnerVariantId && <span style={{ color: '#22c55e' }}>WINNER</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#a3a3a3' }}>
                        <div>Cart Opens: {v.stats.cartOpens}</div>
                        <div>Checkouts: {v.stats.checkouts}</div>
                        <div>Rate: {v.stats.checkoutRate}%</div>
                        <div>Orders: {v.stats.orders}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline Notes */}
                {exp.notes.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#a3a3a3' }}>Test Timeline</div>
                    {exp.notes.map((note, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4, color: '#a3a3a3' }}>
                        <span style={{ minWidth: 80 }}>{new Date(note.timestamp).toLocaleDateString()}</span>
                        <span>{NOTE_ICONS[note.type] || '\u2022'}</span>
                        <span>{note.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Sidebar — 35% */}
      <div style={{ flex: '0 0 calc(35% - 24px)' }}>
        <div style={{ background: '#171717', borderRadius: 12, padding: 20, position: 'sticky', top: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Summary</h2>

          {summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#737373' }}>Total Tests</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.totalTests}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#737373' }}>Active Tests</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{summary.activeTests}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#737373' }}>Win Rate</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.winRate}%</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#737373' }}>Cumulative Lift</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>+{summary.cumulativeLift}%</div>
              </div>
              {summary.bestChange && (
                <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: '#737373', marginBottom: 4 }}>Best Change</div>
                  <div style={{ fontWeight: 600 }}>{summary.bestChange.name}</div>
                  <div style={{ color: '#22c55e', fontWeight: 600 }}>+{summary.bestChange.lift?.toFixed(1)}% lift</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
