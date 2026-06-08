import { describe, it, expect } from 'vitest';
import { selectTier } from '../lib/winner-decision';

describe('selectTier', () => {
  it('500 visitors/day → HIGH', () => expect(selectTier(500)).toBe('HIGH'));
  it('499 → MEDIUM', () => expect(selectTier(499)).toBe('MEDIUM'));
  it('50 → MEDIUM', () => expect(selectTier(50)).toBe('MEDIUM'));
  it('49 → LOW', () => expect(selectTier(49)).toBe('LOW'));
  it('0 → LOW', () => expect(selectTier(0)).toBe('LOW'));
});
