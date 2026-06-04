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

// append to backend/src/__tests__/autopilot-engine.test.ts
import { progressAutopilot } from '../lib/autopilot-engine';
import { vi } from 'vitest';

function mockPrisma(storeConfig: any, completed: any[] = []) {
  return {
    store: {
      findUnique: vi.fn().mockResolvedValue({ id: 's1', config: storeConfig }),
      update: vi.fn().mockResolvedValue({}),
    },
    experiment: {
      findMany: vi.fn().mockResolvedValue(completed),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'eNew', startedAt: new Date(), ...data })),
    },
  } as any;
}

describe('progressAutopilot', () => {
  const autopilot = {
    enabled: true, currentTestSlot: 'trustBadges:enabled',
    queue: ['trustBadges:enabled', 'scarcityTimer:enabled'],
    completedCount: 0, totalLift: 0, startedAt: '2026-06-01T00:00:00.000Z',
  };

  it('applies the winner to config.addons and starts the next test', async () => {
    const prisma = mockPrisma({ autopilot, addons: { trustBadges: { config: { text: 'old' } } } });
    const out = await progressAutopilot(prisma, 's1', {
      slot: 'trustBadges', status: 'WINNER_FOUND', winnerFeatures: { _enabled: true }, liftPercent: 4,
    });
    expect(prisma.store.update).toHaveBeenCalled();
    const created = (prisma.experiment.create as any).mock.calls[0][0].data;
    expect(created.slot).toBe('scarcityTimer');
    expect(created.status).toBe('RUNNING');
    expect(out.startedExperimentId).toBe('eNew');
    expect(out.autopilot.currentTestSlot).toBe('scarcityTimer:enabled');
  });

  it('does not create a test when the queue is exhausted', async () => {
    const single = { ...autopilot, queue: ['trustBadges:enabled'] };
    const prisma = mockPrisma({ autopilot: single, addons: {} });
    const out = await progressAutopilot(prisma, 's1', { slot: 'trustBadges', status: 'NO_DIFFERENCE', liftPercent: 0 });
    expect(prisma.experiment.create).not.toHaveBeenCalled();
    expect(out.startedExperimentId).toBeNull();
    expect(out.autopilot.currentTestSlot).toBeNull();
  });

  it('skips an un-buildable slot and starts the next one IN THE SAME TICK', async () => {
    const withBogus = {
      ...autopilot,
      queue: ['trustBadges:enabled', 'bogusAddon:enabled', 'scarcityTimer:enabled'],
    };
    const prisma = mockPrisma({ autopilot: withBogus, addons: {} });
    const out = await progressAutopilot(prisma, 's1', {
      slot: 'trustBadges', status: 'WINNER_FOUND', winnerFeatures: { _enabled: true }, liftPercent: 3,
    });
    expect((prisma.experiment.create as any).mock.calls[0][0].data.slot).toBe('scarcityTimer');
    expect(out.startedExperimentId).toBe('eNew');
    expect(out.autopilot.queue).toEqual(['scarcityTimer:enabled']);
    expect(out.autopilot.currentTestSlot).toBe('scarcityTimer:enabled');
  });

  it('stops cleanly when ALL remaining slots are un-buildable', async () => {
    const allBogus = { ...autopilot, queue: ['trustBadges:enabled', 'bogusAddon:enabled'] };
    const prisma = mockPrisma({ autopilot: allBogus, addons: {} });
    const out = await progressAutopilot(prisma, 's1', { slot: 'trustBadges', status: 'NO_DIFFERENCE', liftPercent: 0 });
    expect(prisma.experiment.create).not.toHaveBeenCalled();
    expect(out.startedExperimentId).toBeNull();
    expect(out.autopilot.queue).toEqual([]);
    expect(out.autopilot.currentTestSlot).toBeNull();
  });
});
