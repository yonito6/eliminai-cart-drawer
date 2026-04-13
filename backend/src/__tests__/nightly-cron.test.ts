/**
 * BLAST RADIUS MAP — POST /api/cron/nightly (new endpoint)
 * Target: backend/src/app/api/cron/nightly/route.ts (new file)
 *
 * CALLERS: Railway cron scheduler (external) — no internal callers
 *
 * SHARED STATE WRITTEN:
 *   - experiment.status       → read by variant-assign.ts (status: 'RUNNING' filter)
 *   - experiment.trafficSplit → read by variant-assign.ts (pickVariant)
 *   - experiment.confidence, liftPercent, winnerVariantId, endedAt → dashboard reads
 *   - DailySummary rows       → aggregated metrics for dashboard
 *   - Event rows (pruned)     → older than 30 days deleted
 *
 * CROSS-PATH RISK:
 *   - variant-assign.ts only queries status:'RUNNING' — setting WINNER_FOUND/REVERTED
 *     correctly stops new assignments (desired behavior, confirmed by reading variant-assign.ts)
 *   - DailySummary @@unique([experimentId, variantId, date]) — upsert key must match exactly
 *   - trafficSplit shape must remain Record<string, number> for pickVariant compatibility
 *
 * LOCK TESTS (behavior that must never regress):
 *   - LOCK-1: Missing/wrong CRON_SECRET → 401
 *   - LOCK-2: Correct Bearer token → accepted (200)
 *   - LOCK-3: WINNER_FOUND transition when confidence >= 0.95 AND lift > 1%
 *   - LOCK-4: NO_DIFFERENCE transition when confidence >= 0.95 AND lift <= 1%
 *   - LOCK-5: NO_DIFFERENCE transition when maxDays exceeded AND confidence < 0.80
 *   - LOCK-6: REVERTED transition when 48h rate drops >5% below baseline
 *   - LOCK-7: Status stays RUNNING when confidence < 0.95 and not expired
 *   - LOCK-8: DailySummary upsert called for each variant with yesterday's date
 *   - LOCK-9: Events older than 30 days are pruned
 *   - LOCK-10: trafficSplit and confidence written back to experiment
 *   - LOCK-11: Safety check skipped if baselineCheckoutRate is null/zero
 *   - LOCK-12: Response includes per-experiment results + aggregated count + pruned count
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    experiment: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    event: {
      groupBy: vi.fn(),
      deleteMany: vi.fn(),
    },
    dailySummary: {
      upsert: vi.fn(),
    },
  },
}));

// Mock Thompson Sampling — deterministic results for tests
vi.mock('../lib/thompson', () => ({
  calculateThompsonSampling: vi.fn(),
  buildCrossStorePriors: vi.fn().mockReturnValue({}),
  calculateSampleTarget: vi.fn().mockReturnValue({ nPerVariant: 1980, totalNeeded: 3960, baselineRate: 0.03 }),
  calculateConsistency: vi.fn().mockReturnValue({ score: 1, multiplier: 1.0, message: null }),
}));

import { prisma } from '../lib/prisma';
import { calculateThompsonSampling } from '../lib/thompson';

const getHandler = async () => {
  const mod = await import('../app/api/cron/nightly/route');
  return mod.POST;
};

function makeRequest(secret?: string): NextRequest {
  const url = new URL('https://eliminai.ai/api/cron/nightly');
  return new NextRequest(url.toString(), {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

// Shared experiment fixture
const MOCK_STORE = {
  id: 'store_1',
  shopDomain: 'test.myshopify.com',
  currency: 'USD',
  baselineCheckoutRate: 0.20,
};

const MOCK_EXPERIMENT = {
  id: 'exp_1',
  storeId: 'store_1',
  store: MOCK_STORE,
  variants: [
    { id: 'control' },
    { id: 'treatment' },
  ],
  startedAt: new Date(Date.now() - 5 * 86400000), // 5 days ago
  maxDays: 14,
  status: 'RUNNING',
  winnerVariantId: null,
  endedAt: null,
  confidence: 0,
  liftPercent: 0,
  trafficSplit: { control: 0.5, treatment: 0.5 },
};

// Default Thompson result (not yet conclusive)
const DEFAULT_TS_RESULT = {
  confidence: 0.80,
  liftPercent: 5,
  winnerId: null,
  trafficSplit: { control: 0.35, treatment: 0.65 },
  minOrdersPerVariant: 25,
  orderRates: { control: 0.05, treatment: 0.06 },
};

// Helper: mock groupBy to return arrays of { sessionId } with given lengths
function mockEventGroupBy(cartOpens: number, checkoutClicks: number, orders: number = 0) {
  const makeSessions = (n: number) => Array.from({ length: n }, (_, i) => ({ sessionId: `s${i}` }));
  (prisma.event.groupBy as any).mockImplementation(({ where }: any) => {
    const eventType = where?.eventType;
    if (eventType === 'CART_OPENED') return Promise.resolve(makeSessions(cartOpens));
    if (eventType === 'CHECKOUT_CLICKED') return Promise.resolve(makeSessions(checkoutClicks));
    if (eventType === 'ORDER_COMPLETED') return Promise.resolve(makeSessions(orders));
    return Promise.resolve([]);
  });
}

describe('POST /api/cron/nightly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.CRON_SECRET = 'test-secret-123';

    (prisma.experiment.findMany as any).mockResolvedValue([MOCK_EXPERIMENT]);
    (prisma.experiment.update as any).mockResolvedValue(MOCK_EXPERIMENT);
    (prisma.dailySummary.upsert as any).mockResolvedValue({});
    (prisma.event.deleteMany as any).mockResolvedValue({ count: 42 });
    (calculateThompsonSampling as any).mockReturnValue(DEFAULT_TS_RESULT);

    // Default event counts: 100 opens, 20 clicks, 5 orders
    mockEventGroupBy(100, 20, 5);
  });

  // LOCK-1: Wrong secret → 401
  it('LOCK-1: returns 401 when authorization header is missing', async () => {
    const POST = await getHandler();
    const req = makeRequest(undefined);
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(prisma.experiment.findMany).not.toHaveBeenCalled();
  });

  it('LOCK-1b: returns 401 when CRON_SECRET is wrong', async () => {
    const POST = await getHandler();
    const req = makeRequest('wrong-secret');
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(prisma.experiment.findMany).not.toHaveBeenCalled();
  });

  // LOCK-2: Correct secret → 200
  it('LOCK-2: returns 200 with correct CRON_SECRET', async () => {
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  // LOCK-3: WINNER_FOUND when confidence >= 0.95 AND lift > 1%
  it('LOCK-3: sets status to WINNER_FOUND when confidence>=0.95 and lift>1%', async () => {
    (calculateThompsonSampling as any).mockReturnValue({
      confidence: 0.97,
      liftPercent: 12.5,
      winnerId: 'treatment',
      trafficSplit: { control: 0.1, treatment: 0.9 },
    });
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp_1' },
        data: expect.objectContaining({
          status: 'WINNER_FOUND',
          winnerVariantId: 'treatment',
          endedAt: expect.any(Date),
        }),
      })
    );

    const json = await res.json();
    expect(json.experiments[0].status).toBe('WINNER_FOUND');
  });

  // LOCK-4: NO_DIFFERENCE when Thompson reports no meaningful difference
  it('LOCK-4: sets status to NO_DIFFERENCE when Thompson reports no meaningful difference', async () => {
    (calculateThompsonSampling as any).mockReturnValue({
      confidence: 0.96,
      liftPercent: 0.5,
      winnerId: null,
      reason: 'No meaningful difference (lift 0.5% with 96.0% confidence)',
      trafficSplit: { control: 0.52, treatment: 0.48 },
    });
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NO_DIFFERENCE',
          endedAt: expect.any(Date),
        }),
      })
    );

    const json = await res.json();
    expect(json.experiments[0].status).toBe('NO_DIFFERENCE');
  });

  // LOCK-5: NO_DIFFERENCE when maxDays exceeded and confidence < 0.80
  it('LOCK-5: sets NO_DIFFERENCE when maxDays exceeded and confidence<0.80', async () => {
    const expiredExp = {
      ...MOCK_EXPERIMENT,
      startedAt: new Date(Date.now() - 15 * 86400000), // 15 days ago, maxDays=14
      maxDays: 14,
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expiredExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      confidence: 0.70,
      liftPercent: 8,
      winnerId: null,
      trafficSplit: { control: 0.45, treatment: 0.55 },
    });
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NO_DIFFERENCE',
          endedAt: expect.any(Date),
        }),
      })
    );
  });

  // LOCK-5b: If maxDays exceeded BUT confidence >= 0.95, WINNER_FOUND takes priority
  it('LOCK-5b: WINNER_FOUND takes priority over maxDays expiry when confidence>=0.95', async () => {
    const expiredExp = {
      ...MOCK_EXPERIMENT,
      startedAt: new Date(Date.now() - 15 * 86400000),
      maxDays: 14,
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expiredExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      confidence: 0.97,
      liftPercent: 10,
      winnerId: 'treatment',
      trafficSplit: { control: 0.1, treatment: 0.9 },
    });
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WINNER_FOUND' }),
      })
    );
  });

  // LOCK-6: REVERTED when 48h checkout rate drops >5% below baseline
  it('LOCK-6: sets REVERTED when recent checkout rate drops more than 5% below baseline', async () => {
    // baseline = 0.20, recent = 5/100 = 0.05 → way below 0.20*0.95=0.19
    mockEventGroupBy(100, 5, 2);
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REVERTED',
          endedAt: expect.any(Date),
        }),
      })
    );

    const json = await res.json();
    expect(json.experiments[0].status).toBe('REVERTED');
  });

  // LOCK-7: Status stays RUNNING when confidence < 0.95 and not expired
  it('LOCK-7: status stays RUNNING when confidence<0.95 and not expired', async () => {
    // DEFAULT_TS_RESULT has confidence=0.80, no expiry
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING' }),
      })
    );

    const json = await res.json();
    expect(json.experiments[0].status).toBe('RUNNING');
  });

  // LOCK-8: DailySummary upsert called for each variant
  it('LOCK-8: upserts DailySummary for each variant with yesterday date', async () => {
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    // 2 variants → 2 upsert calls
    expect(prisma.dailySummary.upsert).toHaveBeenCalledTimes(2);

    const calls = (prisma.dailySummary.upsert as any).mock.calls;
    const variantIds = calls.map((c: any) => c[0].where.experimentId_variantId_date.variantId);
    expect(variantIds).toContain('control');
    expect(variantIds).toContain('treatment');

    // date should be yesterday (not today)
    const firstCall = calls[0][0];
    const dateUsed: Date = firstCall.where.experimentId_variantId_date.date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(dateUsed.getTime()).toBeLessThan(today.getTime());

    // create data must include required fields
    const createData = firstCall.create;
    expect(createData).toMatchObject({
      storeId: 'store_1',
      experimentId: 'exp_1',
      currency: 'USD',
    });
    expect(typeof createData.cartOpens).toBe('number');
    expect(typeof createData.checkoutClicks).toBe('number');
  });

  // LOCK-9: Events older than 30 days pruned
  it('LOCK-9: prunes events older than 30 days', async () => {
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);

    expect(prisma.event.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      })
    );

    // Verify the cutoff date is approximately 30 days ago
    const callArgs = (prisma.event.deleteMany as any).mock.calls[0][0];
    const cutoff: Date = callArgs.where.createdAt.lt;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    // Allow 10 second tolerance
    expect(Math.abs(cutoff.getTime() - thirtyDaysAgo)).toBeLessThan(10000);

    const json = await res.json();
    expect(json.pruned).toBe(42);
  });

  // LOCK-10: confidence and trafficSplit written back to experiment
  it('LOCK-10: writes confidence and trafficSplit from Thompson result back to experiment', async () => {
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confidence: DEFAULT_TS_RESULT.confidence,
          liftPercent: DEFAULT_TS_RESULT.liftPercent,
          trafficSplit: DEFAULT_TS_RESULT.trafficSplit,
        }),
      })
    );
  });

  // LOCK-11: Safety check skipped when baselineCheckoutRate is null
  it('LOCK-11: skips safety revert check when store has no baselineCheckoutRate', async () => {
    const expNoBaseline = {
      ...MOCK_EXPERIMENT,
      store: { ...MOCK_STORE, baselineCheckoutRate: null },
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expNoBaseline]);
    // Even with very low checkout counts, should NOT revert
    mockEventGroupBy(0, 0, 0);

    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING' }),
      })
    );
  });

  it('LOCK-11b: skips safety revert check when baselineCheckoutRate is 0', async () => {
    const expZeroBaseline = {
      ...MOCK_EXPERIMENT,
      store: { ...MOCK_STORE, baselineCheckoutRate: 0 },
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expZeroBaseline]);
    mockEventGroupBy(0, 0, 0);

    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING' }),
      })
    );
  });

  // LOCK-11c: Safety check skipped when recentOpens <= 20 (not enough data)
  it('LOCK-11c: skips revert when recent opens are <= 20 (insufficient data)', async () => {
    mockEventGroupBy(10, 0, 0);

    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    // Should NOT revert because insufficient data (<=20 opens)
    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING' }),
      })
    );
  });

  // LOCK-12: Response shape
  it('LOCK-12: response includes experiments array, aggregated count, and pruned count', async () => {
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);
    const json = await res.json();

    expect(Array.isArray(json.experiments)).toBe(true);
    expect(json.experiments[0]).toMatchObject({
      experimentId: 'exp_1',
      store: 'test.myshopify.com',
      confidence: expect.any(Number),
      liftPercent: expect.any(Number),
      status: expect.any(String),
    });
    expect(typeof json.aggregated).toBe('number');
    expect(typeof json.pruned).toBe('number');
  });

  // LOCK-13: No experiments → returns empty results without errors
  it('LOCK-13: handles zero RUNNING experiments gracefully', async () => {
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.experiments).toHaveLength(0);
    expect(json.aggregated).toBe(0);
    expect(prisma.experiment.update).not.toHaveBeenCalled();
    expect(prisma.dailySummary.upsert).not.toHaveBeenCalled();
    // Pruning still happens even with no experiments
    expect(prisma.event.deleteMany).toHaveBeenCalledTimes(1);
  });
});
