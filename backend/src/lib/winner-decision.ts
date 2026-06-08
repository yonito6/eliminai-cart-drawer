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
