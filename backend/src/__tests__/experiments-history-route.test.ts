/**
 * BLAST RADIUS MAP — test-history endpoint (read-only, additive)
 * Target: GET /api/stores/[id]/addons/experiments/history  (NEW)
 *
 * CALLERS: dashboard page.tsx "See previous tests" view (new).
 * DUPLICATED LOGIC: none — separate from the heavy /addons/experiments GET,
 *   which is intentionally left untouched (lower blast radius on the hot path).
 * SHARED STATE: none written. Pure read of prisma.experiment rows.
 * CROSS-PATH RISK: none — display-only history list; no status writes, no guards,
 *   no autopilot/cron interaction.
 *
 * BEHAVIOR LOCKED:
 *  - groups every experiment for the store by slot, newest first
 *  - includes finished tests (WINNER_FOUND / NO_DIFFERENCE) AND paused/reverted
 *  - derives winnerLabel from variants[].label via winnerVariantId
 *  - exposes totalVisitors from the _count.assignments include
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    experiment: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/stores/[id]/addons/experiments/history/route';

const params = { params: { id: 'store1' } };
const makeReq = () => ({} as any);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET addons/experiments/history', () => {
  it('groups experiments by slot, newest first, with winnerLabel + totalVisitors', async () => {
    (prisma.experiment.findMany as any).mockResolvedValue([
      {
        id: 'e2', name: 'Trust Badges — Layout A vs B', slot: 'trustBadges',
        status: 'WINNER_FOUND', confidence: 0.94, liftPercent: 12.5,
        winnerVariantId: 'vB', variants: [{ id: 'vA', label: 'Layout A' }, { id: 'vB', label: 'Layout B' }],
        startedAt: new Date('2026-05-20'), endedAt: new Date('2026-05-28'),
        _count: { assignments: 420 },
      },
      {
        id: 'e1', name: 'Trust Badges — On vs Off', slot: 'trustBadges',
        status: 'NO_DIFFERENCE', confidence: 0.91, liftPercent: 0.4,
        winnerVariantId: null, variants: [{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }],
        startedAt: new Date('2026-05-01'), endedAt: new Date('2026-05-10'),
        _count: { assignments: 300 },
      },
      {
        id: 'e3', name: 'Express — On vs Off', slot: 'expressPayments',
        status: 'WINNER_FOUND', confidence: 0.97, liftPercent: 8.0,
        winnerVariantId: 'on', variants: [{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }],
        startedAt: new Date('2026-04-15'), endedAt: new Date('2026-04-22'),
        _count: { assignments: 500 },
      },
    ]);

    const res = await GET(makeReq(), params);
    const json = await res.json();

    // grouped by slot
    expect(Object.keys(json.history).sort()).toEqual(['expressPayments', 'trustBadges']);
    expect(json.history.trustBadges).toHaveLength(2);
    expect(json.history.expressPayments).toHaveLength(1);

    // newest first within slot (e2 started 05-20, e1 started 05-01)
    expect(json.history.trustBadges[0].id).toBe('e2');
    expect(json.history.trustBadges[1].id).toBe('e1');

    // winnerLabel derived from variants
    expect(json.history.trustBadges[0].winnerLabel).toBe('Layout B');
    // no winner (NO_DIFFERENCE) → null label
    expect(json.history.trustBadges[1].winnerLabel).toBeNull();

    // totalVisitors surfaced from _count
    expect(json.history.trustBadges[0].totalVisitors).toBe(420);

    // summary fields present, heavy variantStats NOT computed
    expect(json.history.trustBadges[0]).toMatchObject({
      name: 'Trust Badges — Layout A vs B',
      status: 'WINNER_FOUND',
      confidence: 0.94,
      liftPercent: 12.5,
    });
    expect(json.history.trustBadges[0].variantStats).toBeUndefined();
  });

  it('scopes query to the store and orders by startedAt desc', async () => {
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    const res = await GET(makeReq(), params);
    const json = await res.json();
    expect(json.history).toEqual({});

    const arg = (prisma.experiment.findMany as any).mock.calls[0][0];
    expect(arg.where.storeId).toBe('store1');
    expect(arg.orderBy).toEqual({ startedAt: 'desc' });
  });

  it('returns empty history when no experiments exist', async () => {
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    const res = await GET(makeReq(), params);
    const json = await res.json();
    expect(json.history).toEqual({});
  });
});
