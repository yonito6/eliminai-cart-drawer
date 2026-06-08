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
