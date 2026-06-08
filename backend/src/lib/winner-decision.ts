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
