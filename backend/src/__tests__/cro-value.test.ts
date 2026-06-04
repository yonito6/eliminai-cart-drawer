import { describe, it, expect } from 'vitest';
import { computeValue } from '../lib/cro-value';

describe('computeValue', () => {
  it('computes extra orders/revenue/aov/conversion deltas', () => {
    const v = computeValue({
      before: { conversion: 0.0078, visitors: 0, orders: 0 },
      now: { conversion: 0.0096, visitors: 0, orders: 0 },
      visitors: 18402, ordersNow: 176,
      aovBefore: 168.20, aovNow: 181.56, winsBanked: 3,
    });
    expect(v.extraOrders).toBe(33);
    expect(v.aovLift).toBeCloseTo(13.36, 2);
    expect(v.convLift).toBeCloseTo(0.18, 4);
    expect(v.extraRevenue).toBeCloseTo(8342.84, 1);
    expect(v.winsBanked).toBe(3);
  });

  it('floors negative lift to zero (noisy early week never shows scary negatives)', () => {
    const v = computeValue({
      before: { conversion: 0.02, visitors: 0, orders: 0 },
      now: { conversion: 0.01, visitors: 0, orders: 0 },
      visitors: 1000, ordersNow: 10, aovBefore: 200, aovNow: 150, winsBanked: 0,
    });
    expect(v.extraOrders).toBe(0);
    expect(v.extraRevenue).toBe(0);
    expect(v.aovLift).toBe(0);
    expect(v.convLift).toBe(0);
  });

  it('handles a null aovBefore (no baseline captured) as zero lift contribution', () => {
    const v = computeValue({
      before: { conversion: 0.01, visitors: 0, orders: 0 },
      now: { conversion: 0.01, visitors: 0, orders: 0 },
      visitors: 1000, ordersNow: 10, aovBefore: null, aovNow: 180, winsBanked: 0,
    });
    expect(v.aovLift).toBe(0);
    expect(v.extraRevenue).toBe(0);
  });
});
