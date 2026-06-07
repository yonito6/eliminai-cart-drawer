# Traffic-Tiered, Trust-First Early-Stop for the CRO Engine

**Date:** 2026-06-07
**Status:** Approved (design) — pending spec review + user sign-off
**Author:** Claude (with Yonit)
**Related:** `2026-06-03-continuous-cro-optimization-design.md`, `backend/src/lib/thompson.ts`, `backend/src/app/api/cron/nightly/route.ts`, `backend/src/lib/checkout-safety.ts`

---

## 1. Problem

The CRO engine runs A/B tests on cart addons and uses Thompson Sampling to decide a winner. Two real problems with the current winner-declaration logic:

1. **It does not get faster when the evidence is strong and steady.** The `calculateConsistency` function can only *extend* a test (multiplying the required sample target up by 1.5× or 2× when the daily leader keeps flipping). It can never *shorten* a test when the same variant wins decisively every single day. So a store with an obvious winner waits just as long as a store with a coin-flip.

2. **The gates are not tuned per store size, and they live in two places.** The current rules are split between the winner block in `thompson.ts` (lines ~212-269) and the `consistencyOk` gate in `nightly/route.ts` (line ~160). A tiny store can run forever without ever concluding; a huge store can flip the cart on a difference that is statistically real but commercially meaningless (e.g. a 0.4% relative lift).

We want one rule set that:
- **Trusts its calls** — roughly a 1-in-20 false-positive budget, never worse.
- **Finishes strong tests fast** — if the same variant dominates day after day, conclude early.
- **Never false-calls** — weekend coverage and an evidence floor are irreducible.
- **Works at every store scale** — from <50 visitors/day to thousands.

### Concrete grounding (Eleganto express-checkout test, live)

| Variant | Orders | Visitors | Order rate |
|---|---|---|---|
| `with_addon` | 11 | 3143 | 0.350% |
| `without_addon` | 20 | 3148 | 0.635% |

Bayesian confidence 0.991, lift ~97% relative. This is a HIGH-traffic store with a steady leader, yet today's logic keeps it running because the laggard arm has not reached the order floor (~30). Under the new design, a steady leader at high confidence with tiny expected loss should be allowed to conclude at a *reduced* floor (toward 15), after weekend coverage — finishing this test days sooner without sacrificing trust.

---

## 2. Goals & Non-Goals

### Goals
- A single, testable decision function that returns a verdict given the experiment's statistics and timeline.
- Three traffic tiers with hard, documented thresholds.
- A consistency *credit* that can shorten a test (the inverse of today's extend-only behavior).
- A practical-significance floor so big stores don't chase trivial lifts.
- A small-store fallback so tiny stores conclude (as inconclusive) instead of running forever.
- Full blast-radius coverage: existing `thompson.ts` and `nightly-cron` tests must stay green.

### Non-Goals
- Changing the statistical core (Beta sampling, confidence, expected loss, sample-target power analysis). Those computations stay in `thompson.ts`.
- Changing the harm-revert circuit-breaker (`checkout-safety.ts`). It stays separate and can fire fast — reverting to the known-safe baseline is itself safe, so it is not bound by the win gates below.
- Changing how variants are assigned or how events are attributed.
- Multi-armed (>2 variant) early-stop tuning beyond what already exists.

---

## 3. Definitions

- **Visitors/day** — mean cart-open sessions per calendar day over the experiment's running window. Used only to pick the tier.
- **Tier** — HIGH (≥500 visitors/day), MEDIUM (50–499), LOW (<50).
- **Confidence** — `P(best variant > second variant)` from Thompson sampling (existing).
- **Expected loss** — Spotify-method expected regret of picking the current leader, in percentage points (existing).
- **liftPercent** — relative difference in order rate between leader and laggard (existing).
- **targetOrdersPerVariant** — order count per arm from the power analysis (existing `calculateSampleTarget`), the natural "full evidence" floor (~30 in the express case).
- **Evidence floor** — the minimum orders required on the *losing* arm before a win can be declared. Slides between `targetOrdersPerVariant` (full) and a hard minimum (15) based on consistency credit.
- **Consistency credit** — how much the evidence floor may be reduced, earned by a steady daily leader at high confidence with tiny loss.
- **Weekend coverage** — the running window includes at least one Saturday AND at least one Sunday (store-local time).

---

## 4. Tier Table

| Tier | Visitors/day | Min calendar days | Base loss threshold | Practical-significance floor |
|---|---|---|---|---|
| HIGH | ≥ 500 | 4 | 0.05 | \|liftPercent\| ≥ 5% |
| MEDIUM | 50–499 | 7 | 0.10 | \|liftPercent\| ≥ 5% |
| LOW | < 50 | 7 | 0.15 | \|liftPercent\| ≥ 5% |

Notes:
- Min days are calendar days since `startedAt`, counting only days the test was actually RUNNING.
- Base loss threshold is the existing tier value, scaled by `baselineLossScale` exactly as today (the design keeps `dynamicLossThreshold = baseLossThreshold × baselineLossScale`).
- The practical-significance floor is the same 5% for all tiers — it protects against commercially meaningless wins regardless of scale.

---

## 5. The Win Decision (all gates must pass)

A WINNER is declared only if **every** gate passes. There are **no overrides** — high volume or high confidence can never skip a gate. The current code's "blowout shortcut" (a 3-day early call when `confidence ≥ 0.995`, thompson.ts ~lines 230-245) is **removed**; the consistency-credit slide (Section 6) is the single, unified early-stop path. There must not be two competing early-stop mechanisms.

1. **Weekend coverage (irreducible).** Window spans ≥1 Saturday AND ≥1 Sunday. If not, WAIT — regardless of volume or confidence.
2. **Min calendar days (per tier).** Running days ≥ tier minimum. Else WAIT.
3. **Confidence.** `confidence ≥ 0.95`. Else WAIT.
4. **Expected loss.** `expectedLoss ≤ dynamicLossThreshold` (tier-scaled). Else WAIT.
5. **Practical significance.** `|liftPercent| ≥ 5%`. If confidence/loss say "different" but lift is below 5%, the verdict is **NO_DIFFERENCE** (the two variants are commercially equivalent), not a winner.
6. **Evidence floor.** Orders on the *losing* arm ≥ `requiredFloor`, where `requiredFloor` is computed by the consistency-credit slide (Section 6). Else WAIT.

If gates 1–4 pass but gate 5 fails → **NO_DIFFERENCE** (auto-kill, see Section 7).
If gate 5 passes but gate 6 fails → WAIT (need more orders on the laggard).

## 6. Consistency Credit — the "smart" part

The evidence floor slides between full and minimum based on how trustworthy the lead is:

```
hardMinFloor   = 15                       // never below this
fullFloor      = targetOrdersPerVariant   // from power analysis (~30)

creditEarned   = (consecutiveLeaderDays >= 4)
              && (confidence >= 0.99)
              && (expectedLoss <= dynamicLossThreshold / 2)

requiredFloor  = creditEarned ? hardMinFloor : fullFloor
```

- **`consecutiveLeaderDays`** — the number of consecutive most-recent days the *same* variant was the daily leader. Resets to 0 on any flip. **Ownership:** a new small pure helper `countConsecutiveLeaderDays(dailyLeaders, candidateId)` lives in `winner-decision.ts` and is called by the cron, which already holds `notes.dailyLeaders`. It walks `dailyLeaders` from the most recent entry backward, counting while `leaderId === candidateId`, stopping at the first mismatch. With <1 matching entry it returns 0 (→ no credit, full floor).
- Strong + steady (≥4 straight days, ≥0.99 confidence, loss ≤ half the threshold) → finish at the hard minimum (15). This is what lets the Eleganto express test (steady, 0.991 confidence) conclude days sooner.
- Noisy or merely-good (leader flips, or confidence 0.95–0.99) → grind all the way to the full power-analysis floor (~30).

This is the inverse of today's extend-only `calculateConsistency`: a steady leader now *earns* a shorter test, while a flipping leader still gets no shortcut.

> Design choice: credit is binary (full floor or hard-min) rather than a continuous slide, to keep the rule auditable and the tests deterministic. A continuous slide was considered and rejected as harder to reason about for a 1-in-20 trust budget.

## 7. NO_DIFFERENCE auto-kill

When gates 1–4 pass but practical significance (gate 5) fails — confidence is high that the variants are *the same within 5%* — the test is concluded as **NO_DIFFERENCE**:
- No winner is set; the addon keeps its current (control) configuration.
- The experiment terminates (frees the test slot for the next addon) instead of running to the order floor for a difference that doesn't exist.

This is distinct from a WIN and from a WAIT. It is a terminal, "we learned they're equivalent" outcome.

## 8. Small-store fallback & max-duration cap

For LOW-tier stores that may never accumulate enough orders:

- **Max duration cap.** `maxDays = 14` running days. At the cap, the test terminates regardless of floor.
- **Carry-forward fallback.** If, at the cap, the evidence floor was never met (laggard arm < requiredFloor), the engine ends the test as **INCONCLUSIVE**: it keeps the current (control) configuration and frees the slot, rather than guessing from thin local data or running forever. The accumulated local data still feeds `buildCrossStorePriors`, so the *next* experiment for this slot (here or on any store) starts with a better Bayesian prior — but no cross-store config is force-applied on this terminal. (Verified: the autopilot engine applies a config only on `WINNER_FOUND`; on any non-winner terminal it carries the current config forward and advances the queue.)
- INCONCLUSIVE has no DB enum value; it is persisted as DB status `NO_DIFFERENCE` plus `notes.inconclusive = true` so the audit trail distinguishes "ran out of data" from "proven equivalent." No schema migration.
- HIGH/MEDIUM tiers also honor `maxDays = 14` as a backstop, but in practice they conclude on the gates well before the cap.

## 9. Harm-revert stays separate

The nightly checkout-safety circuit-breaker (`shouldRevertForCheckoutDrop`, fixed in commit 3a54662) is **not** governed by the win gates. Reverting to the known-good baseline is a safe action, so it may fire quickly on a real ≥30% checkout-rate cliff (with ≥50 sessions). The win gates above only govern *declaring a winner / concluding a test*, never *reverting for harm*. The two systems run independently in the nightly cron.

---

## 10. Architecture

### New pure module: `backend/src/lib/winner-decision.ts`

Consolidates all gate logic that is today split between `thompson.ts` (winner block) and `nightly/route.ts` (`consistencyOk` gate). A single pure function:

```ts
export type Verdict =
  | { kind: 'WAIT'; reason: string }
  | { kind: 'WINNER'; winnerId: string; reason: string }
  | { kind: 'NO_DIFFERENCE'; reason: string }
  | { kind: 'INCONCLUSIVE'; reason: string };   // small-store fallback at cap

export interface WinnerDecisionInput {
  // statistics (from thompson.ts ThompsonResult)
  confidence: number;
  expectedLoss: number;
  liftPercent: number;
  winnerCandidateId: string | null;     // leader the stats point to
  loserOrders: number;                  // orders on the losing arm
  targetOrdersPerVariant: number;       // power-analysis floor
  dynamicLossThreshold: number;         // tier-scaled; NEW field on ThompsonResult (today a thompson.ts local)
  // timeline
  visitorsPerDay: number;               // for tier selection
  runningDays: number;                  // calendar days while RUNNING
  hasSaturday: boolean;
  hasSunday: boolean;
  consecutiveLeaderDays: number;        // from dailyLeaders
}

export function decideVerdict(input: WinnerDecisionInput): Verdict;
```

Plus small exported helpers/constants for tier selection and floors so they are unit-testable:

```ts
export const TIERS = { HIGH: 500, MEDIUM: 50 } as const;       // visitor/day thresholds
export const MIN_DAYS = { HIGH: 4, MEDIUM: 7, LOW: 7 } as const;
export const PRACTICAL_LIFT_FLOOR = 5;        // percent, all tiers
export const HARD_MIN_FLOOR = 15;
export const MAX_DAYS = 14;
export function selectTier(visitorsPerDay: number): 'HIGH' | 'MEDIUM' | 'LOW';
export function requiredEvidenceFloor(input): number;          // section 6 slide
```

### What changes in existing files

- **`thompson.ts`** — keeps all statistical computation (Beta sampling, confidence, expected loss, lift, `calculateSampleTarget`). The current winner-declaration block (lines ~212-269) is reduced to *producing the inputs* for `decideVerdict` (it already computes confidence/loss/lift/targets). It no longer makes the final WAIT/WIN call itself, and the blowout shortcut is removed. `calculateConsistency`'s extend-only multiplier is removed; the floor slide (Section 6) supersedes it. **`dynamicLossThreshold` must be added as a field on the `ThompsonResult` interface** — today it is only a local variable inside thompson.ts (lines ~221-223) and is NOT exported. The plan must surface it on the result so the cron can pass it into `decideVerdict`.
- **`nightly/route.ts`** — the entire decision block at lines ~160-174 is replaced by a single call to `decideVerdict(...)`. This includes both the `consistencyOk` gate (line ~160) **and** the current fragile string-matching branches (e.g. `ts.reason?.includes('No meaningful difference')` at ~line 168) which become the typed `NO_DIFFERENCE` verdict. The cron then acts on the verdict: WINNER → set winnerId + terminal; NO_DIFFERENCE → terminal (no winner, free slot); INCONCLUSIVE → persist DB status `NO_DIFFERENCE` + `notes.inconclusive=true`, carry current config forward, free slot; WAIT → leave RUNNING. The cron is also responsible for deriving the new timeline inputs (`runningDays`, `hasSaturday`, `hasSunday`, `visitorsPerDay`) — see Section 11. The harm-revert check (`shouldRevertForCheckoutDrop`) stays exactly where it is, before/independent of this.

### Data flow

```
nightly cron
  ├─ calculateThompsonSampling()      → confidence, loss, lift, targets, dynamicLossThreshold (NEW field)
  ├─ derive timeline inputs           → runningDays, hasSaturday, hasSunday, visitorsPerDay (from dailySummary)
  ├─ countConsecutiveLeaderDays()     → consecutiveLeaderDays (from notes.dailyLeaders)
  ├─ shouldRevertForCheckoutDrop()    → harm-revert (independent, fast)
  └─ decideVerdict(inputs)            → WAIT | WINNER | NO_DIFFERENCE | INCONCLUSIVE
        └─ cron applies verdict (status, winnerId, carry-forward on INCONCLUSIVE, free slot)
```

---

## 11. Error Handling, Edge Cases & New Derived Inputs

### New derived inputs (computed by the cron, NOT today present)
These three inputs do not exist in the current cron and must be derived in `nightly/route.ts` before calling `decideVerdict`:

- **`runningDays`** — calendar days the test was actually RUNNING. **Important:** the current cron's `daysRunning = floor((now - startedAt)/86400000)` (route.ts:101) counts raw calendar days since start and does NOT subtract paused/reverted gaps. The new value must count only RUNNING days. Source: count distinct dates in `dailySummary` (one row per active date) rather than a raw date subtraction.
- **`hasSaturday` / `hasSunday`** — whether the set of RUNNING dates includes a store-local Saturday and Sunday. Derive from the same `dailySummary` dates: map each active date to its weekday and check membership. A weekend day that fell entirely in an OFF window has no `dailySummary` row, so it correctly fails coverage.
- **`visitorsPerDay`** — mean cart-open sessions per RUNNING day (already measured by the cron); used only to pick the tier.

### maxDays reconciliation
The cron already reads per-experiment `exp.maxDays` (route.ts:171). The new `MAX_DAYS = 14` constant is the **default/backstop**; the effective cap is `min(exp.maxDays ?? MAX_DAYS, MAX_DAYS)` so a per-experiment value can only *tighten*, never exceed, the safety backstop. The plan must wire this explicitly so the two values cannot silently disagree.

### Edge cases
- **No daily-leader history yet** (`dailyLeaders` empty / <4 entries): `consecutiveLeaderDays = 0` → no credit → full floor. Safe default (slower, never wrong).
- **winnerCandidateId null** (stats can't separate arms): verdict WAIT until min days / cap; at cap with LOW tier → INCONCLUSIVE.
- **Laggard arm has zero orders → liftPercent collapses to 0.** thompson.ts forces `liftPercent = 0` when `secondMean === 0` (lines ~208-210), since relative lift is undefined against a zero base. A naive practical-significance check (`|liftPercent| ≥ 5%`) would then misclassify a clear leader (e.g. 18 vs 0 orders) as NO_DIFFERENCE. **Rule:** when the laggard has zero orders, the practical-significance gate is satisfied by the leader having ≥ a small absolute order count (reuse `HARD_MIN_FLOOR`/2, i.e. ≥8 leader orders) instead of by `liftPercent`. This prevents a false NO_DIFFERENCE; the evidence floor (gate 6) still independently governs whether there is enough data.
- **liftPercent exactly 5%**: treated as meeting practical significance (`≥`, inclusive) — consistent with how other thresholds use `≥`/`≤`.
- **Weekend coverage with a paused/reverted gap**: only RUNNING days count; a Saturday that occurred entirely during an OFF window does NOT satisfy `hasSaturday` (matches the attribution reality that no per-variant data is collected while OFF).

---

## 12. Testing Strategy

Per blast-radius-shield: map → lock → red → fix → verify.

### Lock (existing behavior must not regress)
- Full existing `thompson.test.ts` suite stays green (statistical core unchanged).
- Full existing `nightly-cron.test.ts` suite stays green, including the harm-revert LOCK tests (LOCK-6, 11a–d) — harm-revert must remain independent and unchanged.
- Cross-path: a WINNER scenario that concludes today must still conclude (no slower than before) under the new gates for the same inputs where credit is not earned.

### New unit tests for `winner-decision.ts` (pure, deterministic)
- **Tier selection**: 499→MEDIUM, 500→HIGH, 49→LOW (boundaries).
- **Weekend gate**: passes confidence+loss+floor but missing Sunday → WAIT; add Sunday → WINNER.
- **Min-days gate**: HIGH at day 3 → WAIT; day 4 → eligible.
- **Practical-significance**: high confidence + low loss + lift 0.4% → NO_DIFFERENCE; lift 5% → WINNER.
- **Zero-laggard guard**: laggard 0 orders, leader 18 orders, liftPercent forced to 0 → must NOT be NO_DIFFERENCE; practical significance satisfied by absolute leader count → WINNER (if floor met) or WAIT (if not), never NO_DIFFERENCE.
- **Consistency credit earned**: 4 straight leader-days, conf 0.991, loss ≤ half threshold, laggard orders 16 → WINNER (floor slid to 15).
- **Credit NOT earned**: leader flipped (consecutive=2), laggard orders 16 → WAIT (full floor ~30).
- **Eleganto express replay**: with_addon 11 / without_addon 20, conf 0.991, lift ~97%, steady leader, weekend covered, HIGH tier → WINNER at reduced floor (proves the motivating case finishes).
- **Small-store fallback**: LOW tier, day 14, laggard orders < floor → INCONCLUSIVE (carry-forward current config).
- **Max-days backstop**: HIGH tier, day 14, still no separation → terminal (not WAIT forever).
- **No overrides**: huge visitors/day + conf 0.999 but no Saturday → WAIT (volume can't skip weekend).

### Integration (in `nightly-cron.test.ts`)
- Verdict WINNER → experiment set to WINNER_FOUND with winnerId.
- Verdict NO_DIFFERENCE → terminal, no winner, slot freed.
- Verdict INCONCLUSIVE → DB status NO_DIFFERENCE + `notes.inconclusive=true`, current config carried forward, slot freed.
- Verdict WAIT → experiment stays RUNNING.
- Harm-revert still fires independently on a real cliff even when verdict would be WAIT.

### Verify
- `tsc` clean, full suite green before commit.

---

## 13. Open Questions / Risks

- **Tier thresholds (500 / 50) and min-days (4/7/7)** are judgment calls tuned for a 1-in-20 trust budget. They are centralized as named constants so they can be retuned without touching logic.
- **5% practical-significance floor** is a product decision; if a store cares about sub-5% lifts at huge scale, this would need to become configurable. Out of scope for now (YAGNI).
- **INCONCLUSIVE carry-forward** keeps the control config and frees the slot rather than force-applying a cross-store config (which the autopilot engine does not do on a non-winner terminal). The accumulated data still improves future priors via `buildCrossStorePriors`. If, in future, force-applying a cross-store-winning config on INCONCLUSIVE is desired, that is a separate enhancement to the autopilot engine — out of scope here (YAGNI).

---

## 14. Summary

One pure decision module, three tiers, six irreducible win gates, a consistency *credit* that shortens strong-and-steady tests toward a hard floor of 15 orders, a practical-significance floor that stops big stores chasing trivial lifts, and a small-store fallback that concludes by carrying the current config forward (and feeding future cross-store priors) instead of running forever — with the harm-revert breaker kept fully separate so it can still fire fast and safe.
