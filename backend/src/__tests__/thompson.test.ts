import { describe, it, expect } from 'vitest';
import { calculateThompsonSampling, pickVariant } from '../lib/thompson';

describe('Thompson Sampling', () => {
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

  it('shifts traffic toward clear winner', () => {
    const result = calculateThompsonSampling([
      { id: 'control', successes: 10, failures: 90 },
      { id: 'treatment', successes: 30, failures: 70 },
    ]);
    expect(result.trafficSplit.treatment).toBeGreaterThan(0.7);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.winnerId).toBe('treatment');
  });

  it('reports low confidence with small samples', () => {
    const result = calculateThompsonSampling([
      { id: 'control', successes: 3, failures: 7 },
      { id: 'treatment', successes: 5, failures: 5 },
    ]);
    expect(result.confidence).toBeLessThan(0.95);
  });

  it('detects no difference with similar rates', () => {
    const result = calculateThompsonSampling([
      { id: 'control', successes: 100, failures: 400 },
      { id: 'treatment', successes: 102, failures: 398 },
    ]);
    expect(result.liftPercent).toBeLessThan(5);
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
