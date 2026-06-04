// backend/src/__tests__/test-variants.test.ts
import { describe, it, expect } from 'vitest';
import { buildVariantsForSlot } from '../lib/test-variants';

const trustDef = {
  key: 'trustBadges',
  label: 'Trust Badges',
  category: 'trust',
  testable: true,
  dimensions: [
    { key: 'text', label: 'Badge Text', testable: true, type: 'text', default: '' },
  ],
} as any;

describe('buildVariantsForSlot', () => {
  it('first test is with-vs-without (_enabled) when enabled was never tested', () => {
    const res = buildVariantsForSlot(trustDef, { completedNames: new Set<string>(), currentConfig: {} });
    expect('error' in res).toBe(false);
    if ('error' in res) return;
    expect(res.testName).toBe('Trust Badges — Enabled vs Disabled');
    expect(res.dimensionKey).toBe('_enabled');
    expect(res.variants.map(v => v.id)).toEqual(['with_addon', 'without_addon']);
    expect(res.variants[0].features).toEqual({ _enabled: true });
    expect(res.variants[1].features).toEqual({ _enabled: false });
    expect(res.trafficSplit).toEqual({ with_addon: 0.5, without_addon: 0.5 });
  });

  it('after enabled is tested, builds a text-dimension test with current first', () => {
    const completed = new Set<string>(['Trust Badges — Enabled vs Disabled']);
    const res = buildVariantsForSlot(trustDef, {
      completedNames: completed,
      currentConfig: { text: 'Guaranteed Safe Checkout' },
    });
    if ('error' in res) throw new Error(res.error);
    expect(res.testName).toBe('Trust Badges — Badge Text');
    expect(res.dimensionKey).toBe('text');
    expect(res.variants[0].features).toEqual({ text: 'Guaranteed Safe Checkout' });
    expect(res.variants[1].features).toEqual({ text: 'Secure Payment' });
  });

  it('returns an error when a dimension test is requested but none are testable', () => {
    const noDimDef = { ...trustDef, dimensions: [] };
    const res = buildVariantsForSlot(noDimDef, {
      completedNames: new Set<string>(['Trust Badges — Enabled vs Disabled']),
      currentConfig: {},
    });
    expect('error' in res).toBe(true);
  });
});
