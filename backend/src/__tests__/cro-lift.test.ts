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
