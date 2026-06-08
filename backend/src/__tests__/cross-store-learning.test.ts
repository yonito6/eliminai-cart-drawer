import { describe, it, expect } from 'vitest';
import { buildCrossStoreLearning } from '@/lib/cross-store-learning';

const variants = [
  { id: 'a', label: 'Above (A)', features: { position: 'above' } },
  { id: 'b', label: 'Below (B)', features: { position: 'below' } },
];

describe('buildCrossStoreLearning', () => {
  it('captures winner/loser configs + effect size on a WINNER verdict', () => {
    const out = buildCrossStoreLearning({
      slot: 'expressPayments',
      verdict: 'WINNER',
      liftPercent: 8.4,
      winnerVariantId: 'a',
      variants,
      trafficTier: 'medium',
      dailyTraffic: 120,
      runningDays: 9,
      confidence: 0.97,
    });
    expect(out.winnerFeatures).toEqual({ position: 'above' });
    expect(out.loserFeatures).toEqual({ position: 'below' });
    expect(out.winnerLabel).toBe('Above (A)');
    expect(out.effectSizePercent).toBe(8.4);
    expect(out.trafficTier).toBe('medium');
    expect(out.dailyTraffic).toBe(120);
    expect(out.confidence).toBe(0.97);
    expect(out.decidedAt).toMatch(/\dT\d/); // ISO timestamp
  });

  it('uses absolute lift magnitude (negative lift still records its size)', () => {
    const out = buildCrossStoreLearning({
      slot: 'trustBadges', verdict: 'WINNER', liftPercent: -5, winnerVariantId: 'b',
      variants, trafficTier: 'low', dailyTraffic: 10, runningDays: 14,
    });
    expect(out.effectSizePercent).toBe(5);
    expect(out.winnerFeatures).toEqual({ position: 'below' });
  });

  it('records no winner + zero effect for NO_DIFFERENCE', () => {
    const out = buildCrossStoreLearning({
      slot: 'scarcity', verdict: 'NO_DIFFERENCE', liftPercent: 1.2, winnerVariantId: null,
      variants, trafficTier: 'high', dailyTraffic: 800, runningDays: 7,
    });
    expect(out.winnerFeatures).toBeNull();
    expect(out.loserFeatures).toBeNull();
    expect(out.winnerLabel).toBeNull();
    expect(out.effectSizePercent).toBe(0);
    expect(out.verdict).toBe('NO_DIFFERENCE');
  });

  it('handles null/undefined lift gracefully', () => {
    const out = buildCrossStoreLearning({
      slot: 'x', verdict: 'WINNER', liftPercent: null, winnerVariantId: 'a',
      variants, trafficTier: 'low', dailyTraffic: 5, runningDays: 14,
    });
    expect(out.effectSizePercent).toBe(0);
    expect(out.confidence).toBeNull();
  });
});
