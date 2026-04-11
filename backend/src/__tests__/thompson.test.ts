import { describe, it, expect } from 'vitest';
import { calculateThompsonSampling, pickVariant } from '../lib/thompson';

describe('Thompson Sampling — order-based optimization', () => {
  it('returns 50/50 split with no data', () => {
    const result = calculateThompsonSampling([
      { id: 'control', successes: 0, failures: 0 },
      { id: 'treatment', successes: 0, failures: 0 },
    ]);
    // With no data, both should be near 50%
    expect(result.trafficSplit.control).toBeGreaterThan(0.3);
    expect(result.trafficSplit.control).toBeLessThan(0.7);
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('shifts traffic toward variant with more orders', () => {
    // control: 10 orders out of 200 cart opens (5% order rate)
    // treatment: 30 orders out of 200 cart opens (15% order rate)
    // 200 per variant exceeds explorationMin — Thompson can steer
    const result = calculateThompsonSampling([
      { id: 'control', successes: 10, failures: 190 },
      { id: 'treatment', successes: 30, failures: 170 },
    ], { dailyTraffic: 500, minDaysRunning: 5 });
    expect(result.trafficSplit.treatment).toBeGreaterThan(0.7);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.winnerId).toBe('treatment');
  });

  it('reports low confidence with small samples', () => {
    // Few orders — Thompson can't distinguish variants
    const result = calculateThompsonSampling([
      { id: 'control', successes: 3, failures: 97 },
      { id: 'treatment', successes: 5, failures: 95 },
    ]);
    expect(result.confidence).toBeLessThan(0.95);
  });

  it('detects no difference with similar order rates', () => {
    const result = calculateThompsonSampling([
      { id: 'control', successes: 10, failures: 490 },
      { id: 'treatment', successes: 11, failures: 489 },
    ]);
    expect(result.liftPercent).toBeLessThan(15);
  });

  it('stays ~50/50 with very sparse order data (natural balancing)', () => {
    // This is the key test: with 1-2 orders, Thompson should NOT aggressively steer
    // Beta(2, 98) and Beta(1, 99) have wide, overlapping posteriors
    const result = calculateThompsonSampling([
      { id: 'control', successes: 2, failures: 98 },
      { id: 'treatment', successes: 1, failures: 99 },
    ]);
    // Both should be relatively close to 50% (exploration phase forces equal)
    expect(result.trafficSplit.control).toBeGreaterThan(0.3);
    expect(result.trafficSplit.treatment).toBeGreaterThan(0.3);
    // No winner should be declared
    expect(result.winnerId).toBeNull();
  });

  it('does NOT let checkout clicks influence traffic allocation', () => {
    // Scenario from Yoni: A=50 checkouts/1 order, B=6 checkouts/5 orders
    // Thompson only sees orders — B should be favored
    const result = calculateThompsonSampling(
      [
        { id: 'A', successes: 1, failures: 99 },   // 1 order / 100 opens
        { id: 'B', successes: 5, failures: 95 },    // 5 orders / 100 opens
      ],
      {
        displayStats: [
          { id: 'A', cartOpens: 100, checkouts: 50, orders: 1 },
          { id: 'B', cartOpens: 100, checkouts: 6, orders: 5 },
        ],
      }
    );
    // B should get more traffic (more orders)
    expect(result.trafficSplit.B).toBeGreaterThan(result.trafficSplit.A);
    // Checkout rates are for display only
    expect(result.checkoutRates?.A).toBeCloseTo(0.50, 1);
    expect(result.checkoutRates?.B).toBeCloseTo(0.06, 1);
    // Order rates reflect what Thompson sees
    expect(result.orderRates?.A).toBeCloseTo(0.01, 2);
    expect(result.orderRates?.B).toBeCloseTo(0.05, 2);
  });

  it('returns explorationMinPerVariant for dashboard', () => {
    const result = calculateThompsonSampling([
      { id: 'control', successes: 0, failures: 0 },
      { id: 'treatment', successes: 0, failures: 0 },
    ], { dailyTraffic: 100 });
    expect(result.explorationMinPerVariant).toBeGreaterThan(0);
    expect(typeof result.explorationMinPerVariant).toBe('number');
  });
});

describe('pickVariant', () => {
  it('picks based on traffic split weights', () => {
    const counts = { control: 0, treatment: 0 };
    const split = { control: 0.3, treatment: 0.7 };
    for (let i = 0; i < 1000; i++) {
      const v = pickVariant(split);
      counts[v as keyof typeof counts]++;
    }
    // Treatment should be picked ~70% of the time (with tolerance)
    expect(counts.treatment).toBeGreaterThan(600);
    expect(counts.treatment).toBeLessThan(800);
  });
});
