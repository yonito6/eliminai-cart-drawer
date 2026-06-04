import { describe, it, expect } from 'vitest';
import { CRO_SUGGESTIONS } from '../lib/cro-suggestions';

describe('CRO_SUGGESTIONS', () => {
  it('has the 5 research-backed tactics with required fields', () => {
    const keys = CRO_SUGGESTIONS.map(s => s.key);
    expect(keys).toEqual(['freeReturns', 'deliveryDate', 'checkoutMicrocopy', 'giftEngraving', 'bnpl']);
    for (const s of CRO_SUGGESTIONS) {
      expect(s.label).toBeTruthy();
      expect(s.blurb).toBeTruthy();
      expect(s.source).toMatch(/^https?:\/\//);
      expect(['conversion', 'aov', 'attach_rate']).toContain(s.metric);
    }
  });
  it('stars engraving as the watch-specific play', () => {
    expect(CRO_SUGGESTIONS.find(s => s.key === 'giftEngraving')?.watchStar).toBe(true);
  });
});
