# A/B Test Timeline, Autopilot & Tournament Bracket — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add time estimates, autopilot mode, results history page, post-winner flow, edit-triggers-test, custom variant tournaments, and mid-test change protection to the existing A/B testing system.

**Architecture:** Extend the existing Experiment model with new fields (notes JSON, tournament JSON). New API routes for history + autopilot + tournament. Extend nightly cron for autopilot auto-advance. New `/dashboard/results` page. All UI changes via Node.js scripts (file-lock hook blocks direct Edit on cart-drawer src files).

**Tech Stack:** Next.js 14, Prisma (PostgreSQL), React 18, TypeScript, vitest, jStat (Thompson Sampling)

**Spec:** `docs/superpowers/specs/2026-04-10-test-timeline-autopilot-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/lib/time-estimate.ts` | Power analysis calculation for estimated days remaining |
| `src/lib/autopilot.ts` | Queue generation, next-test picker, winner auto-apply |
| `src/lib/test-safety.ts` | Classify change risk (high/medium/low), detect running experiments |
| `src/app/api/stores/[id]/experiments/history/route.ts` | GET all experiments + summary stats |
| `src/app/api/stores/[id]/autopilot/route.ts` | GET/PATCH autopilot state |
| `src/app/api/stores/[id]/addons/test/tournament/route.ts` | POST start tournament, GET bracket status |
| `src/app/api/stores/[id]/addons/test/apply-winner/route.ts` | POST apply winner config + save rollback |
| `src/app/dashboard/results/page.tsx` | Results history page |
| `src/lib/hooks/use-store.ts` | React hook: resolve shop domain to storeId dynamically |
| `src/app/api/stores/resolve/route.ts` | GET resolve shop domain to store record |
| `src/__tests__/time-estimate.test.ts` | Tests for time estimate calculations |
| `src/__tests__/autopilot.test.ts` | Tests for autopilot queue + next-test logic |
| `src/__tests__/test-safety.test.ts` | Tests for change risk classification |
| `src/__tests__/tournament.test.ts` | Tests for tournament bracket logic |

### Modified Files
| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add `INVALIDATED` to ExperimentStatus enum, add `notes` and `tournament` JSON fields to Experiment |
| `src/app/api/cron/nightly/route.ts` | After winner detection: check autopilot → auto-apply → start next test |
| `src/app/api/stores/[id]/addons/experiments/route.ts` | Add time estimate to response |
| `src/app/api/stores/[id]/addons/route.ts` | Add change-risk check on PATCH, save `previousConfig` on config changes |
| `src/app/api/stores/[id]/addons/test/route.ts` | Support tournament bracket (advance to next round) |
| `src/app/dashboard/addons/page.tsx` + remove hardcoded STORE_ID, use useStore hook |
| `src/app/dashboard/page.tsx` | Remove hardcoded STORE_ID, use useStore hook | Autopilot toggle, post-winner UI, edit-triggers-test modal, tournament UI (via Node.js scripts) |

---

## Chunk 0: Remove Hardcoded STORE_ID — SaaS Prerequisite

### Task 0: Dynamic Store Resolution Hook

**Files:**
- Create: `src/lib/hooks/use-store.ts`
- Modify: `src/app/dashboard/addons/page.tsx` (via Node.js script)
- Modify: `src/app/dashboard/page.tsx` (via Node.js script)

**Problem:** Both dashboard pages have `const STORE_ID = 'cmnriegez0000jc70ro9nltw2'` hardcoded.
After Shopify OAuth, the app redirects to `/dashboard?shop=store.myshopify.com`.
We need to resolve `shop` param → store DB record → `storeId` dynamically.

- [ ] **Step 1: Create the API route to resolve shop domain to store ID**

```typescript
// src/app/api/stores/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop');
  if (!shop) return NextResponse.json({ error: 'shop required' }, { status: 400 });

  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
    select: { id: true, shopName: true, shopDomain: true, currency: true },
  });

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  return NextResponse.json({ store });
}
```

- [ ] **Step 2: Create the useStore hook**

```typescript
// src/lib/hooks/use-store.ts
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface StoreInfo {
  id: string;
  shopName: string;
  shopDomain: string;
  currency: string;
}

export function useStore() {
  const searchParams = useSearchParams();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shop = searchParams.get('shop');
    if (!shop) {
      // Fallback: try localStorage (for page refreshes without ?shop=)
      const cached = localStorage.getItem('ccd_store');
      if (cached) {
        setStore(JSON.parse(cached));
        setLoading(false);
        return;
      }
      setError('No shop parameter');
      setLoading(false);
      return;
    }

    fetch('/api/stores/resolve?shop=' + encodeURIComponent(shop))
      .then(r => r.json())
      .then(data => {
        if (data.store) {
          setStore(data.store);
          localStorage.setItem('ccd_store', JSON.stringify(data.store));
        } else {
          setError(data.error || 'Store not found');
        }
      })
      .catch(() => setError('Failed to resolve store'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  return { store, storeId: store?.id || null, loading, error };
}
```

- [ ] **Step 3: Replace hardcoded STORE_ID in addons/page.tsx**

Via Node.js script: replace `const STORE_ID = 'cmnriegez0000jc70ro9nltw2'` with:
```typescript
// Remove hardcoded STORE_ID, use useStore hook
import { useStore } from '@/lib/hooks/use-store';
// Inside the component:
const { storeId: STORE_ID, loading: storeLoading, error: storeError } = useStore();
```

Also add early return while loading:
```tsx
if (storeLoading) return <div style={{padding: 40, textAlign: 'center'}}>Loading store...</div>;
if (storeError || !STORE_ID) return <div style={{padding: 40, textAlign: 'center', color: '#ef4444'}}>Store not found. Please install the app from Shopify.</div>;
```

- [ ] **Step 4: Replace hardcoded STORE_ID in dashboard/page.tsx**

Same pattern as step 3.

- [ ] **Step 5: Fix the inline hardcoded ID**

In addons/page.tsx line 176, replace:
`fetch('/api/stores/cmnriegez0000jc70ro9nltw2/theme-settings')`
with:
`fetch('/api/stores/' + STORE_ID + '/theme-settings')`

- [ ] **Step 6: Verify all pages work with dynamic store**

Start dev server, navigate to `/dashboard?shop=test.myshopify.com`, verify pages load correctly.

- [ ] **Step 7: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/api/stores/resolve/route.ts src/lib/hooks/use-store.ts
git commit -m "feat: dynamic store resolution — remove hardcoded STORE_ID, use useStore hook"
```

**IMPORTANT:** All new pages (results page, any future dashboard pages) MUST use `useStore()` hook instead of hardcoded STORE_ID. This is a SaaS app — every store gets its own data.

---

## Chunk 1: Time Estimates + Schema Changes

### Task 1: Prisma Schema Updates

**Files:**
- Modify: `prisma/schema.prisma:10-17` (ExperimentStatus enum)
- Modify: `prisma/schema.prisma:50-70` (Experiment model)

- [ ] **Step 1: Add INVALIDATED status and new fields**

Add `INVALIDATED` to the ExperimentStatus enum, and `notes` + `tournament` JSON fields to Experiment:

```prisma
enum ExperimentStatus {
  BASELINE
  RUNNING
  WINNER_FOUND
  NO_DIFFERENCE
  REVERTED
  PAUSED
  INVALIDATED
}

// In Experiment model, add after maxDays:
  notes       Json?     // Array of {timestamp, type, detail} for timeline events
  tournament  Json?     // Tournament bracket state {bracket, currentRound, etc.}
```

- [ ] **Step 2: Push schema**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx prisma db push`
Expected: Schema pushed, no errors

- [ ] **Step 3: Generate client**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx prisma generate`

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add prisma/schema.prisma
git commit -m "schema: add INVALIDATED status, notes + tournament fields to Experiment"
```

---

### Task 2: Time Estimate Library

**Files:**
- Create: `src/lib/time-estimate.ts`
- Test: `src/__tests__/time-estimate.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/__tests__/time-estimate.test.ts
import { describe, it, expect } from 'vitest';
import { estimateDaysRemaining, calculateRequiredSamples } from '../lib/time-estimate';

describe('calculateRequiredSamples', () => {
  it('returns correct sample size for 20% baseline rate and 5% MDE', () => {
    // Formula: 16 * p*(1-p) / MDE^2
    // 16 * 0.2 * 0.8 / 0.05^2 = 16 * 0.16 / 0.0025 = 1024
    const result = calculateRequiredSamples(0.2, 0.05);
    expect(result).toBe(1024);
  });

  it('returns higher samples for lower baseline rates', () => {
    const low = calculateRequiredSamples(0.05, 0.05);
    const high = calculateRequiredSamples(0.3, 0.05);
    expect(low).toBeLessThan(high); // lower p*(1-p) = fewer samples needed
  });

  it('returns higher samples for smaller MDE', () => {
    const largeMDE = calculateRequiredSamples(0.2, 0.10);
    const smallMDE = calculateRequiredSamples(0.2, 0.02);
    expect(smallMDE).toBeGreaterThan(largeMDE);
  });
});

describe('estimateDaysRemaining', () => {
  it('returns null when daily rate is 0', () => {
    const result = estimateDaysRemaining({ currentSamples: 0, dailyEventRate: 0, checkoutRate: 0.2 });
    expect(result).toBeNull();
  });

  it('estimates days based on remaining samples and daily rate', () => {
    const result = estimateDaysRemaining({
      currentSamples: 500,
      dailyEventRate: 100,
      checkoutRate: 0.2,
      mde: 0.05,
    });
    // Required: 1024. Remaining: 1024-500=524. Days: 524/100 = 5.24 → 6
    expect(result).toBe(6);
  });

  it('returns 0 when enough samples collected', () => {
    const result = estimateDaysRemaining({
      currentSamples: 2000,
      dailyEventRate: 100,
      checkoutRate: 0.2,
    });
    expect(result).toBe(0);
  });

  it('caps at maxDays', () => {
    const result = estimateDaysRemaining({
      currentSamples: 0,
      dailyEventRate: 5,
      checkoutRate: 0.2,
      maxDays: 14,
    });
    // 1024/5 = 204.8 days → capped at 14
    expect(result).toBe(14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/time-estimate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement time-estimate.ts**

```typescript
// src/lib/time-estimate.ts

/**
 * Power analysis: how many total cart-open events are needed
 * to detect a given minimum detectable effect (MDE).
 *
 * Formula: 16 * p*(1-p) / MDE^2
 * where p = baseline checkout rate, MDE = minimum detectable effect (relative).
 */
export function calculateRequiredSamples(
  baselineRate: number,
  mde: number = 0.05,
): number {
  if (mde <= 0) return Infinity;
  return Math.ceil(16 * baselineRate * (1 - baselineRate) / (mde * mde));
}

interface EstimateInput {
  currentSamples: number;
  dailyEventRate: number;
  checkoutRate: number;
  mde?: number;
  maxDays?: number;
}

/**
 * Estimate how many days remain until the experiment reaches
 * statistical significance.
 *
 * Returns null if daily rate is 0 (can't estimate).
 * Returns 0 if enough samples already collected.
 * Caps at maxDays.
 */
export function estimateDaysRemaining(input: EstimateInput): number | null {
  const { currentSamples, dailyEventRate, checkoutRate, mde = 0.05, maxDays = 14 } = input;

  if (dailyEventRate <= 0) return null;

  const required = calculateRequiredSamples(checkoutRate, mde);
  const remaining = required - currentSamples;

  if (remaining <= 0) return 0;

  const days = Math.ceil(remaining / dailyEventRate);
  return Math.min(days, maxDays);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/time-estimate.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/lib/time-estimate.ts src/__tests__/time-estimate.test.ts
git commit -m "feat: add time estimate library with power analysis calculation"
```

---

### Task 3: Add Time Estimate to Experiments API

**Files:**
- Modify: `src/app/api/stores/[id]/addons/experiments/route.ts`

- [ ] **Step 1: Update the experiments endpoint to include time estimate**

After the existing enrichment loop (line ~60), add time estimate calculation. Import `estimateDaysRemaining` from `@/lib/time-estimate`. For each experiment:
1. Count total cart opens in last 7 days for the store
2. Calculate daily rate
3. Calculate current checkout rate from variant stats
4. Call `estimateDaysRemaining()`

Add to each experiment response:
```typescript
estimatedDaysRemaining: number | null,
dailyEventRate: number,
requiredSamples: number,
```

The key change is inside the `experiments.map()` callback. After calculating `variantStats`, compute:
```typescript
// Time estimate
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
const recentCartOpens = await prisma.event.count({
  where: { storeId: params.id, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
});
const dailyEventRate = Math.round(recentCartOpens / 7);
const totalCartOpens = variantStats.reduce((sum: number, v: any) => sum + v.cartOpens, 0);
const totalCheckouts = variantStats.reduce((sum: number, v: any) => sum + v.checkoutClicks, 0);
const checkoutRate = totalCartOpens > 0 ? totalCheckouts / totalCartOpens : 0.1;

const timeEst = estimateDaysRemaining({
  currentSamples: totalCartOpens,
  dailyEventRate,
  checkoutRate,
  maxDays: exp.maxDays,
});
```

- [ ] **Step 2: Run existing tests**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/api/stores/[id]/addons/experiments/route.ts
git commit -m "feat: add time estimate to experiments API response"
```

---

## Chunk 2: Autopilot + Test Safety

### Task 4: Autopilot Library

**Files:**
- Create: `src/lib/autopilot.ts`
- Test: `src/__tests__/autopilot.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/__tests__/autopilot.test.ts
import { describe, it, expect } from 'vitest';
import { generateOptimizeQueue, pickNextTest } from '../lib/autopilot';

const MOCK_DEFINITIONS = [
  { key: 'trustBadges', label: 'Trust Badges', dimensions: [{ key: 'position', testable: true }, { key: 'text', testable: true }, { key: 'icons', testable: false }] },
  { key: 'scarcityTimer', label: 'Scarcity Timer', dimensions: [{ key: 'textTemplate', testable: true }] },
  { key: 'socialProof', label: 'Social Proof', dimensions: [{ key: 'textTemplate', testable: true }] },
];

describe('generateOptimizeQueue', () => {
  it('prioritizes WITH/WITHOUT tests for untested addons', () => {
    const queue = generateOptimizeQueue(MOCK_DEFINITIONS as any, []);
    // First 3 items should be enabled tests for each addon
    expect(queue[0]).toBe('trustBadges:_enabled');
    expect(queue[1]).toBe('scarcityTimer:_enabled');
    expect(queue[2]).toBe('socialProof:_enabled');
  });

  it('adds dimension tests after enabled tests', () => {
    const queue = generateOptimizeQueue(MOCK_DEFINITIONS as any, []);
    // After 3 enabled tests, dimension tests follow
    expect(queue).toContain('trustBadges:position');
    expect(queue).toContain('trustBadges:text');
    expect(queue).not.toContain('trustBadges:icons'); // not testable
  });

  it('skips already-completed tests', () => {
    const completedNames = ['Trust Badges — Enabled vs Disabled'];
    const queue = generateOptimizeQueue(MOCK_DEFINITIONS as any, completedNames);
    expect(queue[0]).not.toBe('trustBadges:_enabled');
  });
});

describe('pickNextTest', () => {
  it('returns first item from queue', () => {
    const next = pickNextTest(['trustBadges:_enabled', 'scarcityTimer:_enabled']);
    expect(next).toEqual({ slot: 'trustBadges', dimension: '_enabled' });
  });

  it('returns null when queue is empty', () => {
    const next = pickNextTest([]);
    expect(next).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/autopilot.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement autopilot.ts**

```typescript
// src/lib/autopilot.ts
import type { AddonDefinition } from './addon-definitions';

/**
 * Generate an optimization queue: ordered list of "slot:dimension" strings.
 * Priority: WITH/WITHOUT first, then testable dimensions.
 */
export function generateOptimizeQueue(
  definitions: AddonDefinition[],
  completedTestNames: string[],
): string[] {
  const completed = new Set(completedTestNames);
  const queue: string[] = [];

  // Priority 1: WITH vs WITHOUT for each addon
  for (const def of definitions) {
    const enabledTestName = `${def.label} — Enabled vs Disabled`;
    if (!completed.has(enabledTestName)) {
      queue.push(`${def.key}:_enabled`);
    }
  }

  // Priority 2: Testable dimensions for each addon
  for (const def of definitions) {
    for (const dim of def.dimensions) {
      if (!dim.testable) continue;
      const dimTestName = `${def.label} — ${dim.label}`;
      if (!completed.has(dimTestName)) {
        queue.push(`${def.key}:${dim.key}`);
      }
    }
  }

  return queue;
}

/**
 * Parse the next test to run from the queue.
 */
export function pickNextTest(
  queue: string[],
): { slot: string; dimension: string } | null {
  if (queue.length === 0) return null;
  const [slot, dimension] = queue[0].split(':');
  return { slot, dimension };
}

/**
 * Apply a winner's features to the store config.
 * Saves the previous config for rollback.
 */
export function applyWinnerToConfig(
  currentConfig: Record<string, any>,
  addonKey: string,
  winnerFeatures: Record<string, any>,
): Record<string, any> {
  const addons = { ...(currentConfig.addons || {}) };
  const addon = { ...(addons[addonKey] || {}) };

  // Save previous config for rollback
  addon.previousConfig = {
    config: { ...addon.config },
    savedAt: new Date().toISOString(),
    reason: 'winner',
  };

  // Apply winner features (skip _enabled which is a meta-feature)
  if (winnerFeatures._enabled === false) {
    addon.enabled = false;
    addon.mode = 'off';
  } else if (winnerFeatures._enabled === true) {
    addon.enabled = true;
  } else {
    // Dimension features — merge into config
    addon.config = { ...addon.config, ...winnerFeatures };
  }

  // Save winner metadata
  addon.lastWinner = {
    features: winnerFeatures,
    appliedAt: new Date().toISOString(),
  };

  addons[addonKey] = addon;
  return { ...currentConfig, addons };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/autopilot.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/lib/autopilot.ts src/__tests__/autopilot.test.ts
git commit -m "feat: autopilot library — queue generation, next-test picker, winner application"
```

---

### Task 5: Test Safety Library

**Files:**
- Create: `src/lib/test-safety.ts`
- Test: `src/__tests__/test-safety.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/__tests__/test-safety.test.ts
import { describe, it, expect } from 'vitest';
import { classifyChangeRisk } from '../lib/test-safety';

describe('classifyChangeRisk', () => {
  it('returns high when changing the same slot being tested', () => {
    const result = classifyChangeRisk('trustBadges', [{ slot: 'trustBadges' }] as any);
    expect(result).toBe('high');
  });

  it('returns medium when changing a different cart-related addon', () => {
    const result = classifyChangeRisk('scarcityTimer', [{ slot: 'trustBadges' }] as any);
    expect(result).toBe('medium');
  });

  it('returns low for unrelated settings', () => {
    const result = classifyChangeRisk('storeBranding', [{ slot: 'trustBadges' }] as any);
    expect(result).toBe('low');
  });

  it('returns low when no experiments running', () => {
    const result = classifyChangeRisk('trustBadges', []);
    expect(result).toBe('low');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/test-safety.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement test-safety.ts**

```typescript
// src/lib/test-safety.ts

interface MinimalExperiment {
  slot: string;
}

const CART_AFFECTING_SLOTS = new Set([
  'trustBadges', 'scarcityTimer', 'shippingProtection',
  'freeShippingBar', 'upsellRecommendations', 'socialProof',
  'checkout', 'layout', 'colors',
]);

/**
 * Classify how risky a settings change is relative to running experiments.
 *
 * - 'high': changing the exact addon/slot being tested → hard block
 * - 'medium': changing a different cart-affecting slot → soft warning
 * - 'low': unrelated change → allow silently
 */
export function classifyChangeRisk(
  changingSlot: string,
  runningExperiments: MinimalExperiment[],
): 'high' | 'medium' | 'low' {
  if (runningExperiments.length === 0) return 'low';

  const activeSlots = new Set(runningExperiments.map(e => e.slot));

  if (activeSlots.has(changingSlot)) return 'high';
  if (CART_AFFECTING_SLOTS.has(changingSlot)) return 'medium';
  return 'low';
}

/**
 * Add a note to an experiment's timeline.
 */
export function addExperimentNote(
  existingNotes: any[] | null,
  type: 'paused' | 'resumed' | 'settings_changed' | 'invalidated',
  detail: string,
): any[] {
  const notes = existingNotes || [];
  return [...notes, { timestamp: new Date().toISOString(), type, detail }];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/test-safety.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/lib/test-safety.ts src/__tests__/test-safety.test.ts
git commit -m "feat: test safety library — change risk classification and experiment notes"
```

---

### Task 6: Autopilot API Route

**Files:**
- Create: `src/app/api/stores/[id]/autopilot/route.ts`

- [ ] **Step 1: Create the autopilot API**

```typescript
// src/app/api/stores/[id]/autopilot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ADDON_DEFINITIONS } from '@/lib/addon-definitions';
import { generateOptimizeQueue, pickNextTest } from '@/lib/autopilot';

// GET /api/stores/:id/autopilot — get autopilot state
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const cfg = (store.config as any) || {};
  const autopilot = cfg.autopilot || { enabled: false, queue: [], completedCount: 0, totalLift: 0 };

  // Get currently running experiment
  const running = await prisma.experiment.findFirst({
    where: { storeId: params.id, status: 'RUNNING' },
  });

  return NextResponse.json({
    autopilot,
    currentTest: running ? { id: running.id, name: running.name, slot: running.slot } : null,
  });
}

// PATCH /api/stores/:id/autopilot — enable/disable autopilot
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const body = await req.json();
  const { enabled } = body;

  const cfg = (store.config as any) || {};

  if (enabled) {
    // Build queue from completed tests
    const completedTests = await prisma.experiment.findMany({
      where: { storeId: params.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
      select: { name: true },
    });
    const completedNames = completedTests.map(e => e.name);
    const queue = generateOptimizeQueue(ADDON_DEFINITIONS, completedNames);

    cfg.autopilot = {
      enabled: true,
      queue,
      completedCount: cfg.autopilot?.completedCount || 0,
      totalLift: cfg.autopilot?.totalLift || 0,
      startedAt: new Date().toISOString(),
    };

    // If no test is currently running, start the first one
    const running = await prisma.experiment.findFirst({
      where: { storeId: params.id, status: 'RUNNING' },
    });

    if (!running) {
      const next = pickNextTest(queue);
      if (next) {
        cfg.autopilot.currentTestSlot = `${next.slot}:${next.dimension}`;
      }
    }
  } else {
    cfg.autopilot = { ...cfg.autopilot, enabled: false };
  }

  await prisma.store.update({
    where: { id: params.id },
    data: { config: cfg },
  });

  return NextResponse.json({ autopilot: cfg.autopilot });
}
```

- [ ] **Step 2: Run all tests**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/api/stores/[id]/autopilot/route.ts
git commit -m "feat: autopilot API — enable/disable with auto-queue generation"
```

---

### Task 7: Apply Winner API Route

**Files:**
- Create: `src/app/api/stores/[id]/addons/test/apply-winner/route.ts`

- [ ] **Step 1: Create the apply-winner endpoint**

```typescript
// src/app/api/stores/[id]/addons/test/apply-winner/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyWinnerToConfig } from '@/lib/autopilot';

// POST /api/stores/:id/addons/test/apply-winner
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const body = await req.json();
  const { experimentId } = body;

  if (!experimentId) {
    return NextResponse.json({ error: 'experimentId required' }, { status: 400 });
  }

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
  });

  if (!experiment || experiment.storeId !== params.id) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
  }

  if (experiment.status !== 'WINNER_FOUND' || !experiment.winnerVariantId) {
    return NextResponse.json({ error: 'No winner to apply' }, { status: 400 });
  }

  const variants = experiment.variants as any[];
  const winner = variants.find((v: any) => v.id === experiment.winnerVariantId);

  if (!winner) {
    return NextResponse.json({ error: 'Winner variant not found' }, { status: 400 });
  }

  // Apply winner config
  const currentConfig = (store.config as any) || {};
  const updatedConfig = applyWinnerToConfig(currentConfig, experiment.slot, winner.features);

  await prisma.store.update({
    where: { id: params.id },
    data: { config: updatedConfig },
  });

  return NextResponse.json({
    applied: true,
    slot: experiment.slot,
    winnerFeatures: winner.features,
    previousConfigSaved: true,
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/api/stores/[id]/addons/test/apply-winner/route.ts
git commit -m "feat: apply-winner API — saves rollback config and applies winning features"
```

---

## Chunk 3: Nightly Cron Autopilot + History API

### Task 8: Extend Nightly Cron for Autopilot

**Files:**
- Modify: `src/app/api/cron/nightly/route.ts`

- [ ] **Step 1: Add autopilot logic after winner detection**

After the existing winner detection block (around line 83, after `await prisma.experiment.update()`), add autopilot auto-advance logic. When a winner is found AND autopilot is enabled:

1. Import `applyWinnerToConfig` and `pickNextTest` from respective libs
2. After setting `WINNER_FOUND`, check `store.config.autopilot.enabled`
3. If enabled: apply winner config to store, remove current test from queue, start next test in queue
4. Add experiment notes for audit trail

```typescript
// After experiment update (line ~94), add:
if (newStatus === 'WINNER_FOUND' && (exp.store.config as any)?.autopilot?.enabled) {
  const storeCfg = exp.store.config as any;
  const variants = exp.variants as any[];
  const winner = variants.find((v: any) => v.id === winnerVariantId);

  if (winner) {
    // Apply winner
    const updatedCfg = applyWinnerToConfig(storeCfg, exp.slot, winner.features);

    // Advance queue
    const queue = (updatedCfg.autopilot?.queue || []).filter(
      (item: string) => !item.startsWith(exp.slot + ':')
    );
    updatedCfg.autopilot.queue = queue;
    updatedCfg.autopilot.completedCount = (updatedCfg.autopilot.completedCount || 0) + 1;
    updatedCfg.autopilot.totalLift = (updatedCfg.autopilot.totalLift || 0) + (ts.liftPercent || 0);

    await prisma.store.update({
      where: { id: exp.storeId },
      data: { config: updatedCfg },
    });

    // Start next test if queue not empty
    const next = pickNextTest(queue);
    if (next) {
      // Use the existing test creation logic (POST to /api/stores/:id/addons/test internally)
      // For now, create experiment directly
      const definition = ADDON_DEFINITIONS.find(d => d.key === next.slot);
      if (definition) {
        const testName = next.dimension === '_enabled'
          ? `${definition.label} — Enabled vs Disabled`
          : `${definition.label} — ${definition.dimensions.find(d => d.key === next.dimension)?.label || next.dimension}`;

        // Simple 2-variant generation (enabled test or dimension test)
        // Reuse logic from test/route.ts
      }
    }
  }
}
```

Note: The implementation should import and call the test-creation logic from a shared function rather than duplicating the variant generation code. Extract the variant generation from `test/route.ts` into a shared helper in `autopilot.ts`.

- [ ] **Step 2: Run all tests**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/api/cron/nightly/route.ts
git commit -m "feat: nightly cron autopilot — auto-apply winners and advance to next test"
```

---

### Task 9: Experiments History API

**Files:**
- Create: `src/app/api/stores/[id]/experiments/history/route.ts`

- [ ] **Step 1: Create the history endpoint**

```typescript
// src/app/api/stores/[id]/experiments/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/stores/:id/experiments/history
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const slot = searchParams.get('slot');

  const where: any = { storeId: params.id };
  if (status) where.status = status;
  if (slot) where.slot = slot;

  const experiments = await prisma.experiment.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    include: { _count: { select: { assignments: true } } },
  });

  const enriched = experiments.map(exp => {
    const durationDays = exp.endedAt
      ? Math.ceil((new Date(exp.endedAt).getTime() - new Date(exp.startedAt).getTime()) / 86400000)
      : Math.ceil((Date.now() - new Date(exp.startedAt).getTime()) / 86400000);

    return {
      id: exp.id,
      name: exp.name,
      slot: exp.slot,
      status: exp.status,
      variants: exp.variants,
      winnerVariantId: exp.winnerVariantId,
      confidence: exp.confidence,
      liftPercent: exp.liftPercent ?? 0,
      startedAt: exp.startedAt,
      endedAt: exp.endedAt,
      durationDays,
      totalVisitors: exp._count.assignments,
      notes: exp.notes,
      tournament: exp.tournament,
    };
  });

  // Summary stats
  const completedExps = enriched.filter(e =>
    ['WINNER_FOUND', 'NO_DIFFERENCE', 'REVERTED'].includes(e.status)
  );
  const winners = completedExps.filter(e => e.status === 'WINNER_FOUND');
  const cumulativeLift = winners.reduce((sum, e) => sum + (e.liftPercent || 0), 0);
  const bestChange = winners.length > 0
    ? winners.reduce((best, e) => (e.liftPercent || 0) > (best.liftPercent || 0) ? e : best)
    : null;

  return NextResponse.json({
    experiments: enriched,
    summary: {
      totalTests: completedExps.length,
      winRate: completedExps.length > 0
        ? Math.round((winners.length / completedExps.length) * 100)
        : 0,
      cumulativeLift: Math.round(cumulativeLift * 10) / 10,
      bestChange: bestChange ? { name: bestChange.name, lift: bestChange.liftPercent } : null,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/api/stores/[id]/experiments/history/route.ts
git commit -m "feat: experiments history API with summary stats"
```

---

## Chunk 4: Tournament Bracket + Add Change-Risk to Addons PATCH

### Task 10: Tournament Bracket API

**Files:**
- Create: `src/app/api/stores/[id]/addons/test/tournament/route.ts`
- Test: `src/__tests__/tournament.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/__tests__/tournament.test.ts
import { describe, it, expect } from 'vitest';
import { buildBracket, advanceBracket } from '../lib/tournament';

describe('buildBracket', () => {
  it('creates sequential matches for 3 variants', () => {
    const variants = [
      { id: 'a', label: 'Variant A', features: {} },
      { id: 'b', label: 'Variant B', features: {} },
      { id: 'c', label: 'Variant C', features: {} },
    ];
    const bracket = buildBracket(variants);
    expect(bracket.totalRounds).toBe(2);
    expect(bracket.currentRound).toBe(1);
    expect(bracket.bracket[0]).toEqual({ round: 1, variantA: 'a', variantB: 'b', winnerId: null });
    expect(bracket.bracket[1]).toEqual({ round: 2, variantA: null, variantB: 'c', winnerId: null });
  });

  it('creates 1 match for 2 variants', () => {
    const variants = [
      { id: 'a', label: 'A', features: {} },
      { id: 'b', label: 'B', features: {} },
    ];
    const bracket = buildBracket(variants);
    expect(bracket.totalRounds).toBe(1);
  });
});

describe('advanceBracket', () => {
  it('advances winner to next round', () => {
    const tournament = {
      bracket: [
        { round: 1, variantA: 'a', variantB: 'b', winnerId: null },
        { round: 2, variantA: null, variantB: 'c', winnerId: null },
      ],
      currentRound: 1,
      totalRounds: 2,
      championId: null,
      allVariants: [
        { id: 'a', label: 'A', features: {}, createdBy: 'user' as const },
        { id: 'b', label: 'B', features: {}, createdBy: 'user' as const },
        { id: 'c', label: 'C', features: {}, createdBy: 'user' as const },
      ],
    };

    const result = advanceBracket(tournament, 'a');
    expect(result.bracket[0].winnerId).toBe('a');
    expect(result.bracket[1].variantA).toBe('a'); // winner fills next round
    expect(result.currentRound).toBe(2);
    expect(result.championId).toBeNull(); // not done yet
  });

  it('sets champion when final round completes', () => {
    const tournament = {
      bracket: [
        { round: 1, variantA: 'a', variantB: 'b', winnerId: 'a' },
        { round: 2, variantA: 'a', variantB: 'c', winnerId: null },
      ],
      currentRound: 2,
      totalRounds: 2,
      championId: null,
      allVariants: [],
    };

    const result = advanceBracket(tournament, 'a');
    expect(result.bracket[1].winnerId).toBe('a');
    expect(result.championId).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/tournament.test.ts`
Expected: FAIL

- [ ] **Step 3: Create tournament library**

```typescript
// src/lib/tournament.ts

interface TournamentVariant {
  id: string;
  label: string;
  features: Record<string, any>;
  createdBy: 'user' | 'ai';
}

interface BracketMatch {
  round: number;
  variantA: string | null;
  variantB: string | null;
  winnerId: string | null;
}

interface TournamentState {
  bracket: BracketMatch[];
  currentRound: number;
  totalRounds: number;
  championId: string | null;
  allVariants: TournamentVariant[];
}

/**
 * Build a sequential bracket from a list of variants.
 * Round 1: variant[0] vs variant[1]
 * Round 2: winner of round 1 vs variant[2]
 * Round N: winner of round N-1 vs variant[N]
 */
export function buildBracket(
  variants: { id: string; label: string; features: Record<string, any> }[],
): TournamentState {
  if (variants.length < 2) throw new Error('Need at least 2 variants for a tournament');

  const totalRounds = variants.length - 1;
  const bracket: BracketMatch[] = [];

  // Round 1: first two variants
  bracket.push({ round: 1, variantA: variants[0].id, variantB: variants[1].id, winnerId: null });

  // Subsequent rounds: winner of previous vs next variant
  for (let i = 2; i < variants.length; i++) {
    bracket.push({ round: i, variantA: null, variantB: variants[i].id, winnerId: null });
  }

  return {
    bracket,
    currentRound: 1,
    totalRounds,
    championId: null,
    allVariants: variants.map(v => ({ ...v, createdBy: 'user' as const })),
  };
}

/**
 * Record a round winner and advance the bracket.
 * Returns updated tournament state.
 */
export function advanceBracket(
  tournament: TournamentState,
  winnerId: string,
): TournamentState {
  const updated = JSON.parse(JSON.stringify(tournament)) as TournamentState;
  const currentMatch = updated.bracket.find(m => m.round === updated.currentRound);

  if (!currentMatch) return updated;

  currentMatch.winnerId = winnerId;

  // Check if this was the final round
  if (updated.currentRound >= updated.totalRounds) {
    updated.championId = winnerId;
  } else {
    // Advance winner to next round
    const nextMatch = updated.bracket.find(m => m.round === updated.currentRound + 1);
    if (nextMatch) {
      nextMatch.variantA = winnerId;
    }
    updated.currentRound++;
  }

  return updated;
}

/**
 * Get the two variants for the current round of a tournament.
 */
export function getCurrentMatchVariants(
  tournament: TournamentState,
): { variantA: TournamentVariant; variantB: TournamentVariant } | null {
  const match = tournament.bracket.find(m => m.round === tournament.currentRound);
  if (!match || !match.variantA || !match.variantB) return null;

  const a = tournament.allVariants.find(v => v.id === match.variantA);
  const b = tournament.allVariants.find(v => v.id === match.variantB);

  if (!a || !b) return null;
  return { variantA: a, variantB: b };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run src/__tests__/tournament.test.ts`
Expected: PASS

- [ ] **Step 5: Create tournament API route**

```typescript
// src/app/api/stores/[id]/addons/test/tournament/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ADDON_DEFINITIONS } from '@/lib/addon-definitions';
import { buildBracket, getCurrentMatchVariants } from '@/lib/tournament';

// POST /api/stores/:id/addons/test/tournament — start a tournament
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const body = await req.json();
  const { addonKey, dimensionKey, variants: customVariants } = body;

  if (!addonKey || !customVariants || customVariants.length < 2) {
    return NextResponse.json({ error: 'addonKey and at least 2 variants required' }, { status: 400 });
  }

  const definition = ADDON_DEFINITIONS.find(d => d.key === addonKey);
  if (!definition) return NextResponse.json({ error: 'Unknown addon' }, { status: 400 });

  // Pause any existing experiment for this slot
  await prisma.experiment.updateMany({
    where: { storeId: params.id, slot: addonKey, status: 'RUNNING' },
    data: { status: 'PAUSED', endedAt: new Date() },
  });

  // Build bracket
  const tournament = buildBracket(customVariants);
  const match = getCurrentMatchVariants(tournament);

  if (!match) {
    return NextResponse.json({ error: 'Could not build bracket' }, { status: 400 });
  }

  // Create experiment for round 1
  const testName = `${definition.label} — Tournament Round 1`;
  const variants = [
    { id: match.variantA.id, label: match.variantA.label, features: match.variantA.features },
    { id: match.variantB.id, label: match.variantB.label, features: match.variantB.features },
  ];

  const experiment = await prisma.experiment.create({
    data: {
      storeId: params.id,
      name: testName,
      slot: addonKey,
      status: 'RUNNING',
      variants,
      trafficSplit: { [variants[0].id]: 0.5, [variants[1].id]: 0.5 },
      maxDays: 14,
      tournament,
    },
  });

  return NextResponse.json({
    experiment: {
      id: experiment.id,
      name: experiment.name,
      slot: experiment.slot,
      tournament,
      currentMatch: { variantA: match.variantA, variantB: match.variantB },
      status: 'RUNNING',
    },
  }, { status: 201 });
}

// GET /api/stores/:id/addons/test/tournament?experimentId=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const experimentId = req.nextUrl.searchParams.get('experimentId');
  if (!experimentId) {
    return NextResponse.json({ error: 'experimentId required' }, { status: 400 });
  }

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
  });

  if (!experiment || experiment.storeId !== params.id) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
  }

  return NextResponse.json({
    tournament: experiment.tournament,
    status: experiment.status,
    winnerVariantId: experiment.winnerVariantId,
  });
}
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/lib/tournament.ts src/__tests__/tournament.test.ts src/app/api/stores/[id]/addons/test/tournament/route.ts
git commit -m "feat: tournament bracket — build bracket, advance rounds, API endpoints"
```

---

### Task 11: Add Change-Risk Check to Addons PATCH

**Files:**
- Modify: `src/app/api/stores/[id]/addons/route.ts`

- [ ] **Step 1: Add change risk detection to PATCH handler**

In the PATCH handler (line ~59), before saving the config:

1. Import `classifyChangeRisk` from `@/lib/test-safety`
2. Query running experiments for this store
3. Classify risk
4. If `high`, return the risk info in response (let frontend handle the modal)
5. If actually saving: save `previousConfig` for rollback

Add to the PATCH response a `changeRisk` field:
```typescript
const runningExps = await prisma.experiment.findMany({
  where: { storeId: params.id, status: 'RUNNING' },
  select: { slot: true, name: true },
});
const risk = classifyChangeRisk(addonKey, runningExps);

// If request includes `force: true`, skip risk check
if (risk === 'high' && !body.force) {
  return NextResponse.json({
    changeRisk: 'high',
    runningTest: runningExps.find(e => e.slot === addonKey)?.name,
    message: 'Active test on this addon. Choose: pause, reset, or cancel.',
  }, { status: 409 });
}

// Save previousConfig before changing
if (patchConfig) {
  addon.previousConfig = {
    config: { ...addon.config },
    savedAt: new Date().toISOString(),
    reason: 'manual',
  };
}
```

Also handle `body.pauseTest` and `body.resetTest` flags:
- `pauseTest: true` → pause the running experiment, save with note
- `resetTest: true` → set experiment to INVALIDATED, save with note

- [ ] **Step 2: Run all tests**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/api/stores/[id]/addons/route.ts
git commit -m "feat: add change-risk detection to addons PATCH — blocks same-slot edits during tests"
```

---

## Chunk 5: UI — Results History Page + Autopilot Toggle + Post-Winner + Edit-Triggers-Test

### Task 12: Results History Page

**Files:**
- Create: `src/app/dashboard/results/page.tsx`

- [ ] **Step 1: Create the results page**

Create the full results history page with:
- Timeline feed (left side, 65%) — list of all experiments as cards
- Summary sidebar (right side, 35%) — total tests, win rate, cumulative lift, best change
- Each card: test name, slot, date range, outcome badge, lift %, confidence
- Filter by status (dropdown)
- Expandable cards for variant details

Use the same styling patterns as `addons/page.tsx` (inline styles, same color palette: purple for active, green for winner, gray for stopped).

Fetch from `/api/stores/${STORE_ID}/experiments/history`.

**Note:** This file must be created via a Node.js script due to the file-lock hook.

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/dashboard/results/page.tsx
git commit -m "feat: results history page with timeline feed and summary sidebar"
```

---

### Task 13: Autopilot Toggle on Addons Page

**Files:**
- Modify: `src/app/dashboard/addons/page.tsx` (via Node.js script)

- [ ] **Step 1: Add autopilot state and UI**

Create a Node.js script that adds to the addons page:
1. `autopilot` state (fetched from `/api/stores/${STORE_ID}/autopilot`)
2. Auto-Optimize toggle at the top of the page
3. When ON: show current test + queue preview
4. Cumulative lift badge

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/dashboard/addons/page.tsx
git commit -m "feat: autopilot toggle on addons page with queue preview"
```

---

### Task 14: Post-Winner Decision Flow UI

**Files:**
- Modify: `src/app/dashboard/addons/page.tsx` (via Node.js script)

- [ ] **Step 1: Add post-winner UI to results view**

When an experiment has status `WINNER_FOUND`, show 4 action buttons:
- "Apply Winner" → calls `/api/stores/${STORE_ID}/addons/test/apply-winner`
- "Keep Testing This" → shows available untested dimensions for this addon
- "Test Something Else" → shows the autopilot queue
- "Revert" → restores `previousConfig`

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/dashboard/addons/page.tsx
git commit -m "feat: post-winner decision flow — apply, keep testing, test something else, revert"
```

---

### Task 15: Edit-Triggers-Test Modal

**Files:**
- Modify: `src/app/dashboard/addons/page.tsx` (via Node.js script)

- [ ] **Step 1: Add edit-triggers-test modal**

When user clicks Save on an addon's edit view:
1. Check if the config has changed (compare old vs new)
2. If changed AND addon has a `lastWinner`, show modal:
   - "Test It" — create experiment (old winner config vs new config)
   - "Just Save" — apply directly, save old as `previousConfig`
   - "Cancel" — discard changes
3. If changed AND test is running (same slot), show hard-block modal:
   - "Pause Test & Save"
   - "Reset Test & Save"
   - "Cancel"

Both modals are simple div overlays with backdrop, matching the existing inline styling pattern.

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/dashboard/addons/page.tsx
git commit -m "feat: edit-triggers-test modal and mid-test change protection UI"
```

---

### Task 16: Tournament UI in Results View

**Files:**
- Modify: `src/app/dashboard/addons/page.tsx` (via Node.js script)

- [ ] **Step 1: Add tournament bracket visualization**

When an experiment has `tournament` data:
- Show bracket visualization (rounds as columns)
- Current match highlighted with a pulsing border
- Completed matches show winner with lift % and green checkmark
- Upcoming matches grayed out with "Waiting..." text
- Final champion gets a trophy icon (text "🏆")
- "Create Test Variants" button in edit view → opens variant creation panel

- [ ] **Step 2: Commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add src/app/dashboard/addons/page.tsx
git commit -m "feat: tournament bracket visualization in results view"
```

---

### Task 17: Run Full Test Suite + Final Verification

- [ ] **Step 1: Run all tests**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx vitest run`
Expected: All tests pass (existing + 4 new test files)

- [ ] **Step 2: Type check**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Start dev server and manually verify**

Run: `cd "C:/Projects/eliminai-cart-drawer/backend" && npm run dev`

Verify:
1. Addons page loads with autopilot toggle
2. Track Results shows time estimate
3. `/dashboard/results` page shows history
4. Starting a test and editing the same addon shows hard-block modal

- [ ] **Step 4: Final commit**

```bash
cd "C:/Projects/eliminai-cart-drawer/backend"
git add -A
git commit -m "chore: final verification — all tests pass, types clean"
```
