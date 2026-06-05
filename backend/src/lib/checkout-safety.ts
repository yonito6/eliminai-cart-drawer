// Pure decision for the nightly safety circuit-breaker.
//
// Session-based 48h checkout rates are noisy: real daily rates swing ~0.77–1.17
// (some above 1.0 because CHECKOUT_CLICKED unique sessions can exceed CART_OPENED
// unique sessions). The old breaker compared this noise against baseline*0.95 (a
// 5% tolerance), so healthy experiments reverted nearly every night. This function
// only trips on a genuine cliff, with a meaningful sample, and clamps the rate to
// a sane [0,1].

export interface CheckoutSafetyInput {
  openSessions: number;
  checkoutSessions: number;
  baselineCheckoutRate: number | null | undefined;
}

// Need a real sample before trusting the rate at all.
export const MIN_SESSIONS_FOR_SAFETY = 50;

// Only revert on a 30%+ drop below baseline (not 5% noise).
export const SAFETY_DROP_THRESHOLD = 0.7;

export function shouldRevertForCheckoutDrop(input: CheckoutSafetyInput): boolean {
  const { openSessions, checkoutSessions, baselineCheckoutRate } = input;

  if (!baselineCheckoutRate || baselineCheckoutRate <= 0) return false;
  if (openSessions < MIN_SESSIONS_FOR_SAFETY) return false;

  // Clamp: CHECKOUT_CLICKED sessions can exceed CART_OPENED sessions, yielding >1.0.
  const recentRate = Math.min(checkoutSessions / openSessions, 1);

  return recentRate < baselineCheckoutRate * SAFETY_DROP_THRESHOLD;
}
