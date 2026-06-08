# Traffic-Tiered Trust-First Early-Stop — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CRO engine's winner-declaration logic (today split between `thompson.ts` and the nightly cron) with one pure, traffic-tiered decision module that finishes strong-and-steady tests faster, never false-calls, and works at every store scale.

**Architecture:** A new pure module `backend/src/lib/winner-decision.ts` (`decideVerdict` + tiny helpers) owns the WAIT/WINNER/NO_DIFFERENCE/INCONCLUSIVE decision. `thompson.ts` keeps all statistical computation and stops making the winner call (its blowout shortcut and extend-only consistency are removed; it exposes `dynamicLossThreshold` + `winnerCandidateId`). The nightly cron derives timeline inputs (running days, weekend coverage, visitors/day) from `DailySummary`, calls `decideVerdict`, and applies the verdict. The harm-revert circuit-breaker (`checkout-safety.ts`) is untouched and stays independent.

**Tech Stack:** TypeScript, Next.js 14 API route, Prisma (Neon Postgres), Vitest, jStat (Beta sampling). Test runner: `npm test` (= `vitest run`) from `backend/`.

**Spec:** `docs/superpowers/specs/2026-06-07-traffic-tiered-early-stop-design.md`

---

## Critical constraints (read before starting)

1. **DB-safety:** local `.env` points at the PRODUCTION Neon DB. NEVER run `prisma migrate`/`db push`/`reset`. This plan introduces **no schema changes** — `INCONCLUSIVE` is a *logical* verdict persisted as DB status `NO_DIFFERENCE` + `notes.inconclusive=true`. The `ExperimentStatus` enum (`RUNNING | WINNER_FOUND | NO_DIFFERENCE | REVERTED`) is unchanged.
2. **Git hygiene:** repo has thousands of untracked junk files. Commit by explicit file name only — NEVER `git add -A`/`git add .`. Base branch: `master`.
3. **Blast-radius-shield:** this is a refactor of shared logic with two call sites and migrating tests. Every chunk maps its blast radius and locks behavior before changing it. Existing suites that must end green: `thompson.test.ts`, `nightly-cron.test.ts`, `checkout-safety.test.ts`, plus the full suite.
4. **Harm-revert stays separate:** do not touch `checkout-safety.ts` or the `shouldRevertForCheckoutDrop(...)` block in the cron (route.ts ~176-195). Its LOCK tests must stay green untouched.
5. **No timezone field exists on Store.** Weekend coverage uses each `DailySummary.date` (stored at UTC midnight) mapped to its UTC weekday. This is an accepted approximation; do NOT add timezone handling (YAGNI).

---

## Blast Radius Map (whole feature)

**Logic being changed:** winner declaration for A/B experiments.

**Callers / sites:**
- `thompson.ts` `calculateThompsonSampling` winner block (lines ~212-269) — produces `winnerId`/`reason` today.
- `nightly/route.ts` decision block (lines ~154-174) — consumes `ts.winnerId`/`ts.reason` + `consistencyOk`.
- `thompson.ts` `calculateConsistency` (lines ~418-452) — extend-only multiplier, used by cron (route.ts:141, 152).
- **`cron/adaptive/route.ts` (HOURLY cron, 183 lines) — SECOND winner-declaration site.** Independently sets `WINNER_FOUND` from `ts.winnerId` (line ~136-139), `winnerVariantId = ts.winnerId` (~138), plus ad-hoc NO_DIFFERENCE heuristics (~140 `confidence>=0.95 && |lift|<=1`; ~143 `daysRunning>=maxDays && confidence<0.80`), and `reason: ts.reason` in results.push (~169). References removed `ts.winnerId`/`ts.reason` → breaks `tsc`. **No test file.**
- **`stores/[id]/addons/experiments/route.ts` (dashboard GET, 238 lines) — consumes `calculateConsistency`.** Imports it (line 3) alongside `calculateSampleTarget` (kept); calls `calculateConsistency(dailyLeaders)` (~71); uses `.multiplier` to inflate `adjustedTargetPerVariant` (~75) and `adjustedOrderTarget` (~79); returns display fields `consistency`/`consistencyMultiplier`/`consistencyMessage` (~167-169) consumed by the dashboard frontend. References removed function → breaks `tsc` + runtime. **No test file.**

**Duplicated logic:** the WIN/NO_DIFFERENCE decision is duplicated across **THREE** sites — thompson (statistical call), the **nightly** cron (consistency gate + string-match NO_DIFFERENCE), and the **hourly adaptive** cron (its own `ts.winnerId` + heuristic NO_DIFFERENCE). This is exactly the duplicated-logic hazard blast-radius-shield warns about. This plan makes `winner-decision.ts` the SINGLE decision authority: only the **nightly** cron declares terminal verdicts (it has the full timeline inputs — DailySummary dates, dailyLeaders, weekend coverage). The **adaptive** cron is demoted to traffic-rebalancing only (it keeps calling thompson for `trafficSplit`/`confidence`/`expectedLoss`/`liftPercent` and writes those, but no longer sets `status`/`winnerVariantId`/`endedAt`). The dashboard route drops the retired extend-only multiplier.

**Shared state written:** `experiment.status`, `winnerVariantId`, `confidence`, `liftPercent`, `trafficSplit`, `endedAt`, `notes.*`. Read by `variant-assign.ts` (only `status:'RUNNING'`) and the dashboard.

**Cross-path risk:** (1) if thompson stops setting `winnerId` but a cron still reads `ts.winnerId`, winners silently never declare AND `tsc` breaks. → Chunks 2 and 3 must land together-coherent; Chunk 3 rewires BOTH crons. (2) If the adaptive cron kept declaring winners with its weaker heuristics, it would race the nightly gated logic and undermine the trust-first goal — so it is demoted. Run the FULL suite + `tsc --noEmit` at the end of Chunk 3.

**Tests that lock current behavior:** `thompson.test.ts` (winner/blowout/consistency + statistical), `nightly-cron.test.ts` (LOCK-1..12), `checkout-safety.test.ts`. The two extra consumer files have NO tests — they are locked by `tsc --noEmit` (compile gate) plus Task 3.4's behavioral assertions where practical.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `backend/src/lib/winner-decision.ts` | Pure decision: tiers, gates, consistency credit, fallback. The single source of truth for "should this test conclude, and how." | **Create** |
| `backend/src/__tests__/winner-decision.test.ts` | Unit tests for the pure module across store scales. | **Create** |
| `backend/src/lib/thompson.ts` | Statistical computation only. Exposes `dynamicLossThreshold` + `winnerCandidateId`; removes blowout + winner block + `calculateConsistency`. | **Modify** |
| `backend/src/__tests__/thompson.test.ts` | Keep statistical tests; remove migrated winner/blowout/consistency tests. | **Modify** |
| `backend/src/app/api/cron/nightly/route.ts` | Derive timeline inputs from `DailySummary`, call `decideVerdict`, apply verdict (incl. INCONCLUSIVE→NO_DIFFERENCE+note). Harm-revert untouched. | **Modify** |
| `backend/src/__tests__/nightly-cron.test.ts` | Update mocks/LOCKs to the verdict flow; add tier/weekend/credit/fallback integration tests. | **Modify** |
| `backend/src/app/api/cron/adaptive/route.ts` | Demote to traffic-rebalancing only: keep thompson call for split/confidence/loss/lift; stop declaring `WINNER_FOUND`/`NO_DIFFERENCE` (nightly owns terminal verdicts). Drop `ts.winnerId`/`ts.reason` references. | **Modify** |
| `backend/src/app/api/stores/[id]/addons/experiments/route.ts` | Drop removed `calculateConsistency`; replace extend-only multiplier with the new consecutive-leader signal; keep dashboard field shape stable. | **Modify** |

---

## Chunk 1: The pure decision module (`winner-decision.ts`)

Self-contained. No existing behavior changes. Build and fully test in isolation.

### Task 1.1: Constants, types, and `selectTier`

**Files:**
- Create: `backend/src/lib/winner-decision.ts`
- Test: `backend/src/__tests__/winner-decision.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/winner-decision.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectTier } from '../lib/winner-decision';

describe('selectTier', () => {
  it('500 visitors/day → HIGH', () => expect(selectTier(500)).toBe('HIGH'));
  it('499 → MEDIUM', () => expect(selectTier(499)).toBe('MEDIUM'));
  it('50 → MEDIUM', () => expect(selectTier(50)).toBe('MEDIUM'));
  it('49 → LOW', () => expect(selectTier(49)).toBe('LOW'));
  it('0 → LOW', () => expect(selectTier(0)).toBe('LOW'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: FAIL — "Cannot find module '../lib/winner-decision'".

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/lib/winner-decision.ts`:

```ts
// Pure winner-decision logic for CRO A/B experiments.
// Single source of truth for whether a test concludes and how.
// See docs/superpowers/specs/2026-06-07-traffic-tiered-early-stop-design.md

export type Tier = 'HIGH' | 'MEDIUM' | 'LOW';

// Visitors/day tier thresholds
export const TIER_HIGH_MIN = 500;
export const TIER_MEDIUM_MIN = 50;

// Minimum calendar days a test must run, per tier
export const MIN_DAYS: Record<Tier, number> = { HIGH: 4, MEDIUM: 7, LOW: 7 };

export const CONFIDENCE_THRESHOLD = 0.95;
export const PRACTICAL_LIFT_FLOOR = 5;   // percent relative — below this = NO_DIFFERENCE
export const HARD_MIN_FLOOR = 15;        // never declare a winner below this many loser-arm orders
export const MAX_DAYS = 14;              // backstop cap (effective cap can only tighten)

// Consistency-credit predicate thresholds
export const CREDIT_MIN_CONSECUTIVE_DAYS = 4;
export const CREDIT_CONFIDENCE = 0.99;

// Zero-laggard guard: when the losing arm has 0 orders, liftPercent is undefined
// (collapses to 0), so we judge the leader on absolute order count instead.
export const ZERO_LAGGARD_MIN_LEADER = 8;

export function selectTier(visitorsPerDay: number): Tier {
  if (visitorsPerDay >= TIER_HIGH_MIN) return 'HIGH';
  if (visitorsPerDay >= TIER_MEDIUM_MIN) return 'MEDIUM';
  return 'LOW';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/winner-decision.ts backend/src/__tests__/winner-decision.test.ts
git commit -m "feat(cro): winner-decision tier selection + constants"
```

### Task 1.2: `countConsecutiveLeaderDays`

**Files:**
- Modify: `backend/src/lib/winner-decision.ts`
- Test: `backend/src/__tests__/winner-decision.test.ts`

- [ ] **Step 1: Write the failing test** (append to test file)

```ts
import { countConsecutiveLeaderDays } from '../lib/winner-decision';

describe('countConsecutiveLeaderDays', () => {
  const days = (ids: string[]) => ids.map((leaderId, i) => ({ date: `d${i}`, leaderId, liftPct: 0 }));

  it('returns 0 when candidate is null', () => {
    expect(countConsecutiveLeaderDays(days(['a', 'a']), null)).toBe(0);
  });
  it('counts trailing streak of the candidate', () => {
    expect(countConsecutiveLeaderDays(days(['b', 'a', 'a', 'a']), 'a')).toBe(3);
  });
  it('stops at the first mismatch from the end', () => {
    expect(countConsecutiveLeaderDays(days(['a', 'a', 'b']), 'a')).toBe(0);
  });
  it('empty history → 0', () => {
    expect(countConsecutiveLeaderDays([], 'a')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: FAIL — `countConsecutiveLeaderDays` is not exported.

- [ ] **Step 3: Write minimal implementation** (append to `winner-decision.ts`)

```ts
export interface DailyLeaderEntry {
  date: string;
  leaderId: string;
  liftPct: number;
}

// Walk dailyLeaders newest→oldest, counting while the leader equals candidateId.
// Resets to 0 on the first mismatch (or when candidate is null).
export function countConsecutiveLeaderDays(
  dailyLeaders: DailyLeaderEntry[],
  candidateId: string | null,
): number {
  if (!candidateId) return 0;
  let count = 0;
  for (let i = dailyLeaders.length - 1; i >= 0; i--) {
    if (dailyLeaders[i].leaderId === candidateId) count++;
    else break;
  }
  return count;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/winner-decision.ts backend/src/__tests__/winner-decision.test.ts
git commit -m "feat(cro): countConsecutiveLeaderDays helper"
```

### Task 1.3: `requiredEvidenceFloor` (consistency credit)

**Files:**
- Modify: `backend/src/lib/winner-decision.ts`
- Test: `backend/src/__tests__/winner-decision.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { requiredEvidenceFloor, HARD_MIN_FLOOR } from '../lib/winner-decision';

describe('requiredEvidenceFloor', () => {
  const base = {
    consecutiveLeaderDays: 4,
    confidence: 0.99,
    expectedLoss: 0.01,
    dynamicLossThreshold: 0.05,   // half = 0.025, loss 0.01 ≤ 0.025 → credit
    targetOrdersPerVariant: 30,
  };
  it('earns credit → slides to hard minimum (15)', () => {
    expect(requiredEvidenceFloor(base)).toBe(HARD_MIN_FLOOR);
  });
  it('flipping leader (consecutive<4) → no credit → full target floor', () => {
    expect(requiredEvidenceFloor({ ...base, consecutiveLeaderDays: 2 })).toBe(30);
  });
  it('confidence below 0.99 → no credit → full target floor', () => {
    expect(requiredEvidenceFloor({ ...base, confidence: 0.96 })).toBe(30);
  });
  it('loss above half-threshold → no credit → full target floor', () => {
    expect(requiredEvidenceFloor({ ...base, expectedLoss: 0.04 })).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: FAIL — `requiredEvidenceFloor` not exported.

- [ ] **Step 3: Write minimal implementation** (append)

```ts
export interface EvidenceFloorInput {
  consecutiveLeaderDays: number;
  confidence: number;
  expectedLoss: number;
  dynamicLossThreshold: number;
  targetOrdersPerVariant: number;
}

// Binary slide: a strong + steady leader earns credit and the floor drops to the
// hard minimum (15). Otherwise the full power-analysis target stands.
export function requiredEvidenceFloor(input: EvidenceFloorInput): number {
  const creditEarned =
    input.consecutiveLeaderDays >= CREDIT_MIN_CONSECUTIVE_DAYS &&
    input.confidence >= CREDIT_CONFIDENCE &&
    input.expectedLoss <= input.dynamicLossThreshold / 2;
  return creditEarned ? HARD_MIN_FLOOR : input.targetOrdersPerVariant;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/winner-decision.ts backend/src/__tests__/winner-decision.test.ts
git commit -m "feat(cro): requiredEvidenceFloor consistency-credit slide"
```

### Task 1.4: `decideVerdict` — the full gate chain

**Files:**
- Modify: `backend/src/lib/winner-decision.ts`
- Test: `backend/src/__tests__/winner-decision.test.ts`

- [ ] **Step 1: Write the failing tests** (append)

```ts
import { decideVerdict, WinnerDecisionInput } from '../lib/winner-decision';

// A fully-passing HIGH-tier input: all 6 gates satisfied, credit earned.
const PASSING: WinnerDecisionInput = {
  confidence: 0.991,
  expectedLoss: 0.01,
  liftPercent: 97,
  winnerCandidateId: 'without_addon',
  leaderOrders: 20,
  loserOrders: 16,            // ≥ HARD_MIN_FLOOR (15), credit earned
  targetOrdersPerVariant: 30,
  dynamicLossThreshold: 0.05,
  visitorsPerDay: 600,        // HIGH
  runningDays: 5,             // ≥ MIN_DAYS.HIGH (4)
  hasSaturday: true,
  hasSunday: true,
  consecutiveLeaderDays: 5,   // credit
  maxDays: 14,
};

describe('decideVerdict', () => {
  it('all gates pass → WINNER (Eleganto express replay, reduced floor)', () => {
    const v = decideVerdict(PASSING);
    expect(v.kind).toBe('WINNER');
    if (v.kind === 'WINNER') expect(v.winnerId).toBe('without_addon');
  });

  it('weekend incomplete (no Sunday) before cap → WAIT (volume cannot skip it)', () => {
    const v = decideVerdict({ ...PASSING, hasSunday: false, visitorsPerDay: 100000, confidence: 0.999, runningDays: 6 });
    expect(v.kind).toBe('WAIT');
  });

  it('below min days for HIGH (day 3) → WAIT', () => {
    expect(decideVerdict({ ...PASSING, runningDays: 3 }).kind).toBe('WAIT');
  });

  it('confidence below 0.95 → WAIT', () => {
    expect(decideVerdict({ ...PASSING, confidence: 0.90 }).kind).toBe('WAIT');
  });

  it('expected loss above threshold → WAIT', () => {
    expect(decideVerdict({ ...PASSING, expectedLoss: 0.20 }).kind).toBe('WAIT');
  });

  it('gates 1-4 pass but lift below 5% → NO_DIFFERENCE', () => {
    const v = decideVerdict({ ...PASSING, liftPercent: 0.4 });
    expect(v.kind).toBe('NO_DIFFERENCE');
  });

  it('credit NOT earned (leader flipped) + loser below full floor → WAIT', () => {
    const v = decideVerdict({ ...PASSING, consecutiveLeaderDays: 2, loserOrders: 16 });
    expect(v.kind).toBe('WAIT'); // floor is 30, loser has 16
  });

  it('zero-laggard guard: loser 0 orders, leader 18 → WINNER not NO_DIFFERENCE', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 0, leaderOrders: 18, liftPercent: 0 });
    expect(v.kind).toBe('WINNER');
  });

  it('zero-laggard boundary: loser 0, leader exactly 8 → WINNER (>= ZERO_LAGGARD_MIN_LEADER)', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 0, leaderOrders: 8, liftPercent: 0 });
    expect(v.kind).toBe('WINNER');
  });

  it('zero-laggard but leader below absolute floor (7) → WAIT not NO_DIFFERENCE', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 0, leaderOrders: 7, liftPercent: 0, consecutiveLeaderDays: 2 });
    expect(v.kind).toBe('WAIT');
  });

  it('non-zero loser at exactly the slid floor (15 with credit) → WINNER (boundary, inclusive)', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 15 });  // credit earned → floor 15
    expect(v.kind).toBe('WINNER');
  });

  it('LOW tier at cap without floor → INCONCLUSIVE', () => {
    const v = decideVerdict({
      ...PASSING, visitorsPerDay: 30, runningDays: 14, loserOrders: 5,
      consecutiveLeaderDays: 1, confidence: 0.96,
    });
    expect(v.kind).toBe('INCONCLUSIVE');
  });

  it('HIGH tier at cap without a winner → NO_DIFFERENCE backstop', () => {
    const v = decideVerdict({
      ...PASSING, runningDays: 14, loserOrders: 5, consecutiveLeaderDays: 1, confidence: 0.96,
    });
    expect(v.kind).toBe('NO_DIFFERENCE');
  });

  it('null candidate before cap → WAIT', () => {
    expect(decideVerdict({ ...PASSING, winnerCandidateId: null }).kind).toBe('WAIT');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: FAIL — `decideVerdict` / `WinnerDecisionInput` not exported.

- [ ] **Step 3: Write minimal implementation** (append)

```ts
export type Verdict =
  | { kind: 'WAIT'; reason: string }
  | { kind: 'WINNER'; winnerId: string; reason: string }
  | { kind: 'NO_DIFFERENCE'; reason: string }
  | { kind: 'INCONCLUSIVE'; reason: string };

export interface WinnerDecisionInput {
  // statistics (from thompson.ts)
  confidence: number;
  expectedLoss: number;
  liftPercent: number;
  winnerCandidateId: string | null;
  leaderOrders: number;             // orders on the leading arm (zero-laggard guard)
  loserOrders: number;              // orders on the losing arm (evidence floor)
  targetOrdersPerVariant: number;
  dynamicLossThreshold: number;
  // timeline
  visitorsPerDay: number;
  runningDays: number;
  hasSaturday: boolean;
  hasSunday: boolean;
  consecutiveLeaderDays: number;
  maxDays: number;                  // per-experiment cap; clamped to MAX_DAYS below
}

// When a gate fails: WAIT until the cap, then terminate.
// LOW tier terminates as INCONCLUSIVE (carry the current config forward);
// HIGH/MEDIUM terminate as NO_DIFFERENCE (backstop).
function unresolved(input: WinnerDecisionInput, tier: Tier, effectiveMaxDays: number, waitReason: string): Verdict {
  if (input.runningDays < effectiveMaxDays) {
    return { kind: 'WAIT', reason: waitReason };
  }
  if (tier === 'LOW') {
    return { kind: 'INCONCLUSIVE', reason: `Reached ${effectiveMaxDays}-day cap without enough data — carrying current config forward` };
  }
  return { kind: 'NO_DIFFERENCE', reason: `Reached ${effectiveMaxDays}-day cap without a clear winner` };
}

export function decideVerdict(input: WinnerDecisionInput): Verdict {
  const tier = selectTier(input.visitorsPerDay);
  const effectiveMaxDays = Math.min(input.maxDays, MAX_DAYS);

  // Gate 1: weekend coverage (irreducible) — volume/confidence can never skip it.
  if (!input.hasSaturday || !input.hasSunday) {
    return unresolved(input, tier, effectiveMaxDays, 'Need at least one Saturday and one Sunday of data');
  }
  // Gate 2: minimum calendar days per tier.
  if (input.runningDays < MIN_DAYS[tier]) {
    return unresolved(input, tier, effectiveMaxDays, `Need ${MIN_DAYS[tier]} days for ${tier} tier (day ${input.runningDays})`);
  }
  // Gate 3: confidence + a real candidate.
  if (!input.winnerCandidateId || input.confidence < CONFIDENCE_THRESHOLD) {
    return unresolved(input, tier, effectiveMaxDays, `Confidence ${(input.confidence * 100).toFixed(1)}% below ${CONFIDENCE_THRESHOLD * 100}%`);
  }
  // Gate 4: expected loss.
  if (input.expectedLoss > input.dynamicLossThreshold) {
    return unresolved(input, tier, effectiveMaxDays, `Expected loss ${input.expectedLoss.toFixed(3)}pp above ${input.dynamicLossThreshold.toFixed(3)}pp`);
  }
  const winReason = `Winner: ${(input.confidence * 100).toFixed(1)}% confidence, ${input.expectedLoss.toFixed(3)}pp loss, +${Math.abs(input.liftPercent).toFixed(1)}% lift`;

  // Zero-laggard branch: liftPercent is meaningless when the loser has 0 orders, so BOTH
  // practical significance (gate 5) and the evidence floor (gate 6) are judged on the
  // leader's absolute order count. Below the bar → WAIT (never NO_DIFFERENCE, per spec §11).
  if (input.loserOrders === 0) {
    if (input.leaderOrders >= ZERO_LAGGARD_MIN_LEADER) {
      return { kind: 'WINNER', winnerId: input.winnerCandidateId, reason: winReason };
    }
    return unresolved(input, tier, effectiveMaxDays, `Trailing variant has 0 orders; need ${ZERO_LAGGARD_MIN_LEADER} on the leader (have ${input.leaderOrders})`);
  }

  // Gate 5: practical significance (non-zero laggard).
  if (Math.abs(input.liftPercent) < PRACTICAL_LIFT_FLOOR) {
    // Gates 1-4 passed AND the variants are within the trivial band → terminal equivalence.
    return { kind: 'NO_DIFFERENCE', reason: `No meaningful difference (lift ${input.liftPercent.toFixed(1)}% at ${(input.confidence * 100).toFixed(1)}% confidence)` };
  }
  // Gate 6: evidence floor on the losing arm (consistency credit may lower it).
  const floor = requiredEvidenceFloor(input);
  if (input.loserOrders < floor) {
    return unresolved(input, tier, effectiveMaxDays, `Need ${floor} orders on the trailing variant (have ${input.loserOrders})`);
  }

  return { kind: 'WINNER', winnerId: input.winnerCandidateId, reason: winReason };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/__tests__/winner-decision.test.ts`
Expected: PASS — 14 `decideVerdict` cases plus the earlier tests (selectTier 5 + countConsecutiveLeaderDays 4 + requiredEvidenceFloor 4 = 13), for 27 tests total in the file. A mismatch in the count means a missing or extra case.

- [ ] **Step 5: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/lib/winner-decision.ts backend/src/__tests__/winner-decision.test.ts
git commit -m "feat(cro): decideVerdict traffic-tiered trust-first gate chain"
```

**End of Chunk 1.** Run the plan-document-reviewer on this chunk before proceeding.

---

## Chunk 2: `thompson.ts` surgery (expose inputs, remove the decision)

**Blast radius for this chunk:** `thompson.ts` produces `winnerId`/`reason`/`calculateConsistency`, consumed by the cron and by `thompson.test.ts`. After this chunk, thompson no longer makes the winner call. The cron is rewired in Chunk 3 — so between Chunk 2 and Chunk 3 the cron is temporarily inconsistent; do NOT ship between them. Run the full suite only at the end of Chunk 3.

### Task 2.1: Expose `dynamicLossThreshold` and `winnerCandidateId`; remove the winner block + blowout

**Files:**
- Modify: `backend/src/lib/thompson.ts` (interface ~35-51, return ~288-304, winner block ~212-269)
- Test: `backend/src/__tests__/thompson.test.ts`

- [ ] **Step 1: Update the LOCK tests first (capture the new contract)**

In `backend/src/__tests__/thompson.test.ts`:
- **Delete** these now-obsolete winner-declaration tests (the decision moved to `winner-decision.ts`, already covered there):
  - `'shifts traffic toward variant with more orders (past hard floor)'` — KEEP the traffic-split assertion but **remove** its `expect(result.winnerId).toBe('treatment')` line; the test should now assert `result.winnerCandidateId` instead (the statistical leader). Rename references accordingly.
  - `'does NOT declare winner with fewer than target orders per variant'` — DELETE (winner gating is no longer thompson's job).
  - `'declares blowout winner when leading variant meets order target even if loser has few'` — DELETE (blowout removed).
  - `'does NOT blowout before 3 days even with overwhelming data'` — DELETE.
  - In `'stays ~50/50 with very sparse order data (natural balancing)'` (test line ~78) — **remove** the `expect(result.winnerId).toBeNull()` assertion (line ~89); keep the split/statistical assertions.
  - `'detects no difference with similar order rates'` (test line ~70) has **no** `winnerId` assertion (it only checks `liftPercent`) — leave it unchanged.
- **Add** a new test for the exposed fields:

```ts
it('exposes dynamicLossThreshold and winnerCandidateId for the decision module', () => {
  const result = calculateThompsonSampling(
    [
      { id: 'control', successes: 5, failures: 195 },
      { id: 'treatment', successes: 30, failures: 170 },
    ],
    { dailyTraffic: 600, dailyOrders: 8 },
  );
  expect(typeof result.dynamicLossThreshold).toBe('number');
  expect(result.dynamicLossThreshold).toBeGreaterThan(0);
  expect(result.winnerCandidateId).toBe('treatment'); // statistical leader by mean
});
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `cd backend && npx vitest run src/__tests__/thompson.test.ts`
Expected: FAIL — `dynamicLossThreshold`/`winnerCandidateId` are undefined on the result.

- [ ] **Step 3: Implement in `thompson.ts`**

1. In the `ThompsonResult` interface (lines ~35-51): remove `winnerId: string | null;` and `reason?: string;`. Add:
```ts
  winnerCandidateId: string | null;  // statistical leader (bestId); decision made by winner-decision.ts
  dynamicLossThreshold: number;      // tier-scaled expected-loss threshold (for decideVerdict)
```
2. Delete the winner-declaration code in two sub-ranges, PRESERVING the threshold computation in between: delete lines ~212-218 (`// ── Winner declaration` header, `let winnerId`, `let reason`, `totalOrdersAll`, `maxOrdersPerArm`) and lines ~224-269 (`isBlowout` + all Gate 1-5 branches). **Keep** the `dynamicLossThreshold` computation at lines ~219-223 (`baselineLossScale`, `baseLossThreshold`, `dynamicLossThreshold`) — it now feeds the result. `bestId` (line 111), `bestMean`/`secondMean`/`liftPercent` (lines 206-210) are already outside the deleted ranges; keep them. Verify no remaining reference to `totalOrdersAll`/`maxOrdersPerArm` exists after deletion (they were used only by the blowout).
3. In the return object (lines ~288-304): remove `winnerId` and `reason`; add:
```ts
    winnerCandidateId: bestId,
    dynamicLossThreshold,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/__tests__/thompson.test.ts`
Expected: PASS (statistical + new field test; obsolete winner tests removed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/thompson.ts backend/src/__tests__/thompson.test.ts
git commit -m "refactor(cro): thompson exposes decision inputs, drops winner declaration"
```

### Task 2.2: Remove extend-only `calculateConsistency`

**Files:**
- Modify: `backend/src/lib/thompson.ts` (remove `calculateConsistency` ~418-452, `ConsistencyResult` ~59-63, `DailyLeader` ~53-57 if unused after)
- Test: `backend/src/__tests__/thompson.test.ts`

- [ ] **Step 1: Update tests**

In `thompson.test.ts`: delete the entire `describe('calculateConsistency', ...)` block (4 tests) and remove `calculateConsistency` from the import on line 2. The extend-only behavior is replaced by the credit slide in `winner-decision.ts` (already tested there).

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npx vitest run src/__tests__/thompson.test.ts`
Expected: PASS (the deleted tests are gone) — but `tsc` will still see `calculateConsistency` exported & referenced by the cron. That's fixed in Chunk 3. Do NOT run `tsc` across the whole project yet.

- [ ] **Step 3: Remove the function**

In `thompson.ts`: delete `export function calculateConsistency(...)` (~418-452) and the now-unused `ConsistencyResult` interface (~59-63). Keep `DailyLeader` only if still referenced; otherwise delete it (the cron's daily-leader shape is local).

- [ ] **Step 4: Verify the thompson test file passes in isolation**

Run: `cd backend && npx vitest run src/__tests__/thompson.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/thompson.ts backend/src/__tests__/thompson.test.ts
git commit -m "refactor(cro): remove extend-only calculateConsistency (superseded by credit slide)"
```

**End of Chunk 2.** The project does NOT typecheck yet (cron still imports `calculateConsistency` and reads `ts.winnerId`). This is expected and fixed in Chunk 3. Run the plan-document-reviewer on this chunk before proceeding.

---

## Chunk 3: Wire the cron to `decideVerdict`

This is the integration. It derives the new timeline inputs, replaces the decision block, and maps verdicts to DB status. The harm-revert block stays untouched.

### Task 3.1: Derive timeline inputs from `DailySummary`

**Files:**
- Modify: `backend/src/app/api/cron/nightly/route.ts`
- Test: `backend/src/__tests__/nightly-cron.test.ts`

**Context:** `DailySummary` has rows per `(experimentId, variantId, date)` where `date` is yesterday at UTC midnight (written in cron step 2). To get RUNNING days + weekend coverage, query distinct `date` values for the experiment. Visitors/day = the existing `dailyTraffic` (route.ts:91).

- [ ] **Step 1: Add the prisma mock + a failing integration test**

In `nightly-cron.test.ts`:
1. **Replace** the existing `dailySummary: { upsert: vi.fn() }` line (~line 44) — do NOT add a second `dailySummary` key (duplicate object keys silently overwrite). The line becomes:
```ts
    dailySummary: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
```
2. Add a helper to fabricate summary dates and a test asserting weekend coverage is required even when stats are conclusive:
```ts
function mockSummaryDates(isoDates: string[]) {
  (prisma.dailySummary.findMany as any).mockResolvedValue(
    isoDates.map(d => ({ date: new Date(d + 'T00:00:00Z') })),
  );
}

it('LOCK-3b: stays RUNNING when weekend not yet covered, even with a strong winner', async () => {
  // Conclusive stats but only weekdays observed → must WAIT.
  (calculateThompsonSampling as any).mockReturnValue({
    ...DEFAULT_TS_RESULT, confidence: 0.99, expectedLoss: 0.01, liftPercent: 90,
    winnerCandidateId: 'treatment', dynamicLossThreshold: 0.05, targetOrdersPerVariant: 30,
    orderRates: { control: 0.05, treatment: 0.09 },
  });
  mockEventGroupBy(4000, 800, 40);                    // HIGH tier
  mockSummaryDates(['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05']); // Mon-Fri
  const POST = await getHandler();
  await POST(makeRequest('test-secret-123'));
  const update = (prisma.experiment.update as any).mock.calls[0][0];
  expect(update.data.status).toBe('RUNNING');
});

it('LOCK-3c: brand-new experiment with empty DailySummary stays RUNNING', async () => {
  // No summary rows yet → runningDays 0, no weekend → WAIT regardless of stats.
  (calculateThompsonSampling as any).mockReturnValue({
    ...DEFAULT_TS_RESULT, confidence: 0.99, expectedLoss: 0.01, liftPercent: 90,
    winnerCandidateId: 'treatment', dynamicLossThreshold: 0.05, targetOrdersPerVariant: 30,
  });
  mockEventGroupBy(4000, 800, 40);
  (prisma.dailySummary.findMany as any).mockResolvedValue([]); // none yet (default, explicit here)
  const POST = await getHandler();
  await POST(makeRequest('test-secret-123'));
  const update = (prisma.experiment.update as any).mock.calls[0][0];
  expect(update.data.status).toBe('RUNNING');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/__tests__/nightly-cron.test.ts`
Expected: FAIL (cron does not yet derive weekend coverage; also still references removed thompson exports → may error on import). Acceptable — this drives Step 3.

- [ ] **Step 3: Implement derivation in `route.ts`**

After `dailyTraffic` is computed (~line 91), and before the decision, add:

```ts
// Derive RUNNING-day timeline from DailySummary (one row-set per active date).
const summaryRows = await prisma.dailySummary.findMany({
  where: { experimentId: exp.id },
  select: { date: true },
  distinct: ['date'],
});
const runningDates = summaryRows.map(r => new Date(r.date));
const runningDays = runningDates.length;
const hasSaturday = runningDates.some(d => d.getUTCDay() === 6);
const hasSunday = runningDates.some(d => d.getUTCDay() === 0);
```

(Leave the existing `daysRunning` on line ~101 in place for now — it still feeds `minDaysRunning` into thompson, which no longer gates on it; it is removed in Task 3.3. Do not break the call yet.)

- [ ] **Step 4: Run tests**

Run: `cd backend && npx vitest run src/__tests__/nightly-cron.test.ts`
Expected: still failing on the decision wiring (Task 3.2), but the import/derivation compiles. If the import of `calculateConsistency` errors, that's resolved in Task 3.2 — proceed.

- [ ] **Step 5: Commit (WIP, compiles after 3.2)**

Defer commit until Task 3.2 lands so the file is coherent. Skip commit here.

### Task 3.2: Replace the decision block with `decideVerdict`

**Files:**
- Modify: `backend/src/app/api/cron/nightly/route.ts` (imports line ~3-5; decision block ~119-174; notes ~208-217)
- Test: `backend/src/__tests__/nightly-cron.test.ts`

- [ ] **Step 1: Write/adjust the failing integration tests**

In `nightly-cron.test.ts`, update the Thompson mock shape used everywhere to the new contract (replace `winnerId` with `winnerCandidateId`, add `dynamicLossThreshold`). Update `DEFAULT_TS_RESULT`:
```ts
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
```
Update the thompson mock: delete `calculateConsistency: vi.fn()...` from the `vi.mock('../lib/thompson', ...)` block (line ~54). Add a mock for the new `winner-decision` import is NOT needed — the cron uses the real `decideVerdict`/`countConsecutiveLeaderDays` (pure functions, fully tested in Chunk 1); let them run for real so the integration tests exercise the actual gate logic.

**Migrate EVERY inline Thompson mock in the file to the new shape** (replace `winnerId` → `winnerCandidateId`, add `expectedLoss` + `dynamicLossThreshold` + `targetOrdersPerVariant`), and give every test that should reach a terminal verdict a `mockSummaryDates([...])` call with enough RUNNING days for its tier AND a Saturday + Sunday. The inline mocks that MUST be migrated (do not miss any): LOCK-3 (~line 181), LOCK-4 (~line 209), LOCK-5 (~line 242), LOCK-5b "WINNER_FOUND takes priority over maxDays" (~line 270), and BOTH autopilot tests (~lines 514 and 549) — the autopilot tests are load-bearing (they assert `progressAutopilot` runs on a WINNER), so they must produce a real WINNER verdict (weekend-covered dates + loserOrders via `mockEventGroupBy` ≥ floor). Rewrite LOCK-3/4/5 to the verdict model:
- **LOCK-3 (WINNER):** strong stats + weekend covered + enough orders → `status === 'WINNER_FOUND'`, `winnerVariantId === 'treatment'`.
- **LOCK-4 (NO_DIFFERENCE):** gates 1-4 pass, lift < 5% → `status === 'NO_DIFFERENCE'`.
- **LOCK-5 (cap backstop):** runningDays at cap, no winner, HIGH/MED → `NO_DIFFERENCE`; add a LOW-tier variant asserting `NO_DIFFERENCE` in DB **and** `notes.inconclusive === true`.
- **New: consistency credit** — steady leader (provide `notes.dailyLeaders` of 5 same-leader days), loser orders 16, conf 0.99, loss 0.01 → `WINNER_FOUND` (floor slid to 15).
- **New: harm-revert independence** — verdict would be WAIT but a real checkout cliff → `REVERTED` (reuse existing LOCK-6 fixture; assert it still fires).

Each WINNER/NO_DIFFERENCE test must set `mockSummaryDates([...])` including a Saturday + Sunday and enough days for the tier. Example weekend-covered set spanning a Sat/Sun: `['2026-06-01'...'2026-06-07']` (2026-06-06 is Sat, 2026-06-07 is Sun).

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run src/__tests__/nightly-cron.test.ts`
Expected: FAIL — cron still uses old `ts.winnerId`/`consistencyOk`/string-match.

- [ ] **Step 3: Implement in `route.ts`**

1. Imports (line ~3): change
```ts
import { calculateThompsonSampling, buildCrossStorePriors, calculateSampleTarget, calculateConsistency } from '@/lib/thompson';
```
to
```ts
import { calculateThompsonSampling, buildCrossStorePriors } from '@/lib/thompson';
import { decideVerdict, countConsecutiveLeaderDays, MAX_DAYS } from '@/lib/winner-decision';
```
(`calculateSampleTarget` was only used for the `adjustedTarget`/consistency multiplier, which is removed — see below.)

2. Keep the daily-leader tracking (lines ~119-138) — it still records `dailyLeaders` into notes. **Remove** `const consistency = calculateConsistency(...)` (line 141) and the `calculateSampleTarget`/`adjustedTarget` block (lines ~143-152).

3. Replace the decision block (lines ~154-174) with:
```ts
// Decision — single source of truth in winner-decision.ts
let newStatus = exp.status;
let winnerVariantId = exp.winnerVariantId;
let endedAt = exp.endedAt;
let inconclusive = false;

const candidateId = ts.winnerCandidateId;
const leaderOrders = candidateId
  ? (variantStats.find(v => v.id === candidateId)?.successes ?? 0)
  : 0;
const loserOrders = Math.min(...variantStats.map(v => v.successes));
const consecutiveLeaderDays = countConsecutiveLeaderDays(dailyLeaders, candidateId);

const verdict = decideVerdict({
  confidence: ts.confidence,
  expectedLoss: ts.expectedLoss,
  liftPercent: ts.liftPercent,
  winnerCandidateId: candidateId,
  leaderOrders,
  loserOrders,
  targetOrdersPerVariant: ts.targetOrdersPerVariant,
  dynamicLossThreshold: ts.dynamicLossThreshold,
  visitorsPerDay: dailyTraffic,
  runningDays,
  hasSaturday,
  hasSunday,
  consecutiveLeaderDays,
  maxDays: exp.maxDays ?? MAX_DAYS,   // nullish guard — decideVerdict clamps to MAX_DAYS internally
});

if (verdict.kind === 'WINNER') {
  newStatus = 'WINNER_FOUND';
  winnerVariantId = verdict.winnerId;
  endedAt = new Date();
} else if (verdict.kind === 'NO_DIFFERENCE') {
  newStatus = 'NO_DIFFERENCE';
  endedAt = new Date();
} else if (verdict.kind === 'INCONCLUSIVE') {
  // No INCONCLUSIVE enum value — persist as NO_DIFFERENCE + a note flag.
  newStatus = 'NO_DIFFERENCE';
  endedAt = new Date();
  inconclusive = true;
}
// verdict.kind === 'WAIT' → leave RUNNING
```

4. In the `notes` object of `experiment.update` (lines ~208-217): remove `consistencyMultiplier`, `consistencyMessage`, `sampleTargetPerVariant`. Keep `dailyLeaders`. Add:
```ts
          verdict: verdict.kind,
          verdictReason: verdict.reason,
          inconclusive,
```
Set `confidence`/`expectedLoss`/`liftPercent`/`trafficSplit` from `ts` exactly as before.

5. The harm-revert block (lines ~176-195) stays exactly as-is, AFTER this decision (so a real cliff overrides any verdict by setting `REVERTED`).

6. Fix the `results.push({ ... })` object (lines ~238-254). Three of its fields reference symbols removed in Chunk 2 / step 2 above and will fail `tsc` otherwise:
   - `reason: ts.reason,` → `reason: verdict.reason,` (`ThompsonResult.reason` was removed in Chunk 2; the verdict now owns the human-readable reason).
   - `consistency: consistency.score,` → **delete this line** (`calculateConsistency` was removed in step 2).
   - `sampleTarget: adjustedTarget,` → **delete this line** (`adjustedTarget`/`calculateSampleTarget` was removed in step 2).
   Leave all other `results.push` fields untouched.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && npx vitest run src/__tests__/nightly-cron.test.ts`
Expected: PASS (rewritten LOCKs + new credit/fallback/harm-revert tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/api/cron/nightly/route.ts backend/src/__tests__/nightly-cron.test.ts
git commit -m "feat(cro): cron uses decideVerdict (tiers, weekend, credit, fallback)"
```

### Task 3.3: INCONCLUSIVE carries config forward; clean up dead `daysRunning`/`minDaysRunning`

**Files:**
- Modify: `backend/src/app/api/cron/nightly/route.ts`
- Test: `backend/src/__tests__/nightly-cron.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `nightly-cron.test.ts` — when verdict is INCONCLUSIVE and autopilot is enabled, `progressAutopilot` is called so the autopilot engine carries the current (control) config forward and advances the queue (it does NOT force-apply a winner on a terminal non-winner; the test below is **what already happens for any terminal non-winner status** — no new wiring is added). The collected data still feeds future cross-store priors via `buildCrossStorePriors`, but no config is force-applied. Assert the cron still reaches the terminal autopilot branch with `status:'NO_DIFFERENCE'` and `inconclusive:true` persisted:
```ts
it('INCONCLUSIVE (LOW tier at cap) persists NO_DIFFERENCE + inconclusive flag and progresses autopilot', async () => {
  (calculateThompsonSampling as any).mockReturnValue({
    ...DEFAULT_TS_RESULT, confidence: 0.96, liftPercent: 3,
    winnerCandidateId: 'treatment', dynamicLossThreshold: 0.15, targetOrdersPerVariant: 30,
    orderRates: { control: 0.02, treatment: 0.021 },
  });
  mockEventGroupBy(200, 30, 5);                       // LOW tier (~28/day)
  mockSummaryDates([ /* 14 distinct dates incl a Sat+Sun */ ]);
  // ...set startedAt 14d ago, autopilot enabled in store.config...
  const POST = await getHandler();
  await POST(makeRequest('test-secret-123'));
  const update = (prisma.experiment.update as any).mock.calls[0][0];
  expect(update.data.status).toBe('NO_DIFFERENCE');
  expect(update.data.notes.inconclusive).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure / confirm behavior**

Run: `cd backend && npx vitest run src/__tests__/nightly-cron.test.ts`
Expected: the `inconclusive` flag assertion fails if not persisted, or passes if Task 3.2 already covers it. If 3.2 already persists the flag, this test will pass immediately — keep it as a regression lock.

- [ ] **Step 3: Implement remaining cleanup**

1. The terminal-autopilot block (lines ~221-236) already runs for any terminal status including the INCONCLUSIVE→NO_DIFFERENCE mapping; verify `terminal` includes `NO_DIFFERENCE` (it does). **No new wiring is added — this is purely a confirmation step.** On a terminal non-winner the autopilot engine (`autopilot-engine.ts` `planNextAction`) carries the current config forward and advances the queue; it sets `apply` only for `WINNER_FOUND`, so NO winner config is force-applied for INCONCLUSIVE. Confirm `progressAutopilot` already handles `status:'NO_DIFFERENCE'` (it does). Do not assert or build any "cross-store default apply" capability here — it does not exist.
2. Remove now-dead code: `const daysRunning = ...` (line ~101) and the `minDaysRunning: daysRunning` option passed to `calculateThompsonSampling` (line ~115) — thompson no longer gates on days. Also drop the `dailyOrders`/`minDaysRunning` plumbing only if unused; KEEP `dailyOrders` (still used by thompson's hard floor). Verify with `tsc`.

- [ ] **Step 4: Full typecheck + full suite**

Run: `cd backend && npx tsc --noEmit`
Expected: clean (no references to removed `winnerId`/`reason`/`calculateConsistency`).

Run: `cd backend && npm test`
Expected: ALL suites green (winner-decision, thompson, nightly-cron, checkout-safety, and the rest).

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/api/cron/nightly/route.ts backend/src/__tests__/nightly-cron.test.ts
git commit -m "feat(cro): INCONCLUSIVE carries config forward; drop dead day-gating plumbing"
```

### Task 3.4: Fix the two out-of-plan thompson consumers (blast-radius closure)

**Files:**
- Modify: `backend/src/app/api/cron/adaptive/route.ts`
- Modify: `backend/src/app/api/stores/[id]/addons/experiments/route.ts`

**Context:** Chunk 2 removed `ThompsonResult.winnerId`/`ThompsonResult.reason` and the `calculateConsistency` export. Two production files outside the original plan still reference them and will fail `tsc --noEmit`. Neither has a test file. The fix consolidates decision authority into the nightly cron (single source of truth) and retires the extend-only multiplier on the dashboard.

#### 3.4a — `cron/adaptive/route.ts`: demote to traffic-rebalancing only

The adaptive (hourly) cron must STOP independently declaring winners. The nightly cron — which has the full timeline inputs (DailySummary dates, dailyLeaders, weekend coverage) — is the only place `decideVerdict` runs. The adaptive cron keeps doing the one thing it is uniquely good at: frequent traffic rebalancing toward the live leader during exploration.

- [ ] **Step 1: Implement**

1. The `calculateThompsonSampling(...)` call stays — it still yields `trafficSplit`, `confidence`, `expectedLoss`, `liftPercent`, all valid for live rebalancing and dashboard display.
2. **Delete** the winner/NO_DIFFERENCE declaration block (~lines 132-146): the `let newStatus`/`let winnerVariantId`/`let endedAt` machinery, the `if (ts.winnerId) { ... } else if (ts.confidence >= 0.95 && Math.abs(ts.liftPercent) <= 1) { ... } else if (daysRunning >= exp.maxDays && ts.confidence < 0.80) { ... }` chain.
3. The `prisma.experiment.update` (~149-160) keeps `confidence`, `expectedLoss`, `liftPercent`, `trafficSplit` only. **Remove** `status`, `winnerVariantId`, `endedAt` from its `data` (the experiment stays `RUNNING`; the nightly cron flips it terminal). Since the `where` already filters `status: 'RUNNING'`, never writing a terminal status here is correct.
4. In `results.push` (~162-172): **delete** `reason: ts.reason,` and the `status: newStatus,` line. Keep `confidence`, `expectedLoss`, `slot`, `store`, `dailyTraffic`, `batchInterval`, `experimentId`.
5. `daysRunning` (~116) becomes unused once the heuristic chain is deleted — remove it to keep `tsc` clean (it is computed only for that chain). Leave the `dailyOrders`/`priors`/`trafficTier` plumbing (still feeds thompson).

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no `ts.winnerId`/`ts.reason` errors from this file.

#### 3.4b — `stores/[id]/addons/experiments/route.ts`: drop the retired multiplier

- [ ] **Step 1: Implement**

1. Import (line 3): change `import { calculateSampleTarget, calculateConsistency } from '@/lib/thompson';` to `import { calculateSampleTarget } from '@/lib/thompson';` and add `import { countConsecutiveLeaderDays, CREDIT_MIN_CONSECUTIVE_DAYS } from '@/lib/winner-decision';`.
2. Replace `const consistency = calculateConsistency(dailyLeaders);` (~line 71) with a lightweight consecutive-leader signal using the new helper. The route already has `dailyLeaders` from `expNotes.dailyLeaders`; the most-recent leader is `dailyLeaders[dailyLeaders.length - 1]?.leaderId ?? null`:
```ts
const recentLeaderId = dailyLeaders.length ? dailyLeaders[dailyLeaders.length - 1].leaderId : null;
const consecutiveLeaderDays = countConsecutiveLeaderDays(dailyLeaders, recentLeaderId);
const consistencyScore = Math.min(1, consecutiveLeaderDays / CREDIT_MIN_CONSECUTIVE_DAYS);
const consistencyMessage = consecutiveLeaderDays >= CREDIT_MIN_CONSECUTIVE_DAYS
  ? `Same leader ${consecutiveLeaderDays} days running`
  : 'Leader still stabilizing';
```
3. **Remove the extend-only inflation.** The old model MULTIPLIED targets up when results were jumpy; the new credit model only ever LOWERS the floor, so the dashboard target is just the base power-analysis number:
   - `const adjustedTargetPerVariant = sampleTarget.nPerVariant;` (drop `* consistency.multiplier` and the `Math.ceil`).
   - `const adjustedOrderTarget = targetOrdersPerVariant;` (drop `* consistency.multiplier`).
   (Keep whatever clamps already exist around these other than the multiplier.)
4. Keep the dashboard response field shape stable so the frontend does not break:
   - `consistency: consistencyScore,`
   - `consistencyMultiplier: 1,` (retired — always 1, no extension)
   - `consistencyMessage,`
   Replace the old `consistency.score` / `consistency.multiplier` / `consistency.message` references with these.

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: clean — no `calculateConsistency` reference remains anywhere in the repo.

- [ ] **Step 3: Full suite + grep guard**

Run: `cd backend && npm test`
Expected: full suite green (no behavior change to tested paths).

Run a final grep to PROVE no stragglers reference removed symbols:
- `Grep "ts\.winnerId|ts\.reason|calculateConsistency"` across `backend/src` → expect ZERO matches.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/api/cron/adaptive/route.ts "backend/src/app/api/stores/[id]/addons/experiments/route.ts"
git commit -m "fix(cro): consolidate winner authority — adaptive cron rebalances only; dashboard drops extend-only multiplier"
```

**End of Chunk 3.** Run the plan-document-reviewer, then the final code-reviewer over the whole feature.

---

## Final verification (after all chunks)

- [ ] `cd backend && npx tsc --noEmit` → clean
- [ ] `cd backend && npm test` → full suite green
- [ ] Manually re-read the diff of `route.ts` to confirm the harm-revert block is byte-for-byte unchanged.
- [ ] Confirm no `prisma migrate`/`db push` was run and `prisma/schema.prisma` is unchanged.
- [ ] Use superpowers:finishing-a-development-branch to integrate.

## Notes for the implementer

- DRY: the tier thresholds, floors, and day minimums live ONLY in `winner-decision.ts`. Do not re-hardcode `500`/`50`/`15` in the cron.
- YAGNI: no `INCONCLUSIVE` enum, no timezone handling, no continuous credit slide. If a reviewer asks for these, push back with the spec's rationale.
- TDD: every task is red→green→commit. Do not write implementation before the failing test.
- The deploy step (`cd backend && railway up --ci`) is intentionally NOT in this plan — deploying is the user's call after review.
