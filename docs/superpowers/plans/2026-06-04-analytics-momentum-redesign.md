# Analytics Momentum Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic Analytics page with a motivation-first "momentum dashboard" that shows concrete incremental value (extra revenue/orders/AOV/conversion vs. the old cart), a conversion trend graph, the autopilot's next-moves roadmap, and 5 research-backed suggestion cards — plus fix the `baselineCheckoutRate > 1` root bug.

**Architecture:** Heavy math lives in three new pure, DB-free libs (`cro-conversion.ts`, `cro-value.ts`, `cro-suggestions.ts`) that are unit-tested in isolation. The existing `GET /api/stores/[id]/cro` route is extended to assemble these + the real autopilot queue into one payload. `analytics/page.tsx` is rewritten as a presentational consumer (frontend-design skill). The `baselineCheckoutRate` bug is fixed at its true write site (`proxy/event/route.ts`) with blast-radius locks on the nightly-cron consumer.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma, Vitest (`cd backend && npm test` → `vitest run`, `@` → `./src`). React client component with inline-SVG chart (no new chart dependency).

**Spec:** `docs/superpowers/specs/2026-06-04-analytics-momentum-redesign-design.md`

**Project rules (read before starting):**
- Two v14 storefront copies must stay byte-identical — NOT touched in this plan (storefront tactics are out of scope).
- Never `git add -A` (repo has untracked junk + node_modules). Stage exact files only.
- DB safety: never run prisma migrate/push/reset — no schema changes in this plan.
- For the bug-fix task (Task 4), follow the **blast-radius-shield** skill: MAP → LOCK → RED → FIX → VERIFY.
- Run the FULL suite (`cd backend && npm test`) before each commit, not just the new test.

---

## File Structure

| File | Responsibility | New/Modify |
|------|----------------|-----------|
| `backend/src/lib/cro-conversion.ts` | Pure: from DailySummary rows → daily purchase-conversion series + before/now window aggregates | Create |
| `backend/src/lib/cro-value.ts` | Pure: from before/now conversion + AOV + visitors → incremental value (extraOrders, extraRevenue, aovLift, convLift) | Create |
| `backend/src/lib/cro-suggestions.ts` | Static catalog of the 5 research-backed suggestions (metadata only) | Create |
| `backend/src/app/api/proxy/event/route.ts:90-102` | Root-cause fix: capture baselineCheckoutRate ONCE, clamp ≤1 | Modify |
| `backend/src/app/api/stores/[id]/cro/route.ts` | Assemble momentum payload (value, before/now, trend, milestones, fuel, roadmap, suggestions) | Modify |
| `backend/src/app/dashboard/analytics/page.tsx` | Rewrite as momentum dashboard UI | Rewrite |
| `backend/src/__tests__/cro-conversion.test.ts` | Unit tests for cro-conversion | Create |
| `backend/src/__tests__/cro-value.test.ts` | Unit tests for cro-value | Create |
| `backend/src/__tests__/cro-suggestions.test.ts` | Shape test for the catalog | Create |
| `backend/src/__tests__/cro-route.test.ts` | Extend with momentum-payload assertions | Modify |
| `backend/src/__tests__/proxy-event-baseline.test.ts` | Blast-radius locks + RED for the baseline bug | Create |

---

## Chunk 1: Pure calculation libs

### Task 1: `cro-conversion.ts` — daily series + before/now windows

**Files:**
- Create: `backend/src/lib/cro-conversion.ts`
- Test: `backend/src/__tests__/cro-conversion.test.ts`

Input rows are DailySummary records `{ date: Date|string, uniqueVisitors: number, ordersCompleted: number }`. Output: a daily conversion series (sorted ascending) and two aggregate windows — `before` = earliest `windowDays` (default 7) distinct days, `now` = latest `windowDays` distinct days. Conversion of a window = Σ ordersCompleted / Σ uniqueVisitors (0 if visitors 0). The window rolls forward as new days arrive (intended — keeps the story growing; do NOT freeze).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/cro-conversion.test.ts
import { describe, it, expect } from 'vitest';
import { buildConversionSeries, windowConversion } from '../lib/cro-conversion';

const rows = [
  { date: '2026-04-09', uniqueVisitors: 100, ordersCompleted: 1 }, // 1.0%
  { date: '2026-04-10', uniqueVisitors: 100, ordersCompleted: 0 }, // 0.0%
  { date: '2026-06-02', uniqueVisitors: 100, ordersCompleted: 2 }, // 2.0%
  { date: '2026-06-03', uniqueVisitors: 100, ordersCompleted: 2 }, // 2.0%
];

describe('buildConversionSeries', () => {
  it('returns one sorted point per day with conversion as a fraction', () => {
    const s = buildConversionSeries(rows);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ date: '2026-04-09', conversion: 0.01 });
    expect(s[3]).toEqual({ date: '2026-06-03', conversion: 0.02 });
  });
  it('handles zero visitors without dividing by zero', () => {
    const s = buildConversionSeries([{ date: '2026-04-09', uniqueVisitors: 0, ordersCompleted: 0 }]);
    expect(s[0].conversion).toBe(0);
  });
});

describe('windowConversion', () => {
  it('aggregates the earliest N and latest N distinct days', () => {
    const { before, now } = windowConversion(rows, 2);
    // before = first 2 days: (1+0)/(100+100) = 0.005
    expect(before.conversion).toBeCloseTo(0.005, 6);
    expect(before.visitors).toBe(200);
    expect(before.orders).toBe(1);
    // now = last 2 days: (2+2)/(100+100) = 0.02
    expect(now.conversion).toBeCloseTo(0.02, 6);
    expect(now.orders).toBe(4);
  });
  it('returns null-ish zero window when there are no rows', () => {
    const { before, now } = windowConversion([], 7);
    expect(before.conversion).toBe(0);
    expect(now.conversion).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-conversion.test.ts`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Implement**

```ts
// backend/src/lib/cro-conversion.ts
export interface DailyConversionRow {
  date: Date | string;
  uniqueVisitors: number;
  ordersCompleted: number;
}
export interface ConversionPoint { date: string; conversion: number }
export interface ConversionWindow { conversion: number; visitors: number; orders: number }

function dayKey(d: Date | string): string {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
function frac(orders: number, visitors: number): number {
  return visitors > 0 ? Math.round((orders / visitors) * 1e6) / 1e6 : 0;
}

/** One sorted point per day. Conversion is ordersCompleted / uniqueVisitors. */
export function buildConversionSeries(rows: DailyConversionRow[]): ConversionPoint[] {
  return [...rows]
    .map(r => ({ key: dayKey(r.date), v: r.uniqueVisitors ?? 0, o: r.ordersCompleted ?? 0 }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(r => ({ date: r.key, conversion: frac(r.o, r.v) }));
}

/** Earliest `windowDays` distinct days vs latest `windowDays`. Window rolls forward intentionally. */
export function windowConversion(
  rows: DailyConversionRow[],
  windowDays = 7,
): { before: ConversionWindow; now: ConversionWindow } {
  const byDay = new Map<string, { v: number; o: number }>();
  for (const r of rows) {
    const k = dayKey(r.date);
    const cur = byDay.get(k) ?? { v: 0, o: 0 };
    cur.v += r.uniqueVisitors ?? 0;
    cur.o += r.ordersCompleted ?? 0;
    byDay.set(k, cur);
  }
  const days = [...byDay.keys()].sort();
  const agg = (keys: string[]): ConversionWindow => {
    let v = 0, o = 0;
    for (const k of keys) { const d = byDay.get(k)!; v += d.v; o += d.o; }
    return { conversion: frac(o, v), visitors: v, orders: o };
  };
  return {
    before: agg(days.slice(0, windowDays)),
    now: agg(days.slice(-windowDays)),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-conversion.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\eliminai-cart-drawer"
git add backend/src/lib/cro-conversion.ts backend/src/__tests__/cro-conversion.test.ts
git commit -m "feat: cro-conversion pure lib (daily series + before/now windows)"
```

---

### Task 2: `cro-value.ts` — incremental value calc

**Files:**
- Create: `backend/src/lib/cro-value.ts`
- Test: `backend/src/__tests__/cro-value.test.ts`

Implements the spec formulas. Inputs: `before`/`now` conversion windows (from Task 1), `aovBefore`, `aovNow`, `visitors` (for the comparison period), `ordersNow`, `winsBanked`. All outputs floored at 0 where noted. `extraRevenue` interpretation is LOCKED per spec: extra orders valued at today's AOV PLUS AOV-lift across the existing order base.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/cro-value.test.ts
import { describe, it, expect } from 'vitest';
import { computeValue } from '../lib/cro-value';

describe('computeValue', () => {
  it('computes extra orders/revenue/aov/conversion deltas', () => {
    const v = computeValue({
      before: { conversion: 0.0078, visitors: 0, orders: 0 },
      now: { conversion: 0.0096, visitors: 0, orders: 0 },
      visitors: 18402, ordersNow: 176,
      aovBefore: 168.20, aovNow: 181.56, winsBanked: 3,
    });
    // extraOrders = 18402 * (0.0096 - 0.0078) = 33.12 -> 33
    expect(v.extraOrders).toBe(33);
    // aovLift = 13.36
    expect(v.aovLift).toBeCloseTo(13.36, 2);
    // convLift in percentage points = (0.0096-0.0078)*100 = 0.18
    expect(v.convLift).toBeCloseTo(0.18, 4);
    // extraRevenue = 33*181.56 + 176*(13.36) = 5991.48 + 2351.36 = 8342.84
    expect(v.extraRevenue).toBeCloseTo(8342.84, 1);
    expect(v.winsBanked).toBe(3);
  });

  it('floors negative lift to zero (noisy early week never shows scary negatives)', () => {
    const v = computeValue({
      before: { conversion: 0.02, visitors: 0, orders: 0 },
      now: { conversion: 0.01, visitors: 0, orders: 0 },
      visitors: 1000, ordersNow: 10, aovBefore: 200, aovNow: 150, winsBanked: 0,
    });
    expect(v.extraOrders).toBe(0);
    expect(v.extraRevenue).toBe(0);
    expect(v.aovLift).toBe(0);      // floored
    expect(v.convLift).toBe(0);     // floored
  });

  it('handles a null aovBefore (no baseline captured) as zero lift contribution', () => {
    const v = computeValue({
      before: { conversion: 0.01, visitors: 0, orders: 0 },
      now: { conversion: 0.01, visitors: 0, orders: 0 },
      visitors: 1000, ordersNow: 10, aovBefore: null, aovNow: 180, winsBanked: 0,
    });
    expect(v.aovLift).toBe(0);
    expect(v.extraRevenue).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-value.test.ts`
Expected: FAIL — `computeValue` undefined.

- [ ] **Step 3: Implement**

```ts
// backend/src/lib/cro-value.ts
import type { ConversionWindow } from './cro-conversion';

export interface ValueInput {
  before: ConversionWindow;
  now: ConversionWindow;
  visitors: number;        // visitors over the comparison period
  ordersNow: number;       // existing order base for the period
  aovBefore: number | null;
  aovNow: number | null;
  winsBanked: number;
}
export interface CartValue {
  extraOrders: number;
  extraRevenue: number;
  aovLift: number;
  convLift: number;        // percentage points
  winsBanked: number;
}

const floor0 = (n: number) => (n > 0 ? n : 0);

export function computeValue(i: ValueInput): CartValue {
  const aovBefore = i.aovBefore ?? 0;
  const aovNow = i.aovNow ?? 0;
  const convDelta = i.now.conversion - i.before.conversion;            // fraction
  const extraOrders = Math.round(floor0(i.visitors * convDelta));
  const aovLift = floor0(Math.round((aovNow - aovBefore) * 100) / 100);
  // LOCKED interpretation (spec): extra orders at today's AOV + AOV-lift across existing base.
  const extraRevenue = Math.round(floor0(extraOrders * aovNow + i.ordersNow * aovLift) * 100) / 100;
  const convLift = floor0(Math.round(convDelta * 100 * 10000) / 10000);  // percentage points
  return { extraOrders, extraRevenue, aovLift, convLift, winsBanked: i.winsBanked };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-value.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\eliminai-cart-drawer"
git add backend/src/lib/cro-value.ts backend/src/__tests__/cro-value.test.ts
git commit -m "feat: cro-value pure lib (incremental revenue/orders/aov/conversion)"
```

---

### Task 3: `cro-suggestions.ts` — research-backed suggestion catalog

**Files:**
- Create: `backend/src/lib/cro-suggestions.ts`
- Test: `backend/src/__tests__/cro-suggestions.test.ts`

Static metadata for the 5 suggestions. Display + activate-hook only; no storefront rendering (deferred). Each entry: `key, label, blurb, evidence, source, impact, metric, fit, watchStar?`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/cro-suggestions.test.ts
import { describe, it, expect } from 'vitest';
import { CRO_SUGGESTIONS } from '../lib/cro-suggestions';

describe('CRO_SUGGESTIONS', () => {
  it('has the 5 research-backed tactics with required fields', () => {
    const keys = CRO_SUGGESTIONS.map(s => s.key);
    expect(keys).toEqual(['freeReturns', 'deliveryDate', 'checkoutMicrocopy', 'giftEngraving', 'bnpl']);
    for (const s of CRO_SUGGESTIONS) {
      expect(s.label).toBeTruthy();
      expect(s.blurb).toBeTruthy();
      expect(s.source).toMatch(/^https?:\/\//);
      expect(['conversion', 'aov', 'attach_rate']).toContain(s.metric);
    }
  });
  it('stars engraving as the watch-specific play', () => {
    expect(CRO_SUGGESTIONS.find(s => s.key === 'giftEngraving')?.watchStar).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-suggestions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/lib/cro-suggestions.ts
export interface CroSuggestion {
  key: string;
  label: string;
  blurb: string;
  evidence: string;
  source: string;            // URL
  impact: string;            // human range, e.g. "+3-10% conversion"
  metric: 'conversion' | 'aov' | 'attach_rate';
  fit: 'high' | 'medium' | 'low';
  watchStar?: boolean;
}

export const CRO_SUGGESTIONS: CroSuggestion[] = [
  {
    key: 'freeReturns',
    label: 'Free-returns / money-back line',
    blurb: 'A risk-reversal microcopy line near checkout that addresses purchase anxiety.',
    evidence: 'A prominent money-back guarantee produced +30% CVR in a Shopify A/B test (single-store case — expect the lower half).',
    source: 'https://blendcommerce.com/blogs/ab-tests-shopify/30-33-increase-in-conversion-rate',
    impact: '+5-15% conversion', metric: 'conversion', fit: 'high',
  },
  {
    key: 'deliveryDate',
    label: 'Estimated delivery date',
    blurb: '"Get it by Tue, Jun 9" on cart lines and near the checkout button.',
    evidence: 'Baymard: 75% say an estimated delivery date influences buying; unclear timing drives ~22% of abandonment.',
    source: 'https://baymard.com/blog/current-state-of-checkout-ux',
    impact: '+2-6% conversion', metric: 'conversion', fit: 'high',
  },
  {
    key: 'checkoutMicrocopy',
    label: 'Checkout-button microcopy',
    blurb: 'Vary the button label ("Secure Checkout"), benefit subtext, colour and lock icon.',
    evidence: '"Add to Cart" beat alternatives by +9-13% across three sites; lowest-effort test for the A/B engine.',
    source: 'https://www.convertmate.io/blog/add-to-cart-vs-buy-now',
    impact: '+3-10% conversion', metric: 'conversion', fit: 'medium',
  },
  {
    key: 'giftEngraving',
    label: 'Engraving + gift options',
    blurb: '"This is a gift" toggle plus a paid engraving line item — high-margin AOV, lowers returns.',
    evidence: 'Personalisation/engraving commands a premium and lowers return rates in jewellery/watch ecommerce benchmarks.',
    source: 'https://branvas.com/blogs/news/jewelry-ecommerce-benchmarks-conversion-rate-aov',
    impact: 'high-margin AOV', metric: 'aov', fit: 'high', watchStar: true,
  },
  {
    key: 'bnpl',
    label: 'BNPL "4 payments of $X"',
    blurb: 'Installment framing for your $180+ price band (Shop Pay / Klarna / Afterpay).',
    evidence: 'Shopify merchant data: ~27% conversion and ~21% AOV lift from BNPL (discount provider hype like Klarna 35%).',
    source: 'https://www.shopify.com/blog/buy-now-pay-later',
    impact: '+3-10% conversion', metric: 'conversion', fit: 'high',
  },
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-suggestions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\eliminai-cart-drawer"
git add backend/src/lib/cro-suggestions.ts backend/src/__tests__/cro-suggestions.test.ts
git commit -m "feat: cro-suggestions catalog (5 research-backed cart tactics)"
```

---

## Chunk 2: baselineCheckoutRate root-cause fix (blast-radius-shield)

### Task 4: Fix the runaway `baselineCheckoutRate` write

**SKILL: follow `blast-radius-shield` (MAP → LOCK → RED → FIX → VERIFY).**

**Files:**
- Modify: `backend/src/app/api/proxy/event/route.ts:90-102`
- Create: `backend/src/__tests__/proxy-event-baseline.test.ts`
- Lock-only reference (do NOT change logic): `backend/src/app/api/cron/nightly/route.ts:176-188`

**BLAST RADIUS MAP (write into the test file as a comment block):**
- Target: the `CHECKOUT_CLICKED` baseline write at `proxy/event/route.ts:99`.
- Root cause: `baselineCheckoutRate = currentClicks / opens` where `currentClicks` = cumulative count of ALL `CHECKOUT_CLICKED` events (grows forever) but `opens` = frozen `store.baselineCartOpens`. Ratio climbs past 1 (observed 1.56 = 156%).
- CONSUMERS of `store.baselineCheckoutRate`: (1) `cron/nightly/route.ts:176,188` safety-revert check `recentRate < baseline * 0.95` — an inflated baseline makes this fire spuriously; (2) `cro/route.ts:53,66` (display, being removed by Task 6); (3) `stats/route.ts:102` (passthrough); (4) `dashboard/page.tsx`, `analytics/page.tsx` (display).
- FIX: capture the baseline rate ONCE — only write when `store.baselineCheckoutRate == null` — and clamp to `[0,1]`. This freezes a sane fraction and stops the runaway. (One-time correction of the already-inflated stored value is handled separately via the `?refresh=1` baseline backfill / manual reset — NOT in this code path.)

- [ ] **Step 1: LOCK + RED tests**

```ts
// backend/src/__tests__/proxy-event-baseline.test.ts
/**
 * BLAST RADIUS MAP — baselineCheckoutRate runaway (>1) fix
 * Target: proxy/event/route.ts CHECKOUT_CLICKED baseline write (lines 91-102).
 * Root cause: cumulative clicks / frozen opens -> ratio exceeds 1 over time.
 * Consumers: cron/nightly safety-revert (176/188), cro+stats+dashboard display.
 * Fix: write ONCE (guard on null) + clamp [0,1]. Cron logic unchanged.
 *
 * Route gate order (all must pass before the baseline block runs, verified by
 * reading route.ts in full):
 *   1. verifyAppProxySignature(query, secret)  [@/lib/hmac]   -> true
 *   2. body has sessionToken + eventType
 *   3. sessionLimiter.check(sessionToken)       [@/lib/rate-limit] -> true
 *   4. store = prisma.store.findUnique({ where:{ shopDomain: query.shop } })
 *   5. storeLimiter.check(store.id)             [@/lib/rate-limit] -> true
 *   6. session = prisma.visitorSession.findUnique({ sessionToken }) -> NOT null
 *   7. validTypes.includes('CHECKOUT_CLICKED')  -> true
 *   8. DEDUP: prisma.event.findFirst({ sessionId, eventType }) -> MUST be null,
 *      else the route returns { dedup:true } BEFORE reaching the baseline block.
 *   9. prisma.event.create(...)  then  updateSessionSegment(...) [@/lib/segment]
 *  10. baseline block: eventType==='CHECKOUT_CLICKED' && !experimentId
 *      -> prisma.event.count(...) -> prisma.store.update({ baselineCheckoutRate })
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks use REAL import paths (route imports from @/lib/* -> '../lib/*' here).
vi.mock('../lib/hmac', () => ({ verifyAppProxySignature: () => true }));
vi.mock('../lib/rate-limit', () => ({
  sessionLimiter: { check: () => true },
  storeLimiter: { check: () => true },
}));
vi.mock('../lib/segment', () => ({ updateSessionSegment: vi.fn() }));
vi.mock('../lib/prisma', () => ({ prisma: {
  store: { findUnique: vi.fn(), update: vi.fn() },
  event: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  visitorSession: { findUnique: vi.fn() },
}}));

import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

// Arrange a CHECKOUT_CLICKED with no experimentId, passing every gate up to the
// baseline block. `store` carries the baseline fields under test; `clicks` is the
// cumulative count prisma.event.count would return.
async function clickCheckout(store: any, clicks = 0) {
  (prisma.store.findUnique as any).mockResolvedValue(store);
  (prisma.visitorSession.findUnique as any).mockResolvedValue({ id: 'sess1' });
  (prisma.event.findFirst as any).mockResolvedValue(null);  // no dedup -> proceed
  (prisma.event.create as any).mockResolvedValue({});
  (prisma.event.count as any).mockResolvedValue(clicks);
  const { POST } = await import('../app/api/proxy/event/route');
  return POST(new NextRequest('http://x/api/proxy/event?shop=shop.myshopify.com', {
    method: 'POST',
    body: JSON.stringify({ sessionToken: 'tok', eventType: 'CHECKOUT_CLICKED' }),
  }));
}

describe('proxy/event baseline checkout rate', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.SHOPIFY_API_SECRET = 'test'; });

  it('LOCK: still records the event (event.create called, 200)', async () => {
    const res = await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: 0.12 }, 13);
    expect(res.status).toBe(200);
    expect(prisma.event.create).toHaveBeenCalled();
  });

  it('BUG: does NOT overwrite an existing baselineCheckoutRate (no runaway)', async () => {
    // store already has a captured rate -> write-once guard must skip store.update.
    await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: 0.12 }, 200);
    expect(prisma.store.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineCheckoutRate: expect.anything() }),
    }));
  });

  it('captures a clamped fraction on FIRST observation only', async () => {
    // baselineCheckoutRate null, opens 100, clicks 13 -> writes 0.13 exactly once.
    await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: null }, 13);
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineCheckoutRate: 0.13 }),
    }));
  });

  it('clamps to 1 when cumulative clicks exceed frozen opens', async () => {
    // null rate, opens 100, clicks 250 -> raw 2.5, clamped to 1.
    await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: null }, 250);
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineCheckoutRate: 1 }),
    }));
  });
});
```

These mocks match the route's real imports and gate order (verified against `proxy/event/route.ts`): `@/lib/hmac`, `@/lib/rate-limit`, `@/lib/segment`, plus `event.findFirst -> null` so the per-session dedup at lines 66-73 does not short-circuit before the baseline block.

- [ ] **Step 2: Run to verify the BUG test fails (and LOCK passes)**

Run: `cd backend && npx vitest run src/__tests__/proxy-event-baseline.test.ts`
Expected: the "does NOT overwrite" test FAILS against current code (current code overwrites every click).

- [ ] **Step 3: FIX — write once + clamp**

```ts
// backend/src/app/api/proxy/event/route.ts  (replace lines ~90-102)
  // Capture baseline checkout rate ONCE, as a clamped fraction. Recomputing on
  // every click compared cumulative clicks against a frozen open count, which
  // pushed the "rate" past 1 (e.g. 156%) over time and corrupted the nightly
  // safety-revert check. Freeze it on first observation instead.
  if (
    body.eventType === 'CHECKOUT_CLICKED' &&
    !body.experimentId &&
    (store.baselineCheckoutRate == null)
  ) {
    const opens = store.baselineCartOpens || 0;
    if (opens > 0) {
      const currentClicks = await prisma.event.count({
        where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED', assignmentId: null },
      });
      const rate = Math.min(1, Math.max(0, currentClicks / opens));
      await prisma.store.update({
        where: { id: store.id },
        data: { baselineCheckoutRate: rate },
      });
    }
  }
```

- [ ] **Step 4: VERIFY — targeted, then blast-radius, then full suite**

```bash
cd backend
npx vitest run src/__tests__/proxy-event-baseline.test.ts
npx vitest run src/__tests__/nightly-cron.test.ts src/__tests__/cro-route.test.ts
npm test
```
Expected: all pass. Nightly-cron LOCK-11/11b still green (consumer untouched).

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\eliminai-cart-drawer"
git add backend/src/app/api/proxy/event/route.ts backend/src/__tests__/proxy-event-baseline.test.ts
git commit -m "fix: capture baselineCheckoutRate once and clamp to [0,1] (stops >1 runaway)"
```

---

## Chunk 3: API payload + UI

### Task 5: Extend `GET /api/stores/[id]/cro` with the momentum payload

**Files:**
- Modify: `backend/src/app/api/stores/[id]/cro/route.ts`
- Modify: `backend/src/__tests__/cro-route.test.ts`

Add to the existing response (do NOT remove current fields — `cro-route.test.ts` existing assertions must keep passing). Pull DailySummary with `uniqueVisitors, ordersCompleted, date` (extend the existing `select`). Compute via the new libs. `winsBanked = store.config?.autopilot?.completedCount ?? 0`. Milestones: map each addon in `store.config.addons` that has `lastWinner.appliedAt` → `{ date, addonKey, label, lift }` (lift from `lastWinner` if present, else null).

**Roadmap assembly (CRITICAL — match the real `autopilot.ts` API).** `buildOptimizeQueueRich(addonDefs, testedSlots, winners)` returns `{ queue: QueueItem[]; phase: OptimizationPhase }` — NOT `{ active, queue }`. Mirror the production derivation in `app/api/stores/[id]/autopilot/route.ts:47-62`:
- `testedSlots` / `winners` come from completed experiments: `prisma.experiment.findMany({ where: { storeId: params.id, status: { in: ['WINNER_FOUND','NO_DIFFERENCE'] } }, select: { slot: true, winnerVariantId: true, variants: true } })`. `testedSlots = completed.map(e => e.slot)`; for each with a `winnerVariantId`, set `winners[e.slot] = (e.variants.find(v => v.id === e.winnerVariantId)?.features) ?? {}`.
- `addonDefs`: pass `ADDON_DEFINITIONS as any` (import from `@/lib/addon-definitions`). This is the established production cast — `AddonDef` (in `autopilot.ts`, not exported) requires `category`, which `ADDON_DEFINITIONS` lacks; `autopilot/route.ts:62` already casts `as any`. Do NOT invent a category field.
- `roadmap.active`: `buildOptimizeQueueRich` does NOT return an "active" item. Derive it: look up a RUNNING experiment (`prisma.experiment.findFirst({ where: { storeId: params.id, status: 'RUNNING' } })`); if found, map it to `{ name, slot, ... }`; else fall back to the first queued item (`queue[0] ?? null`). Final shape: `roadmap = { active, queue, phase }`.
- Wrap the whole roadmap block in `try/catch` returning `{ active: null, queue: [], phase: 'complete' }` so any queue-shape or data surprise degrades gracefully instead of 500ing the page.

- [ ] **Step 1: Write the failing test (extend existing file)**

First extend the shared prisma mock at the top of `cro-route.test.ts` to add the
roadmap queries: change `experiment: { findMany: vi.fn().mockResolvedValue([]) }`
to `experiment: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }`
(the route now calls `findMany` for completed experiments AND `findFirst` for the
RUNNING active test).

```ts
// add inside describe('GET /api/stores/[id]/cro', ...) in cro-route.test.ts
it('returns the momentum payload (value, before/now, trend, fuel, roadmap, suggestions)', async () => {
  (prisma.store.findUnique as any).mockResolvedValue({
    id: 's3', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
    baselineCheckoutRate: 0.1,
    config: {
      cro: { baseline: { aov: 168.2, currency: 'USD' } },
      autopilot: { completedCount: 3 },
      addons: {},
    },
  });
  (prisma.dailySummary.findMany as any).mockResolvedValue([
    { date: '2026-04-09', uniqueVisitors: 100, ordersCompleted: 1, cartOpens: 10, checkoutClicks: 5 },
    { date: '2026-06-03', uniqueVisitors: 100, ordersCompleted: 2, cartOpens: 10, checkoutClicks: 6 },
  ]);
  (prisma.experiment.findMany as any).mockResolvedValue([]);  // no completed tests -> empty roadmap queue
  (prisma.experiment.findFirst as any).mockResolvedValue(null); // no RUNNING active test
  const res = await call('s3');
  const body = await res.json();
  expect(body.value).toBeDefined();
  expect(body.value.winsBanked).toBe(3);
  expect(body.now.aov).toBe(150);               // from fetchOrders30d mock 1500/10
  expect(Array.isArray(body.trend)).toBe(true);
  expect(body.trend.length).toBe(2);
  expect(body.fuel.visitors).toBe(200);
  expect(Array.isArray(body.suggestions)).toBe(true);
  expect(body.suggestions.length).toBe(5);
  expect(body.roadmap).toBeDefined();
  expect(Array.isArray(body.roadmap.queue)).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-route.test.ts`
Expected: the new test FAILS (`body.value` undefined); the two original tests still PASS.

- [ ] **Step 3: Implement** — extend the route. Add imports (`buildOptimizeQueueRich` from `@/lib/autopilot`, `ADDON_DEFINITIONS` from `@/lib/addon-definitions`, the three new `cro-*` libs) and, before the final `NextResponse.json`, assemble the momentum block. Extend the DailySummary `select` to include `uniqueVisitors, ordersCompleted, date`. Reuse `currentAov`, `baseline`, `store.config`. Add the momentum fields to the returned object. Implementer: write `windowConversion(rows, 7)`, `buildConversionSeries(rows)`, `computeValue({ before, now, visitors, ordersNow, aovBefore, aovNow, winsBanked })`, `CRO_SUGGESTIONS`, and the roadmap exactly per the **Roadmap assembly** notes above — `buildOptimizeQueueRich(ADDON_DEFINITIONS as any, testedSlots, winners)` returns `{ queue, phase }`; derive `active` from a RUNNING-experiment lookup or `queue[0]`; final `roadmap = { active, queue, phase }`. Wrap the entire roadmap block in `try/catch` returning `{ active: null, queue: [], phase: 'complete' }` so a queue-shape surprise never 500s the page.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-route.test.ts`
Expected: PASS (all, including the two originals).

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\eliminai-cart-drawer"
git add backend/src/app/api/stores/[id]/cro/route.ts backend/src/__tests__/cro-route.test.ts
git commit -m "feat: extend cro endpoint with momentum payload"
```

---

### Task 6: Rewrite the Analytics page as the momentum dashboard

**SKILL: use `frontend-design` for the visual build.** Mockup of record: `.superpowers/brainstorm/65948-1780573482/analytics-momentum-v3.html`.

**Files:**
- Rewrite: `backend/src/app/dashboard/analytics/page.tsx`

Consume the extended payload. Sections top-to-bottom (per approved mockup): (1) Value scoreboard hero — "+$X extra revenue" + 4 delta tiles (extraOrders, aovLift, convLift, winsBanked) + "this week" pill; (2) before→now comparison; (3) conversion trend SVG line with milestone markers; (4) fuel callout; (5) roadmap (active test + queue); (6) suggestion cards with Activate buttons (wired in Task 7). Remove the old buggy "Cart Checkout Rate" baseline card entirely. Keep the existing `useStore`/`Suspense` scaffold and the "still capturing baseline" empty state. All money via `Intl.NumberFormat`; label estimated figures "estimated".

- [ ] **Step 1: Implement the page** (presentational; data comes from the tested endpoint). Match the dark mockup aesthetic; responsive grid; inline SVG for the trend (no new dependency).

- [ ] **Step 2: Typecheck + build**

Run: `cd backend && npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 3: Full test suite (no regressions)**

Run: `cd backend && npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd "C:\Projects\eliminai-cart-drawer"
git add backend/src/app/dashboard/analytics/page.tsx
git commit -m "feat: momentum-dashboard Analytics page redesign"
```

---

### Task 7: Wire suggestion "Activate" (lightweight, honest)

**Scope note:** storefront tactics are NOT built in this milestone. "Activate" registers merchant interest by persisting an `activated` flag, and the card reflects state ("Requested — we'll set this up"). No fake working addon is created.

**Files:**
- Create: `backend/src/app/api/stores/[id]/cro/suggestions/route.ts` (POST `{ key }` → toggles `store.config.croSuggestions.activated[]`)
- Create: `backend/src/__tests__/cro-suggestions-route.test.ts`
- Modify: `backend/src/app/dashboard/analytics/page.tsx` (Activate button → POST → optimistic state)

- [ ] **Step 1: Write the failing route test**

```ts
// backend/src/__tests__/cro-suggestions-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../lib/prisma', () => ({ prisma: { store: { findUnique: vi.fn(), update: vi.fn() } } }));
import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

async function post(id: string, key: string) {
  const { POST } = await import('../app/api/stores/[id]/cro/suggestions/route');
  return POST(new NextRequest(`http://x/api/stores/${id}/cro/suggestions`, {
    method: 'POST', body: JSON.stringify({ key }),
  }), { params: { id } });
}

describe('POST cro/suggestions', () => {
  beforeEach(() => vi.clearAllMocks());
  it('adds a valid suggestion key to config.croSuggestions.activated', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ id: 's1', config: {} });
    const res = await post('s1', 'freeReturns');
    expect(res.status).toBe(200);
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        config: expect.objectContaining({
          croSuggestions: { activated: ['freeReturns'] },
        }),
      }),
    }));
  });
  it('rejects an unknown suggestion key', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ id: 's1', config: {} });
    const res = await post('s1', 'bogus');
    expect(res.status).toBe(400);
    expect(prisma.store.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-suggestions-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```ts
// backend/src/app/api/stores/[id]/cro/suggestions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CRO_SUGGESTIONS } from '@/lib/cro-suggestions';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { key } = await req.json().catch(() => ({ key: undefined }));
  if (!CRO_SUGGESTIONS.some(s => s.key === key)) {
    return NextResponse.json({ error: 'Unknown suggestion' }, { status: 400 });
  }
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const cfg = (store.config as Record<string, any>) ?? {};
  const activated: string[] = cfg.croSuggestions?.activated ?? [];
  const next = activated.includes(key) ? activated : [...activated, key];
  await prisma.store.update({
    where: { id: params.id },
    data: { config: { ...cfg, croSuggestions: { activated: next } } },
  });
  return NextResponse.json({ ok: true, activated: next });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-suggestions-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the button** in `analytics/page.tsx`: Activate → `POST /api/stores/${storeId}/cro/suggestions` `{ key }`, optimistic local state flips the card to "Requested ✓". Read initial activated state from the cro payload (add `activatedSuggestions: cfg.croSuggestions?.activated ?? []` to the Task 5 payload — include this in Task 5 implementation).

- [ ] **Step 6: Full suite + build, then commit**

```bash
cd backend && npm test && npx tsc --noEmit
cd "C:\Projects\eliminai-cart-drawer"
git add backend/src/app/api/stores/[id]/cro/suggestions/route.ts backend/src/__tests__/cro-suggestions-route.test.ts backend/src/app/dashboard/analytics/page.tsx
git commit -m "feat: activate cart suggestions (registers merchant interest)"
```

---

## Final verification (after all tasks)

```bash
cd backend && npm test          # full suite green
cd backend && npx tsc --noEmit  # no type errors
cd backend && npm run build     # production build OK
```

Then use **superpowers:finishing-a-development-branch** to merge `feature/analytics-momentum-redesign`.

Deploy reminders (post-merge, manual): backend → `cd backend && railway up --ci`. No v14 storefront change in this plan, so no `node upload-eleganto-live.js`. No DB schema change (uses existing columns + JSON `config`).
