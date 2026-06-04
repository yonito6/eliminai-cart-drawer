import { describe, it, expect } from 'vitest';
import { computeAov, buildBaseline } from '../lib/cro-baseline';

describe('computeAov', () => {
  it('returns revenue / orders rounded to 2 decimals', () => {
    expect(computeAov(1000, 8)).toBe(125);
    expect(computeAov(1005, 8)).toBe(125.63);
  });
  it('returns 0 when there are no orders (no divide-by-zero)', () => {
    expect(computeAov(1000, 0)).toBe(0);
    expect(computeAov(0, 0)).toBe(0);
  });
});

describe('buildBaseline', () => {
  it('assembles a baseline record with aov computed and a captured timestamp', () => {
    const b = buildBaseline({ orderCount: 8, totalRevenue: 1000, currency: 'USD' }, new Date('2026-06-03T00:00:00Z'));
    expect(b).toEqual({
      capturedAt: '2026-06-03T00:00:00.000Z',
      windowDays: 30,
      orders30d: 8,
      revenue30d: 1000,
      aov: 125,
      currency: 'USD',
    });
  });
});
