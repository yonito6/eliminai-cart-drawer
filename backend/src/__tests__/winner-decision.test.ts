import { describe, it, expect } from 'vitest';
import { selectTier } from '../lib/winner-decision';

describe('selectTier', () => {
  it('500 visitors/day → HIGH', () => expect(selectTier(500)).toBe('HIGH'));
  it('499 → MEDIUM', () => expect(selectTier(499)).toBe('MEDIUM'));
  it('50 → MEDIUM', () => expect(selectTier(50)).toBe('MEDIUM'));
  it('49 → LOW', () => expect(selectTier(49)).toBe('LOW'));
  it('0 → LOW', () => expect(selectTier(0)).toBe('LOW'));
});

import { countConsecutiveLeaderDays } from '../lib/winner-decision';

describe('countConsecutiveLeaderDays', () => {
  const days = (ids: string[]) => ids.map((leaderId, i) => ({ date: `d${i}`, leaderId, liftPct: 0 }));

  it('returns 0 when candidate is null', () => {
    expect(countConsecutiveLeaderDays(days(['a', 'a']), null)).toBe(0);
  });
  it('counts trailing streak of the candidate', () => {
    expect(countConsecutiveLeaderDays(days(['b', 'a', 'a', 'a']), 'a')).toBe(3);
  });
  it('stops at the first mismatch from the end', () => {
    expect(countConsecutiveLeaderDays(days(['a', 'a', 'b']), 'a')).toBe(0);
  });
  it('empty history → 0', () => {
    expect(countConsecutiveLeaderDays([], 'a')).toBe(0);
  });
});
