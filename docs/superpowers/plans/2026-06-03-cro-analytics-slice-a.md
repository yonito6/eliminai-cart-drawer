# Slice A — CRO Baseline + Analytics Page — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture each store's last-30-day order/revenue/AOV baseline at install and show CRO + AOV lift over time on a new dashboard Analytics page.

**Architecture:** Pure-logic modules (`cro-baseline.ts`, `cro-lift.ts`) hold all math and are unit-tested in isolation. A thin Shopify fetch helper (`shopify-orders.ts`) reuses the existing `store.accessToken` + GraphQL `fetch` pattern. Baseline capture extends the existing install-callback seeding block. One read API route (`/api/stores/[id]/cro`) composes baseline + current + lift for the new client page (`dashboard/analytics/page.tsx`), which follows the existing `useStore()` fetch pattern and gets a new nav entry.

**Tech Stack:** Next.js 14 (app router), Prisma, Shopify Admin GraphQL API `2025-10`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-continuous-cro-optimization-design.md`

---

## Data-source decisions (read before starting)

The spec flagged three open data questions. Resolved for Slice A as follows:

1. **What the baseline contains.** From Shopify Admin API (reliable): `orders30d`
   (count), `revenue30d` (summed, in the store's currency minor units → stored as a
   number in major units), `aov` (= revenue30d / orders30d). The app's own
   **forward** cart metrics (`baselineCheckoutRate`, `DailySummary`) supply the
   cart-conversion trend from install onward.
2. **Storefront conversion rate** (sessions → orders) is NOT available from the
   Admin orders API. Slice A does **not** attempt ShopifyQL/sessions. The headline
   uses **AOV** and **orders/revenue** as the store-level "since install" numbers,
   plus the app's own **cart checkout rate** (`baselineCheckoutRate` vs current) as
   the cart-specific CRO number. This keeps Slice A unblocked by report scopes.
3. **Where capture runs.** At install, inside the existing callback seeding block
   (already non-blocking). Plus an idempotent re-capture via `GET /api/stores/[id]/cro?refresh=1`
   so a store that installed before this feature can backfill its baseline.

**Auth note:** This plan reuses the project's existing Shopify auth (stored
`store.accessToken`, OAuth auth-code flow) because every Admin API call in the
codebase already does. The global CLAUDE.md prefers a client-credentials flow;
reconciling the project's auth model with that preference is a separate decision and
is explicitly out of scope here. Do not rewrite the auth flow in this slice.

---

## File Structure

- Create `backend/src/lib/cro-baseline.ts` — types + pure builder `buildBaseline()` and `computeAov()`.
- Create `backend/src/lib/cro-lift.ts` — pure `computeLift(baseline, current)`.
- Create `backend/src/lib/shopify-orders.ts` — `fetchOrders30d(shopDomain, accessToken)` → `{ orderCount, totalRevenue, currency }`.
- Modify `backend/src/app/api/auth/callback/route.ts` — extend the existing baseline-seeding block to write `config.cro.baseline`.
- Create `backend/src/app/api/stores/[id]/cro/route.ts` — `GET` returns `{ baseline, current, lift, activity }`.
- Create `backend/src/app/dashboard/analytics/page.tsx` — the Analytics page.
- Modify `backend/src/app/dashboard/layout.tsx` — add the `Analytics` nav entry.
- Create tests: `backend/src/__tests__/cro-baseline.test.ts`, `backend/src/__tests__/cro-lift.test.ts`, `backend/src/__tests__/shopify-orders.test.ts`, `backend/src/__tests__/cro-route.test.ts`.

**Test command (all):** `cd backend && npm test`
**Single file:** `cd backend && npx vitest run src/__tests__/<file>.test.ts`

---

## Chunk 1: Baseline math + Shopify fetch + capture hook

### Task 1: `cro-baseline.ts` — types and pure builders

**Files:**
- Create: `backend/src/lib/cro-baseline.ts`
- Test: `backend/src/__tests__/cro-baseline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/cro-baseline.test.ts
import { describe, it, expect } from 'vitest';
import { computeAov, buildBaseline } from '../lib/cro-baseline';

describe('computeAov', () => {
  it('returns revenue / orders rounded to 2 decimals', () => {
    expect(computeAov(1000, 8)).toBe(125);
    expect(computeAov(1005, 8)).toBe(125.63);
  });
  it('returns 0 when there are no orders (no divide-by-zero)', () => {
    expect(computeAov(1000, 0)).toBe(0);
    expect(computeAov(0, 0)).toBe(0);
  });
});

describe('buildBaseline', () => {
  it('assembles a baseline record with aov computed and a captured timestamp', () => {
    const b = buildBaseline({ orderCount: 8, totalRevenue: 1000, currency: 'USD' }, new Date('2026-06-03T00:00:00Z'));
    expect(b).toEqual({
      capturedAt: '2026-06-03T00:00:00.000Z',
      windowDays: 30,
      orders30d: 8,
      revenue30d: 1000,
      aov: 125,
      currency: 'USD',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-baseline.test.ts`
Expected: FAIL — "Cannot find module '../lib/cro-baseline'".

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/lib/cro-baseline.ts
export interface OrdersAgg {
  orderCount: number;
  totalRevenue: number; // major currency units
  currency: string;
}

export interface CroBaseline {
  capturedAt: string;   // ISO
  windowDays: 30;
  orders30d: number;
  revenue30d: number;
  aov: number;
  currency: string;
}

export function computeAov(totalRevenue: number, orderCount: number): number {
  if (!orderCount) return 0;
  return Math.round((totalRevenue / orderCount) * 100) / 100;
}

export function buildBaseline(agg: OrdersAgg, now: Date = new Date()): CroBaseline {
  return {
    capturedAt: now.toISOString(),
    windowDays: 30,
    orders30d: agg.orderCount,
    revenue30d: agg.totalRevenue,
    aov: computeAov(agg.totalRevenue, agg.orderCount),
    currency: agg.currency,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-baseline.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/cro-baseline.ts backend/src/__tests__/cro-baseline.test.ts
git commit -m "feat(cro): baseline types + pure aov/buildBaseline"
```

---

### Task 2: `cro-lift.ts` — pure lift math

**Files:**
- Create: `backend/src/lib/cro-lift.ts`
- Test: `backend/src/__tests__/cro-lift.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/cro-lift.test.ts
import { describe, it, expect } from 'vitest';
import { computeLift } from '../lib/cro-lift';

describe('computeLift', () => {
  it('computes absolute and percent lift for aov and checkout rate', () => {
    const lift = computeLift(
      { aov: 100, checkoutRate: 0.10 },
      { aov: 120, checkoutRate: 0.13 },
    );
    expect(lift.aov).toEqual({ absolute: 20, percent: 20 });
    expect(lift.checkoutRate.absolute).toBeCloseTo(0.03, 5);
    expect(lift.checkoutRate.percent).toBe(30);
  });
  it('returns null percent when the baseline value is 0 (cannot divide)', () => {
    const lift = computeLift({ aov: 0, checkoutRate: 0 }, { aov: 50, checkoutRate: 0.1 });
    expect(lift.aov).toEqual({ absolute: 50, percent: null });
    expect(lift.checkoutRate).toEqual({ absolute: 0.1, percent: null });
  });
  it('reports no delta (not a -100% crash) when current data is missing', () => {
    const lift = computeLift({ aov: 100, checkoutRate: 0.1 }, { aov: null, checkoutRate: null });
    expect(lift.aov).toEqual({ absolute: 0, percent: null });
    expect(lift.checkoutRate).toEqual({ absolute: 0, percent: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-lift.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/lib/cro-lift.ts
export interface CroSnapshot {
  aov: number | null;
  checkoutRate: number | null;
}

export interface LiftValue {
  absolute: number;
  percent: number | null;
}

export interface CroLift {
  aov: LiftValue;
  checkoutRate: LiftValue;
}

function lift(base: number | null, curr: number | null): LiftValue {
  // No current measurement yet → show no movement, not a -100% crash.
  if (curr == null) return { absolute: 0, percent: null };
  const b = base ?? 0;
  const absolute = Math.round((curr - b) * 100000) / 100000;
  const percent = b === 0 ? null : Math.round(((curr - b) / b) * 100 * 100) / 100;
  return { absolute, percent };
}

export function computeLift(baseline: CroSnapshot, current: CroSnapshot): CroLift {
  return {
    aov: lift(baseline.aov, current.aov),
    checkoutRate: lift(baseline.checkoutRate, current.checkoutRate),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-lift.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/cro-lift.ts backend/src/__tests__/cro-lift.test.ts
git commit -m "feat(cro): pure lift math (absolute + percent, divide-by-zero safe)"
```

---

### Task 3: `shopify-orders.ts` — fetch 30-day orders aggregate

The Admin GraphQL `orders` connection has no server-side sum, so page through orders
(250/page, `createdAt` filter) and sum `currentTotalPriceSet.shopMoney.amount`.
Cap pages to avoid runaway loops on very large stores.

**Files:**
- Create: `backend/src/lib/shopify-orders.ts`
- Test: `backend/src/__tests__/shopify-orders.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/shopify-orders.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOrders30d } from '../lib/shopify-orders';

const page = (orders: number[], hasNext: boolean, cursor = 'c1') => ({
  data: {
    orders: {
      pageInfo: { hasNextPage: hasNext, endCursor: cursor },
      edges: orders.map(a => ({
        cursor,
        node: { currentTotalPriceSet: { shopMoney: { amount: String(a), currencyCode: 'USD' } } },
      })),
    },
  },
});

describe('fetchOrders30d', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sums revenue and counts orders across paginated results', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({ json: async () => page([100, 50], true) } as any)
      .mockResolvedValueOnce({ json: async () => page([25.5], false) } as any);

    const res = await fetchOrders30d('shop.myshopify.com', 'tok');
    expect(res).toEqual({ orderCount: 3, totalRevenue: 175.5, currency: 'USD' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://shop.myshopify.com/admin/api/2025-10/graphql.json');
  });

  it('returns zeros and USD when there are no orders', async () => {
    vi.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({ json: async () => page([], false) } as any);
    const res = await fetchOrders30d('shop.myshopify.com', 'tok');
    expect(res).toEqual({ orderCount: 0, totalRevenue: 0, currency: 'USD' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/shopify-orders.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/lib/shopify-orders.ts
import type { OrdersAgg } from './cro-baseline';

const API_VERSION = '2025-10';
const MAX_PAGES = 40; // 40 * 250 = 10k orders / 30d cap

export async function fetchOrders30d(shopDomain: string, accessToken: string): Promise<OrdersAgg> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let cursor: string | null = null;
  let orderCount = 0;
  let totalRevenue = 0;
  let currency = 'USD';

  for (let i = 0; i < MAX_PAGES; i++) {
    const after: string = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      orders(first: 250, query: "created_at:>='${since}'"${after}) {
        pageInfo { hasNextPage endCursor }
        edges { node { currentTotalPriceSet { shopMoney { amount currencyCode } } } }
      }
    }`;
    const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json: any = await res.json();
    const conn = json?.data?.orders;
    if (!conn) break;
    for (const edge of conn.edges) {
      const money = edge?.node?.currentTotalPriceSet?.shopMoney;
      if (money) {
        orderCount += 1;
        totalRevenue += parseFloat(money.amount) || 0;
        if (money.currencyCode) currency = money.currencyCode;
      }
    }
    if (!conn.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  return { orderCount, totalRevenue: Math.round(totalRevenue * 100) / 100, currency };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/shopify-orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/shopify-orders.ts backend/src/__tests__/shopify-orders.test.ts
git commit -m "feat(cro): fetchOrders30d paginated Shopify revenue aggregate"
```

---

### Task 4: Capture baseline at install

Read `backend/src/app/api/auth/callback/route.ts` first (the existing seeding block,
~lines 49–75, writes `estimatedDailyOrders`/`shopifyOrderCount30d`/`baselineSeededAt`
into `store.config`). Add `cro.baseline` alongside it, reusing the new helpers. Keep
it inside the existing try/catch so a Shopify hiccup never blocks install.

**Files:**
- Modify: `backend/src/app/api/auth/callback/route.ts` (existing baseline-seeding block)

- [ ] **Step 1: Read the current callback route**

Run: open `backend/src/app/api/auth/callback/route.ts` and locate the `try` block that
queries `ordersCount` and updates `store.config`. Note the variable names for the
upserted store and its current config object.

- [ ] **Step 2: Add baseline capture inside the existing try block**

Add the import at the top:

```ts
import { fetchOrders30d } from '@/lib/shopify-orders';
import { buildBaseline } from '@/lib/cro-baseline';
```

Inside the existing seeding `try` (after the store is upserted and `accessToken` +
`shop` are known), add:

```ts
// CRO baseline — last 30 days orders/revenue/AOV (non-blocking)
try {
  const agg = await fetchOrders30d(shop, accessToken);
  const baseline = buildBaseline(agg);
  const fresh = await prisma.store.findUnique({ where: { shopDomain: shop } });
  const cfg = ((fresh?.config as Record<string, any>) ?? {});
  await prisma.store.update({
    where: { shopDomain: shop },
    data: { config: { ...cfg, cro: { ...(cfg.cro ?? {}), baseline } } },
  });
} catch (e) {
  console.error('[cro] baseline capture failed', e);
}
```

(Use the exact variable names found in Step 1 for `shop`/`accessToken`; if the route
already holds the upserted store object and its config, merge into that instead of
re-fetching.)

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no new errors in `callback/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/api/auth/callback/route.ts
git commit -m "feat(cro): capture 30d baseline into store.config at install"
```

---

## Chunk 2: CRO read API route (baseline + current + lift + activity)

### Task 5: `GET /api/stores/[id]/cro`

Returns the baseline, a current snapshot, the computed lift, and an activity log.
- **Current AOV** = AOV of the store's most recent 30d orders (reuse `fetchOrders30d`).
- **Current + baseline checkout rate**: baseline from `store.baselineCheckoutRate`;
  current from recent `DailySummary` rows (sum `checkoutClicks` / sum `cartOpens`).
- **Activity log**: completed experiments (status `WINNER_FOUND`/`NO_DIFFERENCE`) with
  name, endedAt, and `liftPercent` — reuse the `Experiment` table.
- `?refresh=1` re-captures the baseline if it is missing (backfill for old installs).

**Files:**
- Create: `backend/src/app/api/stores/[id]/cro/route.ts`
- Test: `backend/src/__tests__/cro-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__tests__/cro-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    store: { findUnique: vi.fn(), update: vi.fn() },
    dailySummary: { findMany: vi.fn().mockResolvedValue([]) },
    experiment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('../lib/shopify-orders', () => ({
  fetchOrders30d: vi.fn().mockResolvedValue({ orderCount: 10, totalRevenue: 1500, currency: 'USD' }),
}));

import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

async function call(id: string, url = `http://x/api/stores/${id}/cro`) {
  const { GET } = await import('../app/api/stores/[id]/cro/route');
  return GET(new NextRequest(url), { params: { id } });
}

describe('GET /api/stores/[id]/cro', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the store does not exist', async () => {
    (prisma.store.findUnique as any).mockResolvedValue(null);
    const res = await call('missing');
    expect(res.status).toBe(404);
  });

  it('returns baseline, current aov, lift and activity', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's1', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      baselineCheckoutRate: 0.10,
      config: { cro: { baseline: { capturedAt: '2026-05-01T00:00:00.000Z', windowDays: 30, orders30d: 8, revenue30d: 1000, aov: 125, currency: 'USD' } } },
    });
    (prisma.dailySummary.findMany as any).mockResolvedValue([
      { cartOpens: 100, checkoutClicks: 13 },
    ]);
    (prisma.experiment.findMany as any).mockResolvedValue([
      { name: 'Trust Badges', status: 'WINNER_FOUND', liftPercent: 4.2, endedAt: new Date('2026-05-20T00:00:00Z') },
    ]);

    const res = await call('s1');
    const body = await res.json();
    expect(body.baseline.aov).toBe(125);
    expect(body.current.aov).toBe(150);          // 1500 / 10
    expect(body.current.checkoutRate).toBeCloseTo(0.13, 5);
    expect(body.lift.aov).toEqual({ absolute: 25, percent: 20 });
    expect(body.activity).toHaveLength(1);
    expect(body.activity[0].name).toBe('Trust Badges');
    expect(body.baselineCheckoutRate).toBe(0.10);
  });

  it('backfills the baseline when missing and refresh=1 is passed', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's2', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      baselineCheckoutRate: null, currency: 'USD',
      config: {}, // no baseline yet
    });
    const res = await call('s2', 'http://x/api/stores/s2/cro?refresh=1');
    const body = await res.json();
    expect(prisma.store.update).toHaveBeenCalled();   // baseline written
    expect(body.baseline.aov).toBe(150);              // 1500 / 10 from the fetchOrders30d mock
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/cro-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/app/api/stores/[id]/cro/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchOrders30d } from '@/lib/shopify-orders';
import { buildBaseline, computeAov, type CroBaseline } from '@/lib/cro-baseline';
import { computeLift } from '@/lib/cro-lift';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const cfg = (store.config as Record<string, any>) ?? {};
  let baseline: CroBaseline | null = cfg.cro?.baseline ?? null;

  // Backfill for stores installed before this feature.
  const wantRefresh = req.nextUrl.searchParams.get('refresh') === '1';
  if ((!baseline || wantRefresh) && store.accessToken && store.shopDomain) {
    try {
      const agg = await fetchOrders30d(store.shopDomain, store.accessToken);
      baseline = buildBaseline(agg);
      await prisma.store.update({
        where: { id: store.id },
        data: { config: { ...cfg, cro: { ...(cfg.cro ?? {}), baseline } } },
      });
    } catch (e) {
      console.error('[cro] backfill failed', e);
    }
  }

  // Current AOV from the latest 30 days of orders.
  let currentAov: number | null = null;
  let currency = baseline?.currency ?? store.currency ?? 'USD';
  try {
    const agg = await fetchOrders30d(store.shopDomain, store.accessToken);
    currentAov = computeAov(agg.totalRevenue, agg.orderCount);
    currency = agg.currency || currency;
  } catch (e) {
    console.error('[cro] current aov failed', e);
  }

  // Current cart checkout rate from recent DailySummary rows (last 30 days).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const summaries = await prisma.dailySummary.findMany({
    where: { storeId: store.id, date: { gte: since } },
    select: { cartOpens: true, checkoutClicks: true },
  });
  const opens = summaries.reduce((s, r) => s + (r.cartOpens ?? 0), 0);
  const clicks = summaries.reduce((s, r) => s + (r.checkoutClicks ?? 0), 0);
  const currentCheckoutRate = opens > 0 ? Math.round((clicks / opens) * 100000) / 100000 : null;

  const baselineSnap = { aov: baseline?.aov ?? null, checkoutRate: store.baselineCheckoutRate ?? null };
  const currentSnap = { aov: currentAov, checkoutRate: currentCheckoutRate };
  const lift = computeLift(baselineSnap, currentSnap);

  const completed = await prisma.experiment.findMany({
    where: { storeId: store.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
    orderBy: { endedAt: 'desc' },
    select: { name: true, status: true, liftPercent: true, endedAt: true },
    take: 50,
  });

  return NextResponse.json({
    currency,
    baselineCheckoutRate: store.baselineCheckoutRate ?? null,
    baseline,
    current: { aov: currentAov, checkoutRate: currentCheckoutRate },
    lift,
    activity: completed.map(e => ({
      name: e.name,
      status: e.status,
      liftPercent: e.liftPercent,
      endedAt: e.endedAt,
    })),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/cro-route.test.ts`
Expected: PASS (3 cases: 404, success, refresh backfill).

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `cd backend && npm test`
Expected: all previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app/api/stores/[id]/cro/route.ts backend/src/__tests__/cro-route.test.ts
git commit -m "feat(cro): GET /stores/:id/cro — baseline, current, lift, activity"
```

---

## Chunk 3: Analytics dashboard page + nav

### Task 6: Add the `Analytics` nav entry

**Files:**
- Modify: `backend/src/app/dashboard/layout.tsx:8-13` (the `NAV` array)

- [ ] **Step 1: Add the nav item**

In the `NAV` array, add (place it right after Overview so it is prominent):

```ts
  { href: '/dashboard/analytics', label: 'Analytics', icon: '\uD83D\uDCC8' }, // 📈
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/app/dashboard/layout.tsx
git commit -m "feat(cro): add Analytics nav item"
```

---

### Task 7: The Analytics page

Client component following the `useStore()` → `fetch(/api/stores/{id}/cro)` pattern
(mirror `dashboard/results/page.tsx`). No new test (UI render); correctness of numbers
is covered by the lift/route unit tests. Keep styling consistent with existing pages
(inline styles, same card look).

**Files:**
- Create: `backend/src/app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useStore } from '@/lib/hooks/use-store';

interface CroResponse {
  currency: string;
  baselineCheckoutRate: number | null;
  baseline: { capturedAt: string; orders30d: number; revenue30d: number; aov: number } | null;
  current: { aov: number | null; checkoutRate: number | null };
  lift: {
    aov: { absolute: number; percent: number | null };
    checkoutRate: { absolute: number; percent: number | null };
  };
  activity: { name: string; status: string; liftPercent: number | null; endedAt: string | null }[];
}

function money(n: number | null, c: string) {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: c || 'USD' }).format(n);
}
function pct(n: number | null) { return n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`; }
function rate(n: number | null) { return n == null ? '—' : `${(n * 100).toFixed(1)}%`; }

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

  if (storeLoading || !storeId) return <div style={{ padding: 32 }}>Loading store…</div>;
  if (storeError) return <div style={{ padding: 32 }}>Store not found.</div>;

  const c = data?.currency ?? 'USD';

  return (
    <div style={{ padding: 32, maxWidth: 880 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Analytics</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        How your cart has improved since you installed.
      </p>

      {loading && <div>Loading…</div>}

      {!loading && !data?.baseline && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 16, marginBottom: 24, color: '#9a3412' }}>
          We're still capturing your baseline from Shopify. Check back shortly, or
          your store may have installed before analytics were available.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <Stat label="Average Order Value" value={money(data?.current.aov ?? null, c)}
              sub={`Baseline ${money(data?.baseline?.aov ?? null, c)}`} delta={pct(data?.lift.aov.percent ?? null)} />
        <Stat label="Cart Checkout Rate" value={rate(data?.current.checkoutRate ?? null)}
              sub={`Baseline ${rate(data?.baselineCheckoutRate ?? null)}`} delta={pct(data?.lift.checkoutRate.percent ?? null)} />
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>What we've done for you</h2>
      {(!data?.activity || data.activity.length === 0) && (
        <p style={{ color: '#6b7280' }}>No completed tests yet — your first optimization is on the way.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data?.activity?.map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
            <span>{a.name}</span>
            <span style={{ color: a.status === 'WINNER_FOUND' ? '#059669' : '#6b7280', fontWeight: 600 }}>
              {a.status === 'WINNER_FOUND' ? `Winner ${a.liftPercent != null ? `+${a.liftPercent}%` : ''}` : 'No difference'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, delta }: { label: string; value: string; sub: string; delta: string }) {
  const up = delta.startsWith('+');
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        <span style={{ color: up ? '#059669' : delta === '—' ? '#6b7280' : '#dc2626', fontWeight: 600 }}>{delta}</span>
        <span style={{ color: '#9ca3af', marginLeft: 8 }}>{sub}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading…</div>}>
      <AnalyticsInner />
    </Suspense>
  );
}
```

> Note: the storefront CRO/AOV **trend line** described in the spec is intentionally
> deferred to a follow-up — Slice A ships the headline stat cards + activity log first.
> The route already returns `baselineCheckoutRate` (added in Task 5), so the checkout-rate
> sub-label shows the real baseline number.

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual smoke (optional, local)**

Run the dev server, open `/dashboard/analytics?shop=<demo shop>`, confirm the page
renders, the AOV card shows a value, and the activity list shows completed tests.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/dashboard/analytics/page.tsx
git commit -m "feat(cro): Analytics dashboard page (AOV, checkout rate, activity)"
```

---

## Done criteria for Slice A

- `npm test` is green, including the 4 new test files.
- A freshly installed store gets `config.cro.baseline` written automatically.
- A pre-existing store backfills its baseline on first `/api/stores/[id]/cro` load.
- `/dashboard/analytics` renders AOV and cart checkout rate vs baseline, plus a
  "what we've done for you" list of completed tests.
- No storefront `v14-complete.js` changes (this slice is dashboard-only).

## Deployment (after merge — see project memory)

Backend is **Railway, manual**: `cd backend && railway up --ci`. No storefront upload
needed for Slice A. Verify live with `GET /api/stores/{id}/cro` returning JSON.
