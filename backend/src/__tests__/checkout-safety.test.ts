/**
 * BLAST RADIUS MAP — shouldRevertForCheckoutDrop (new pure function)
 * Target: backend/src/lib/checkout-safety.ts (new file)
 *
 * WHY THIS EXISTS:
 *   The nightly safety breaker (nightly/route.ts) was structurally false-positiving.
 *   It compared a noisy session-based 48h checkout rate against baseline*0.95 (a 5%
 *   tolerance). Real daily session rates swing 0.77–1.17 (some >1.0 because
 *   CHECKOUT_CLICKED sessions can exceed CART_OPENED sessions), so a healthy
 *   experiment reverted nearly every night. This pure function encodes the fixed
 *   decision: require a meaningful sample AND a real cliff (30%+ drop), and clamp
 *   the rate to a sane [0,1].
 *
 * CALLERS (after wiring):
 *   - nightly/route.ts safety check (the ONLY copy of breaker logic)
 *
 * CROSS-PATH RISK:
 *   - LOCK-6 in nightly-cron.test.ts (baseline 0.20, recent 5/100=0.05) must still
 *     REVERT: 0.05 < 0.20*0.70=0.14 AND 100 >= 50 sessions → still reverts. OK.
 *   - LOCK-11 (baseline null) must still skip → function returns false. OK.
 */

import { describe, it, expect } from 'vitest';
import { shouldRevertForCheckoutDrop } from '../lib/checkout-safety';

describe('shouldRevertForCheckoutDrop', () => {
  // BUG REPRO: the noise that used to false-revert the express experiment.
  it('does NOT revert on normal session-rate noise (the false-positive bug)', () => {
    // eleganto's real situation: baseline ~0.9725, a noisy-but-healthy 48h rate of 0.83.
    // Old logic floor was baseline*0.95 = 0.9239, so 0.83 reverted (WRONG).
    expect(
      shouldRevertForCheckoutDrop({
        openSessions: 400,
        checkoutSessions: 332, // 0.83
        baselineCheckoutRate: 0.9725,
      })
    ).toBe(false);
  });

  it('does NOT revert and clamps when checkout sessions exceed open sessions (>1.0 rate)', () => {
    // CHECKOUT_CLICKED unique sessions can exceed CART_OPENED unique sessions.
    expect(
      shouldRevertForCheckoutDrop({
        openSessions: 100,
        checkoutSessions: 117, // raw 1.17, clamps to 1.0
        baselineCheckoutRate: 0.9725,
      })
    ).toBe(false);
  });

  it('DOES revert on a real cliff (30%+ drop below baseline)', () => {
    // A genuine collapse: baseline 0.9725, recent 0.50 → below floor 0.68075.
    expect(
      shouldRevertForCheckoutDrop({
        openSessions: 400,
        checkoutSessions: 200, // 0.50
        baselineCheckoutRate: 0.9725,
      })
    ).toBe(true);
  });

  it('does NOT revert when sample is too small, even on a cliff', () => {
    // 0/40 = 0.0 rate but only 40 sessions (< 50 minimum) → noise, not signal.
    expect(
      shouldRevertForCheckoutDrop({
        openSessions: 40,
        checkoutSessions: 0,
        baselineCheckoutRate: 0.9725,
      })
    ).toBe(false);
  });

  it('does NOT revert when baselineCheckoutRate is null or zero', () => {
    expect(
      shouldRevertForCheckoutDrop({ openSessions: 400, checkoutSessions: 0, baselineCheckoutRate: null })
    ).toBe(false);
    expect(
      shouldRevertForCheckoutDrop({ openSessions: 400, checkoutSessions: 0, baselineCheckoutRate: 0 })
    ).toBe(false);
  });

  it('LOCK-6 parity: low baseline with a true crash still reverts', () => {
    // Mirrors nightly LOCK-6: baseline 0.20, recent 5/100=0.05 < 0.20*0.70=0.14, 100>=50.
    expect(
      shouldRevertForCheckoutDrop({
        openSessions: 100,
        checkoutSessions: 5,
        baselineCheckoutRate: 0.20,
      })
    ).toBe(true);
  });

  it('does NOT revert right at the 30% threshold boundary', () => {
    // recent exactly == baseline*0.70 should NOT trip (strictly-less-than).
    expect(
      shouldRevertForCheckoutDrop({
        openSessions: 1000,
        checkoutSessions: 140, // 0.14 == 0.20*0.70
        baselineCheckoutRate: 0.20,
      })
    ).toBe(false);
  });
});
