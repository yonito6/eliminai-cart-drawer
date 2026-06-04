import { describe, it, expect } from 'vitest';
import { buildConversionSeries, windowConversion } from '../lib/cro-conversion';

const rows = [
  { date: '2026-04-09', uniqueVisitors: 100, ordersCompleted: 1 }, // 1.0%
  { date: '2026-04-10', uniqueVisitors: 100, ordersCompleted: 0 }, // 0.0%
  { date: '2026-06-02', uniqueVisitors: 100, ordersCompleted: 2 }, // 2.0%
  { date: '2026-06-03', uniqueVisitors: 100, ordersCompleted: 2 }, // 2.0%
];

describe('buildConversionSeries', () => {
  it('returns one sorted point per day with conversion as a fraction', () => {
    const s = buildConversionSeries(rows);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ date: '2026-04-09', conversion: 0.01 });
    expect(s[3]).toEqual({ date: '2026-06-03', conversion: 0.02 });
  });
  it('handles zero visitors without dividing by zero', () => {
    const s = buildConversionSeries([{ date: '2026-04-09', uniqueVisitors: 0, ordersCompleted: 0 }]);
    expect(s[0].conversion).toBe(0);
  });
});

describe('windowConversion', () => {
  it('aggregates the earliest N and latest N distinct days', () => {
    const { before, now } = windowConversion(rows, 2);
    expect(before.conversion).toBeCloseTo(0.005, 6);
    expect(before.visitors).toBe(200);
    expect(before.orders).toBe(1);
    expect(now.conversion).toBeCloseTo(0.02, 6);
    expect(now.orders).toBe(4);
  });
  it('returns null-ish zero window when there are no rows', () => {
    const { before, now } = windowConversion([], 7);
    expect(before.conversion).toBe(0);
    expect(now.conversion).toBe(0);
  });
});
