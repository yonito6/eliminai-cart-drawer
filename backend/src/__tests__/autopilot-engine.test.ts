// backend/src/__tests__/autopilot-engine.test.ts
import { describe, it, expect } from 'vitest';
import { planNextAction } from '../lib/autopilot-engine';

const base = {
  enabled: true,
  currentTestSlot: 'trustBadges:enabled',
  queue: ['trustBadges:enabled', 'scarcityTimer:enabled', 'freeShippingBar:enabled'],
  completedCount: 0,
  totalLift: 0,
  startedAt: '2026-06-01T00:00:00.000Z',
};

describe('planNextAction', () => {
  it('on WINNER_FOUND: applies winner, advances queue, picks next slot', () => {
    const r = planNextAction(base, { slot: 'trustBadges', status: 'WINNER_FOUND', winnerFeatures: { _enabled: true }, liftPercent: 5 });
    expect(r.applyWinner).toBe(true);
    expect(r.winnerFeatures).toEqual({ _enabled: true });
    expect(r.nextSlot).toBe('scarcityTimer:enabled');
    expect(r.autopilot.queue).toEqual(['scarcityTimer:enabled', 'freeShippingBar:enabled']);
    expect(r.autopilot.completedCount).toBe(1);
    expect(r.autopilot.totalLift).toBe(5);
    expect(r.autopilot.currentTestSlot).toBe('scarcityTimer:enabled');
  });

  it('on NO_DIFFERENCE: does NOT apply, still advances and picks next', () => {
    const r = planNextAction(base, { slot: 'trustBadges', status: 'NO_DIFFERENCE', liftPercent: 0 });
    expect(r.applyWinner).toBe(false);
    expect(r.nextSlot).toBe('scarcityTimer:enabled');
    expect(r.autopilot.completedCount).toBe(1);
    expect(r.autopilot.totalLift).toBe(0);
  });

  it('on REVERTED: does NOT apply (control kept) and advances', () => {
    const r = planNextAction(base, { slot: 'trustBadges', status: 'REVERTED', liftPercent: 0 });
    expect(r.applyWinner).toBe(false);
    expect(r.nextSlot).toBe('scarcityTimer:enabled');
  });

  it('when the queue empties, nextSlot is null and currentTestSlot is null', () => {
    const last = { ...base, queue: ['trustBadges:enabled'], currentTestSlot: 'trustBadges:enabled' };
    const r = planNextAction(last, { slot: 'trustBadges', status: 'WINNER_FOUND', winnerFeatures: {}, liftPercent: 2 });
    expect(r.nextSlot).toBeNull();
    expect(r.autopilot.queue).toEqual([]);
    expect(r.autopilot.currentTestSlot).toBeNull();
  });

  it('removes the finished slot even if it is not at the head (defensive)', () => {
    const r = planNextAction(base, { slot: 'scarcityTimer', status: 'NO_DIFFERENCE', liftPercent: 0 });
    expect(r.autopilot.queue).toEqual(['trustBadges:enabled', 'freeShippingBar:enabled']);
    expect(r.nextSlot).toBe('trustBadges:enabled');
  });
});
