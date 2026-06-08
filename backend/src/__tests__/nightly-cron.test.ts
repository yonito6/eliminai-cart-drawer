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
 *   - LOCK-6: REVERTED transition when 48h rate drops onto a real cliff (>30% below baseline)
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
    experiment: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    store: { findUnique: vi.fn(), update: vi.fn() },
    event: { groupBy: vi.fn(), deleteMany: vi.fn() },
    dailySummary: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    variantAssignment: { count: vi.fn().mockResolvedValue(0) },
  },
}));

// Mock Thompson Sampling — deterministic results for tests
vi.mock('../lib/thompson', () => ({
  calculateThompsonSampling: vi.fn(),
  buildCrossStorePriors: vi.fn().mockReturnValue({}),
  calculateSampleTarget: vi.fn().mockReturnValue({ nPerVariant: 1980, totalNeeded: 3960, baselineRate: 0.03 }),
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
  expectedLoss: 0.05,
  liftPercent: 5,
  winnerCandidateId: 'treatment',
  dynamicLossThreshold: 0.05,
  trafficSplit: { control: 0.35, treatment: 0.65 },
  minOrdersPerVariant: 25,
  targetOrdersPerVariant: 30,
  orderRates: { control: 0.05, treatment: 0.06 },
};

// Helper: fabricate distinct DailySummary dates for timeline derivation.
function mockSummaryDates(isoDates: string[]) {
  (prisma.dailySummary.findMany as any).mockResolvedValue(
    isoDates.map((d) => ({ date: new Date(d + 'T00:00:00Z') })),
  );
}

// A 7-day window that covers a Saturday (2026-06-06) and Sunday (2026-06-07).
const WEEKEND_DATES = [
  '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04',
  '2026-06-05', '2026-06-06', '2026-06-07',
];

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

// Drives the cron's RUNNING query AND progressAutopilot's completed-names query from one mock.
function mockFindMany(running: any[], completedNames: { name: string }[] = []) {
  (prisma.experiment.findMany as any).mockImplementation((args: any) => {
    if (args?.select?.name) return Promise.resolve(completedNames); // progression: completed-names
    // cron's RUNNING query AND its cross-store priors query both fall through to `running` — harmless, mocked Thompson ignores priors.
    return Promise.resolve(running);
  });
}

describe('POST /api/cron/nightly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.CRON_SECRET = 'test-secret-123';

    (prisma.experiment.findMany as any).mockResolvedValue([MOCK_EXPERIMENT]);
    (prisma.experiment.update as any).mockResolvedValue(MOCK_EXPERIMENT);
    (prisma.experiment.create as any).mockResolvedValue({ id: 'expNew', startedAt: new Date() });
    (prisma.store.findUnique as any).mockResolvedValue({ id: 'store_1', config: {} });
    (prisma.store.update as any).mockResolvedValue({});
    (prisma.dailySummary.upsert as any).mockResolvedValue({});
    // Reset timeline derivation to "no summary rows" each test — clearAllMocks() clears
    // call history but NOT prior .mockResolvedValue, so CAP/WEEKEND dates would otherwise leak.
    (prisma.dailySummary.findMany as any).mockResolvedValue([]);
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
    // Strong + steady leader earns consistency credit → evidence floor slides to 15.
    const steadyExp = {
      ...MOCK_EXPERIMENT,
      notes: {
        dailyLeaders: [
          { date: '2026-06-04', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-05', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-06', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-07', leaderId: 'treatment', liftPct: 12 },
        ],
      },
    };
    (prisma.experiment.findMany as any).mockResolvedValue([steadyExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT,
      confidence: 0.99,
      expectedLoss: 0.01,
      liftPercent: 12.5,
      winnerCandidateId: 'treatment',
      dynamicLossThreshold: 0.05,
      targetOrdersPerVariant: 30,
      trafficSplit: { control: 0.1, treatment: 0.9 },
      orderRates: { control: 0.05, treatment: 0.09 },
    });
    mockEventGroupBy(200, 40, 16); // 16 orders/arm ≥ slid floor of 15
    mockSummaryDates(WEEKEND_DATES);
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

  // LOCK-3b: weekend coverage is irreducible — strong stats but weekdays-only → WAIT (RUNNING).
  it('LOCK-3b: stays RUNNING when weekend not yet covered, even with a strong winner', async () => {
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT, confidence: 0.99, expectedLoss: 0.01, liftPercent: 90,
      winnerCandidateId: 'treatment', dynamicLossThreshold: 0.05, targetOrdersPerVariant: 30,
      orderRates: { control: 0.05, treatment: 0.09 },
    });
    mockEventGroupBy(4000, 800, 40); // HIGH tier
    mockSummaryDates(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']); // Mon-Fri
    const POST = await getHandler();
    await POST(makeRequest('test-secret-123'));
    const update = (prisma.experiment.update as any).mock.calls[0][0];
    expect(update.data.status).toBe('RUNNING');
  });

  // LOCK-3c: brand-new experiment with empty DailySummary → runningDays 0, no weekend → WAIT.
  it('LOCK-3c: brand-new experiment with empty DailySummary stays RUNNING', async () => {
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT, confidence: 0.99, expectedLoss: 0.01, liftPercent: 90,
      winnerCandidateId: 'treatment', dynamicLossThreshold: 0.05, targetOrdersPerVariant: 30,
    });
    mockEventGroupBy(4000, 800, 40);
    (prisma.dailySummary.findMany as any).mockResolvedValue([]); // none yet
    const POST = await getHandler();
    await POST(makeRequest('test-secret-123'));
    const update = (prisma.experiment.update as any).mock.calls[0][0];
    expect(update.data.status).toBe('RUNNING');
  });

  // LOCK-3d: consistency credit slides the evidence floor to 15 → 16 loser orders wins.
  it('LOCK-3d: consistency credit lets a steady leader win at the 15-order floor', async () => {
    const steadyExp = {
      ...MOCK_EXPERIMENT,
      notes: {
        dailyLeaders: [
          { date: '2026-06-03', leaderId: 'treatment', liftPct: 11 },
          { date: '2026-06-04', leaderId: 'treatment', liftPct: 11 },
          { date: '2026-06-05', leaderId: 'treatment', liftPct: 11 },
          { date: '2026-06-06', leaderId: 'treatment', liftPct: 11 },
        ],
      },
    };
    (prisma.experiment.findMany as any).mockResolvedValue([steadyExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT, confidence: 0.99, expectedLoss: 0.01, liftPercent: 11,
      winnerCandidateId: 'treatment', dynamicLossThreshold: 0.05,
      targetOrdersPerVariant: 30, // base floor would block; credit slides it to 15
      orderRates: { control: 0.05, treatment: 0.09 },
    });
    mockEventGroupBy(200, 40, 16); // 16 loser orders ≥ 15 but < 30
    mockSummaryDates(WEEKEND_DATES);
    const POST = await getHandler();
    await POST(makeRequest('test-secret-123'));
    const update = (prisma.experiment.update as any).mock.calls[0][0];
    expect(update.data.status).toBe('WINNER_FOUND');
    expect(update.data.winnerVariantId).toBe('treatment');
  });

  // LOCK-6b: harm-revert fires independently — verdict would WAIT but a real cliff → REVERTED.
  it('LOCK-6b: harm-revert overrides a WAIT verdict when checkout cliffs', async () => {
    // No weekend dates + low confidence default → verdict WAIT; but 5/100 checkout is a cliff.
    mockEventGroupBy(100, 5, 2);
    mockSummaryDates([]); // no weekend → WAIT
    const POST = await getHandler();
    const res = await POST(makeRequest('test-secret-123'));
    const update = (prisma.experiment.update as any).mock.calls[0][0];
    expect(update.data.status).toBe('REVERTED');
    const json = await res.json();
    expect(json.experiments[0].status).toBe('REVERTED');
  });

  // LOCK-4: NO_DIFFERENCE when gates 1-4 pass but lift is below the practical floor
  it('LOCK-4: sets status to NO_DIFFERENCE when Thompson reports no meaningful difference', async () => {
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT,
      confidence: 0.96,
      expectedLoss: 0.01,
      liftPercent: 0.5,
      winnerCandidateId: 'treatment',
      dynamicLossThreshold: 0.05,
      targetOrdersPerVariant: 30,
      trafficSplit: { control: 0.52, treatment: 0.48 },
      orderRates: { control: 0.05, treatment: 0.0503 },
    });
    mockEventGroupBy(200, 40, 10); // non-zero loser orders → real lift gate
    mockSummaryDates(WEEKEND_DATES);
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

  // 15 distinct dates incl a Sat (06-06) and Sun (06-07) → runningDays at the 14-day cap.
  const CAP_DATES = [
    '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29',
    '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02', '2026-06-03',
    '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08',
  ];

  // LOCK-5: NO_DIFFERENCE backstop when the cap is reached with no clear winner (HIGH/MED)
  it('LOCK-5: sets NO_DIFFERENCE when maxDays cap reached and confidence<0.95', async () => {
    const expiredExp = {
      ...MOCK_EXPERIMENT,
      startedAt: new Date(Date.now() - 15 * 86400000),
      maxDays: 14,
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expiredExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT,
      confidence: 0.70,
      expectedLoss: 0.05,
      liftPercent: 8,
      winnerCandidateId: null,
      dynamicLossThreshold: 0.05,
      targetOrdersPerVariant: 30,
      trafficSplit: { control: 0.45, treatment: 0.55 },
    });
    mockEventGroupBy(4000, 800, 40); // HIGH tier
    mockSummaryDates(CAP_DATES);
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

  // LOCK-5c: LOW tier at the cap with no winner → persisted as NO_DIFFERENCE + inconclusive flag.
  it('LOCK-5c: LOW tier at cap with no winner persists NO_DIFFERENCE and inconclusive=true', async () => {
    const expiredExp = {
      ...MOCK_EXPERIMENT,
      startedAt: new Date(Date.now() - 15 * 86400000),
      maxDays: 14,
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expiredExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT,
      confidence: 0.70,
      expectedLoss: 0.05,
      liftPercent: 8,
      winnerCandidateId: null,
      dynamicLossThreshold: 0.05,
      targetOrdersPerVariant: 30,
      trafficSplit: { control: 0.45, treatment: 0.55 },
    });
    mockEventGroupBy(200, 30, 5); // LOW tier (~28/day)
    mockSummaryDates(CAP_DATES);
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    const update = (prisma.experiment.update as any).mock.calls[0][0];
    expect(update.data.status).toBe('NO_DIFFERENCE');
    expect(update.data.notes.inconclusive).toBe(true);
  });

  // INCONCLUSIVE (LOW tier at cap) persists NO_DIFFERENCE + inconclusive and reaches the
  // terminal autopilot branch (carries current config forward — no winner is force-applied).
  it('INCONCLUSIVE (LOW tier at cap) persists NO_DIFFERENCE + inconclusive flag and progresses autopilot', async () => {
    const autopilotConfig = {
      autopilot: {
        enabled: true,
        currentTestSlot: 'trustBadges:enabled',
        queue: ['trustBadges:enabled', 'scarcityTimer:enabled'],
        completedCount: 0, totalLift: 0, startedAt: '2026-05-01T00:00:00.000Z',
      },
      addons: { trustBadges: { config: { text: 'old' } } },
    };
    const inconclusiveExp = {
      ...MOCK_EXPERIMENT,
      slot: 'trustBadges',
      startedAt: new Date(Date.now() - 15 * 86400000),
      maxDays: 14,
      store: { ...MOCK_STORE, config: autopilotConfig },
      variants: [
        { id: 'control', features: { _enabled: false } },
        { id: 'treatment', features: { _enabled: true } },
      ],
    };
    mockFindMany([inconclusiveExp], []);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT, confidence: 0.70, expectedLoss: 0.05, liftPercent: 3,
      winnerCandidateId: null, dynamicLossThreshold: 0.15, targetOrdersPerVariant: 30,
      orderRates: { control: 0.02, treatment: 0.021 },
    });
    mockEventGroupBy(200, 30, 5); // LOW tier (~28/day)
    mockSummaryDates(CAP_DATES);
    (prisma.store.findUnique as any).mockResolvedValue({ id: 'store_1', config: autopilotConfig });

    const POST = await getHandler();
    await POST(makeRequest('test-secret-123'));
    const update = (prisma.experiment.update as any).mock.calls[0][0];
    expect(update.data.status).toBe('NO_DIFFERENCE');
    expect(update.data.notes.inconclusive).toBe(true);
    // Terminal non-winner still advances the autopilot queue.
    expect(prisma.store.update).toHaveBeenCalled();
  });

  // LOCK-5b: If maxDays exceeded BUT confidence >= 0.95, WINNER_FOUND takes priority
  it('LOCK-5b: WINNER_FOUND takes priority over maxDays expiry when confidence>=0.95', async () => {
    const expiredExp = {
      ...MOCK_EXPERIMENT,
      startedAt: new Date(Date.now() - 15 * 86400000),
      maxDays: 14,
      notes: {
        dailyLeaders: [
          { date: '2026-06-04', leaderId: 'treatment', liftPct: 10 },
          { date: '2026-06-05', leaderId: 'treatment', liftPct: 10 },
          { date: '2026-06-06', leaderId: 'treatment', liftPct: 10 },
          { date: '2026-06-07', leaderId: 'treatment', liftPct: 10 },
        ],
      },
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expiredExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT,
      confidence: 0.99,
      expectedLoss: 0.01,
      liftPercent: 10,
      winnerCandidateId: 'treatment',
      dynamicLossThreshold: 0.05,
      targetOrdersPerVariant: 30,
      trafficSplit: { control: 0.1, treatment: 0.9 },
      orderRates: { control: 0.05, treatment: 0.09 },
    });
    mockEventGroupBy(200, 40, 16);
    mockSummaryDates(CAP_DATES);
    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WINNER_FOUND' }),
      })
    );
  });

  // LOCK-6: REVERTED when 48h checkout rate collapses onto a real cliff
  it('LOCK-6: sets REVERTED when recent checkout rate drops onto a real cliff below baseline', async () => {
    // baseline = 0.20, recent = 5/100 = 0.05 → below the cliff floor 0.20*0.70=0.14, 100>=50
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

  // LOCK-8b: DailySummary date is stored at UTC midnight (weekend-gate contract).
  // The @db.Date column is read back via getUTCDay() by the weekend gate, so the
  // written boundary MUST be UTC midnight or the recovered weekday is off-by-one on
  // any non-UTC server, corrupting hasSaturday/hasSunday.
  it('LOCK-8b: DailySummary date is stored at UTC midnight (weekend-gate contract)', async () => {
    const POST = await getHandler();
    await POST(makeRequest('test-secret-123'));
    const dateUsed: Date = (prisma.dailySummary.upsert as any).mock.calls[0][0].where.experimentId_variantId_date.date;
    expect(dateUsed.getUTCHours()).toBe(0);
    expect(dateUsed.getUTCMinutes()).toBe(0);
    expect(dateUsed.getUTCSeconds()).toBe(0);
    expect(dateUsed.getUTCMilliseconds()).toBe(0);
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

  // LOCK-11c: Safety check skipped when sample is below MIN_SESSIONS_FOR_SAFETY (50)
  it('LOCK-11c: skips revert when recent opens are below the minimum sample (insufficient data)', async () => {
    mockEventGroupBy(10, 0, 0);

    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    await POST(req);

    // Should NOT revert because insufficient data (< 50 opens)
    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING' }),
      })
    );
  });

  // LOCK-11d: REGRESSION — noisy-but-healthy 48h rate must NOT false-revert.
  // This is the bug that repeatedly killed the express experiment: baseline ~0.9725
  // and a normal 48h rate of ~0.83 used to fall under the old baseline*0.95 floor
  // and revert. With the cliff-only breaker (baseline*0.70) it stays RUNNING.
  it('LOCK-11d: does NOT revert on normal session-rate noise (false-positive regression)', async () => {
    const expHighBaseline = {
      ...MOCK_EXPERIMENT,
      store: { ...MOCK_STORE, baselineCheckoutRate: 0.9725 },
    };
    (prisma.experiment.findMany as any).mockResolvedValue([expHighBaseline]);
    // 400 opens, 332 checkouts → 0.83 (healthy noise, well above the 0.68 cliff floor)
    mockEventGroupBy(400, 332, 100);

    const POST = await getHandler();
    const req = makeRequest('test-secret-123');
    const res = await POST(req);

    expect(prisma.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING' }),
      })
    );
    const json = await res.json();
    expect(json.experiments[0].status).not.toBe('REVERTED');
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

  it('LOCK: store without autopilot still verdicts, no progression', async () => {
    const steadyExp = {
      ...MOCK_EXPERIMENT,
      notes: {
        dailyLeaders: [
          { date: '2026-06-04', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-05', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-06', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-07', leaderId: 'treatment', liftPct: 12 },
        ],
      },
    };
    (prisma.experiment.findMany as any).mockResolvedValue([steadyExp]);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT,
      confidence: 0.99, expectedLoss: 0.01, liftPercent: 12,
      winnerCandidateId: 'treatment', dynamicLossThreshold: 0.05, targetOrdersPerVariant: 30,
      trafficSplit: { control: 0.1, treatment: 0.9 },
      orderRates: { control: 0.05, treatment: 0.09 },
    });
    mockEventGroupBy(200, 40, 16);
    mockSummaryDates(WEEKEND_DATES);
    // MOCK_STORE (default) has no `config` → autopilot gate is falsy.
    const POST = await getHandler();
    const res = await POST(makeRequest('test-secret-123'));
    expect(res.status).toBe(200);
    expect(prisma.experiment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'WINNER_FOUND' }),
    }));
    expect(prisma.experiment.create).not.toHaveBeenCalled();
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it('auto-progression: autopilot store applies winner + starts the next queued test', async () => {
    const autopilotConfig = {
      autopilot: {
        enabled: true,
        currentTestSlot: 'trustBadges:enabled',
        queue: ['trustBadges:enabled', 'scarcityTimer:enabled'],
        completedCount: 0, totalLift: 0, startedAt: '2026-06-01T00:00:00.000Z',
      },
      addons: { trustBadges: { config: { text: 'old' } } },
    };
    const autopilotExp = {
      ...MOCK_EXPERIMENT,
      slot: 'trustBadges',
      store: { ...MOCK_STORE, config: autopilotConfig },
      variants: [
        { id: 'control', features: { _enabled: false } },
        { id: 'treatment', features: { _enabled: true } },
      ],
      notes: {
        dailyLeaders: [
          { date: '2026-06-04', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-05', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-06', leaderId: 'treatment', liftPct: 12 },
          { date: '2026-06-07', leaderId: 'treatment', liftPct: 12 },
        ],
      },
    };
    mockFindMany([autopilotExp], []);
    (calculateThompsonSampling as any).mockReturnValue({
      ...DEFAULT_TS_RESULT,
      confidence: 0.99, expectedLoss: 0.01, liftPercent: 12,
      winnerCandidateId: 'treatment', dynamicLossThreshold: 0.05, targetOrdersPerVariant: 30,
      trafficSplit: { control: 0.1, treatment: 0.9 },
      orderRates: { control: 0.05, treatment: 0.09 },
    });
    mockEventGroupBy(200, 40, 16);
    mockSummaryDates(WEEKEND_DATES);
    (prisma.store.findUnique as any).mockResolvedValue({ id: 'store_1', config: autopilotConfig });
    (prisma.experiment.create as any).mockResolvedValue({ id: 'expNew', startedAt: new Date() });

    const POST = await getHandler();
    const res = await POST(makeRequest('test-secret-123'));
    expect(res.status).toBe(200);
    expect(prisma.experiment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'exp_1' },
      data: expect.objectContaining({ status: 'WINNER_FOUND' }),
    }));
    expect(prisma.experiment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slot: 'scarcityTimer', status: 'RUNNING' }),
    }));
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'store_1' },
      data: expect.objectContaining({
        config: expect.objectContaining({
          autopilot: expect.objectContaining({ currentTestSlot: 'scarcityTimer:enabled', completedCount: 1 }),
        }),
      }),
    }));
  });
});
