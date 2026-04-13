import { describe, it, expect } from 'vitest';
import { calculateThompsonSampling, pickVariant, calculateSampleTarget, calculateConsistency } from '../lib/thompson';

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
    // control: 25 orders out of 500 cart opens (5% order rate)
    // treatment: 60 orders out of 500 cart opens (12% order rate)
    // Both have 25+ orders (minimum gate) and 500 visitors per variant
    const result = calculateThompsonSampling([
      { id: 'control', successes: 25, failures: 475 },
      { id: 'treatment', successes: 60, failures: 440 },
    ], { dailyTraffic: 500, minDaysRunning: 5 });
    expect(result.trafficSplit.treatment).toBeGreaterThan(0.7);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.winnerId).toBe('treatment');
  });

  it('does NOT declare winner with fewer than 25 orders per variant', () => {
    // Even with high confidence, below 25-order minimum
    const result = calculateThompsonSampling([
      { id: 'control', successes: 3, failures: 197 },
      { id: 'treatment', successes: 15, failures: 185 },
    ], { dailyTraffic: 500, minDaysRunning: 5 });
    expect(result.winnerId).toBeNull();
    expect(result.reason).toContain('orders per variant');
  });

  it('declares blowout winner when leading variant has 25+ orders even if loser has few', () => {
    // Blowout: 8% vs 0.5% — winner has 40 orders, loser has 3
    // Total = 43 orders (>= 40), winner has 40 (>= 25), 5+ days
    const result = calculateThompsonSampling([
      { id: 'control', successes: 3, failures: 597 },
      { id: 'treatment', successes: 40, failures: 460 },
    ], { dailyTraffic: 200, minDaysRunning: 5 });
    // Should declare winner via blowout (control has only 3 orders < 25)
    expect(result.winnerId).toBe('treatment');
    expect(result.reason).toContain('Clear winner');
  });

  it('does NOT blowout before 3 days even with overwhelming data', () => {
    const result = calculateThompsonSampling([
      { id: 'control', successes: 2, failures: 298 },
      { id: 'treatment', successes: 50, failures: 250 },
    ], { dailyTraffic: 200, minDaysRunning: 2 });
    expect(result.winnerId).toBeNull();
    expect(result.reason).toContain('3 days');
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

describe('calculateSampleTarget', () => {
  it('calculates correct sample size for 3% baseline', () => {
    const result = calculateSampleTarget(0.03, 2);
    // At 3% baseline with 50% MDE → ~1,980 per variant
    expect(result.nPerVariant).toBeGreaterThan(1500);
    expect(result.nPerVariant).toBeLessThan(2500);
    expect(result.totalNeeded).toBe(result.nPerVariant * 2);
    expect(result.baselineRate).toBe(0.03);
  });

  it('needs fewer visitors for higher baseline rates', () => {
    const low = calculateSampleTarget(0.03, 2);
    const high = calculateSampleTarget(0.10, 2);
    expect(high.nPerVariant).toBeLessThan(low.nPerVariant);
  });

  it('clamps to minimum 500 per variant', () => {
    const result = calculateSampleTarget(0.50, 2);
    expect(result.nPerVariant).toBeGreaterThanOrEqual(500);
  });

  it('clamps to maximum 20000 per variant', () => {
    const result = calculateSampleTarget(0.005, 2);
    expect(result.nPerVariant).toBeLessThanOrEqual(20000);
  });
});

describe('calculateConsistency', () => {
  it('returns perfect score with fewer than 2 days', () => {
    const result = calculateConsistency([
      { date: '2026-04-13', leaderId: 'A', liftPct: 10 },
    ]);
    expect(result.score).toBe(1);
    expect(result.multiplier).toBe(1.0);
    expect(result.message).toBeNull();
  });

  it('returns high consistency when same variant leads every day', () => {
    const result = calculateConsistency([
      { date: '2026-04-10', leaderId: 'A', liftPct: 12 },
      { date: '2026-04-11', leaderId: 'A', liftPct: 8 },
      { date: '2026-04-12', leaderId: 'A', liftPct: 15 },
      { date: '2026-04-13', leaderId: 'A', liftPct: 10 },
    ]);
    expect(result.score).toBe(1);
    expect(result.multiplier).toBe(1.0);
    expect(result.message).toBeNull();
  });

  it('detects medium volatility and extends 1.5x', () => {
    const result = calculateConsistency([
      { date: '2026-04-10', leaderId: 'A', liftPct: 12 },
      { date: '2026-04-11', leaderId: 'B', liftPct: 3 },
      { date: '2026-04-12', leaderId: 'A', liftPct: 8 },
      { date: '2026-04-13', leaderId: 'A', liftPct: 10 },
      { date: '2026-04-14', leaderId: 'B', liftPct: 2 },
    ]);
    expect(result.score).toBe(0.6);
    expect(result.multiplier).toBe(1.5);
    expect(result.message).toContain('vary between days');
  });

  it('applies 2x multiplier when results flip frequently', () => {
    const result = calculateConsistency([
      { date: '2026-04-08', leaderId: 'A', liftPct: 5 },
      { date: '2026-04-09', leaderId: 'B', liftPct: 3 },
      { date: '2026-04-10', leaderId: 'A', liftPct: 2 },
      { date: '2026-04-11', leaderId: 'B', liftPct: 4 },
      { date: '2026-04-12', leaderId: 'B', liftPct: 1 },
      { date: '2026-04-13', leaderId: 'A', liftPct: 6 },
      { date: '2026-04-14', leaderId: 'B', liftPct: 2 },
      { date: '2026-04-15', leaderId: 'A', liftPct: 3 },
      { date: '2026-04-16', leaderId: 'B', liftPct: 1 },
      { date: '2026-04-17', leaderId: 'A', liftPct: 4 },
    ]);
    // A: 5, B: 5 → 50% → 2x multiplier
    expect(result.score).toBeLessThan(0.6);
    expect(result.multiplier).toBe(2.0);
    expect(result.message).toContain('keep flipping');
  });
});
