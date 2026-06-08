import { describe, it, expect } from 'vitest';
import { calculateThompsonSampling, pickVariant, calculateSampleTarget } from '../lib/thompson';

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

  it('shifts traffic toward variant with more orders (past hard floor)', () => {
    // control: 50 orders out of 500 cart opens (10% order rate)
    // treatment: 90 orders out of 500 cart opens (18% order rate)
    // dailyOrders: 1 → floor = 5, both arms well past floor AND past target
    const result = calculateThompsonSampling([
      { id: 'control', successes: 50, failures: 450 },
      { id: 'treatment', successes: 90, failures: 410 },
    ], { dailyTraffic: 500, minDaysRunning: 5, dailyOrders: 1 });
    expect(result.trafficSplit.treatment).toBeGreaterThan(0.7);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.winnerCandidateId).toBe('treatment');
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
  });

  it('exposes dynamicLossThreshold and winnerCandidateId for the decision module', () => {
    const result = calculateThompsonSampling(
      [
        { id: 'control', successes: 5, failures: 195 },
        { id: 'treatment', successes: 30, failures: 170 },
      ],
      { dailyTraffic: 600, dailyOrders: 8 },
    );
    expect(typeof result.dynamicLossThreshold).toBe('number');
    expect(result.dynamicLossThreshold).toBeGreaterThan(0);
    expect(result.winnerCandidateId).toBe('treatment'); // statistical leader by mean
  });

  // ── Hard floor tests ──

  it('HARD FLOOR: forces exact 50/50 when below dynamic floor (low-traffic store)', () => {
    // Store gets 2 orders/day → floor = max(5, min(25, 2*3)) = 6
    // Both arms have 3 orders each → below floor → pure 50/50
    const result = calculateThompsonSampling([
      { id: 'control', successes: 3, failures: 97 },
      { id: 'treatment', successes: 3, failures: 97 },
    ], { dailyOrders: 2 });
    expect(result.trafficSplit.control).toBe(0.5);
    expect(result.trafficSplit.treatment).toBe(0.5);
    expect(result.dataMaturity).toBe(0);
    expect(result.hardFloorPerVariant).toBe(6);
  });

  it('HARD FLOOR: forces exact 50/50 when below dynamic floor (high-traffic store)', () => {
    // Store gets 10 orders/day → floor = max(5, min(25, 10*3)) = 25
    // Arms have 19 and 6 orders → min=6, below floor=25 → pure 50/50
    const result = calculateThompsonSampling([
      { id: 'control', successes: 19, failures: 250 },
      { id: 'treatment', successes: 6, failures: 173 },
    ], { dailyOrders: 10 });
    expect(result.trafficSplit.control).toBe(0.5);
    expect(result.trafficSplit.treatment).toBe(0.5);
    expect(result.dataMaturity).toBe(0);
    expect(result.hardFloorPerVariant).toBe(25);
  });

  it('HARD FLOOR: starts smooth dampening AFTER floor is crossed', () => {
    // Store gets 3 orders/day → floor = max(5, min(25, 3*3)) = 9
    // Both arms have 15 orders → above floor → Thompson starts influencing
    // With 30 vs 15 orders, Thompson should shift toward the winner
    const result = calculateThompsonSampling([
      { id: 'control', successes: 30, failures: 470 },
      { id: 'treatment', successes: 15, failures: 485 },
    ], { dailyOrders: 3 });
    expect(result.dataMaturity).toBeGreaterThan(0);
    // Should no longer be exactly 50/50
    expect(result.trafficSplit.control).toBeGreaterThan(0.5);
  });

  it('HARD FLOOR: caps at 25 even for very high-traffic stores', () => {
    // Store gets 100 orders/day → floor = max(5, min(25, 100*3)) = 25
    const result = calculateThompsonSampling([
      { id: 'control', successes: 20, failures: 980 },
      { id: 'treatment', successes: 20, failures: 980 },
    ], { dailyOrders: 100 });
    expect(result.hardFloorPerVariant).toBe(25);
    // 20 < 25 → still below floor → pure 50/50
    expect(result.dataMaturity).toBe(0);
    expect(result.trafficSplit.control).toBe(0.5);
  });

  it('HARD FLOOR: minimum floor is 5 even for very low-traffic stores', () => {
    // Store gets 0.5 orders/day → floor = max(5, min(25, round(0.5*3))) = max(5, 2) = 5
    const result = calculateThompsonSampling([
      { id: 'control', successes: 4, failures: 46 },
      { id: 'treatment', successes: 4, failures: 46 },
    ], { dailyOrders: 0.5 });
    expect(result.hardFloorPerVariant).toBe(5);
    // 4 < 5 → below floor → pure 50/50
    expect(result.dataMaturity).toBe(0);
  });

  it('HARD FLOOR: defaults to floor=5 when dailyOrders not provided', () => {
    // No dailyOrders → defaults to 0 → floor = max(5, min(25, 0)) = 5
    const result = calculateThompsonSampling([
      { id: 'control', successes: 3, failures: 97 },
      { id: 'treatment', successes: 3, failures: 97 },
    ]);
    expect(result.hardFloorPerVariant).toBe(5);
    // 3 < 5 → below floor → pure 50/50
    expect(result.dataMaturity).toBe(0);
    expect(result.trafficSplit.control).toBe(0.5);
  });

  it('does NOT let checkout clicks influence traffic allocation', () => {
    // Scenario: A=10 orders, B=30 orders — Thompson should favor B
    // dailyOrders: 1 → floor = 5, both arms exceed floor so Thompson has influence
    const result = calculateThompsonSampling(
      [
        { id: 'A', successes: 10, failures: 90 },   // 10 orders / 100 opens
        { id: 'B', successes: 30, failures: 70 },    // 30 orders / 100 opens
      ],
      {
        dailyOrders: 1, // floor = 5, both arms above floor
        displayStats: [
          { id: 'A', cartOpens: 100, checkouts: 50, orders: 10 },
          { id: 'B', cartOpens: 100, checkouts: 6, orders: 30 },
        ],
      }
    );
    // B should get more traffic (more orders)
    expect(result.trafficSplit.B).toBeGreaterThan(result.trafficSplit.A);
    // Checkout rates are for display only
    expect(result.checkoutRates?.A).toBeCloseTo(0.50, 1);
    expect(result.checkoutRates?.B).toBeCloseTo(0.06, 1);
    // Order rates reflect what Thompson sees
    expect(result.orderRates?.A).toBeCloseTo(0.10, 2);
    expect(result.orderRates?.B).toBeCloseTo(0.30, 2);
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
    // At 3% baseline with 75% adaptive MDE → ~962 per variant
    expect(result.nPerVariant).toBeGreaterThan(700);
    expect(result.nPerVariant).toBeLessThan(1200);
    expect(result.totalNeeded).toBe(result.nPerVariant * 2);
    expect(result.baselineRate).toBe(0.03);
  });

  it('needs fewer visitors for higher baseline rates', () => {
    const low = calculateSampleTarget(0.03, 2);
    const high = calculateSampleTarget(0.10, 2);
    expect(high.nPerVariant).toBeLessThan(low.nPerVariant);
  });

  it('clamps to minimum 200 per variant', () => {
    const result = calculateSampleTarget(0.50, 2);
    expect(result.nPerVariant).toBeGreaterThanOrEqual(200);
  });

  it('clamps to maximum 8000 per variant', () => {
    const result = calculateSampleTarget(0.005, 2);
    expect(result.nPerVariant).toBeLessThanOrEqual(8000);
  });
});
