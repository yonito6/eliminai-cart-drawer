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

import { requiredEvidenceFloor, HARD_MIN_FLOOR } from '../lib/winner-decision';

describe('requiredEvidenceFloor', () => {
  const base = {
    consecutiveLeaderDays: 4,
    confidence: 0.99,
    expectedLoss: 0.01,
    dynamicLossThreshold: 0.05,   // half = 0.025, loss 0.01 ≤ 0.025 → credit
    targetOrdersPerVariant: 30,
  };
  it('earns credit → slides to hard minimum (15)', () => {
    expect(requiredEvidenceFloor(base)).toBe(HARD_MIN_FLOOR);
  });
  it('flipping leader (consecutive<4) → no credit → full target floor', () => {
    expect(requiredEvidenceFloor({ ...base, consecutiveLeaderDays: 2 })).toBe(30);
  });
  it('confidence below 0.99 → no credit → full target floor', () => {
    expect(requiredEvidenceFloor({ ...base, confidence: 0.96 })).toBe(30);
  });
  it('loss above half-threshold → no credit → full target floor', () => {
    expect(requiredEvidenceFloor({ ...base, expectedLoss: 0.04 })).toBe(30);
  });
});

import { decideVerdict, WinnerDecisionInput } from '../lib/winner-decision';

// A fully-passing HIGH-tier input: all 6 gates satisfied, credit earned.
const PASSING: WinnerDecisionInput = {
  confidence: 0.991,
  expectedLoss: 0.01,
  liftPercent: 97,
  winnerCandidateId: 'without_addon',
  leaderOrders: 20,
  loserOrders: 16,            // ≥ HARD_MIN_FLOOR (15), credit earned
  targetOrdersPerVariant: 30,
  dynamicLossThreshold: 0.05,
  visitorsPerDay: 600,        // HIGH
  runningDays: 5,             // ≥ MIN_DAYS.HIGH (4)
  hasSaturday: true,
  hasSunday: true,
  consecutiveLeaderDays: 5,   // credit
  maxDays: 14,
};

describe('decideVerdict', () => {
  it('all gates pass → WINNER (Eleganto express replay, reduced floor)', () => {
    const v = decideVerdict(PASSING);
    expect(v.kind).toBe('WINNER');
    if (v.kind === 'WINNER') expect(v.winnerId).toBe('without_addon');
  });

  it('weekend incomplete (no Sunday) before cap → WAIT (volume cannot skip it)', () => {
    const v = decideVerdict({ ...PASSING, hasSunday: false, visitorsPerDay: 100000, confidence: 0.999, runningDays: 6 });
    expect(v.kind).toBe('WAIT');
  });

  it('below min days for HIGH (day 3) → WAIT', () => {
    expect(decideVerdict({ ...PASSING, runningDays: 3 }).kind).toBe('WAIT');
  });

  it('confidence below 0.95 → WAIT', () => {
    expect(decideVerdict({ ...PASSING, confidence: 0.90 }).kind).toBe('WAIT');
  });

  it('expected loss above threshold → WAIT', () => {
    expect(decideVerdict({ ...PASSING, expectedLoss: 0.20 }).kind).toBe('WAIT');
  });

  it('gates 1-4 pass but lift below 5% → NO_DIFFERENCE', () => {
    const v = decideVerdict({ ...PASSING, liftPercent: 0.4 });
    expect(v.kind).toBe('NO_DIFFERENCE');
  });

  it('credit NOT earned (leader flipped) + loser below full floor → WAIT', () => {
    const v = decideVerdict({ ...PASSING, consecutiveLeaderDays: 2, loserOrders: 16 });
    expect(v.kind).toBe('WAIT'); // floor is 30, loser has 16
  });

  it('zero-laggard guard: loser 0 orders, leader 18 → WINNER not NO_DIFFERENCE', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 0, leaderOrders: 18, liftPercent: 0 });
    expect(v.kind).toBe('WINNER');
  });

  it('zero-laggard boundary: loser 0, leader exactly 8 → WINNER (>= ZERO_LAGGARD_MIN_LEADER)', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 0, leaderOrders: 8, liftPercent: 0 });
    expect(v.kind).toBe('WINNER');
  });

  it('zero-laggard but leader below absolute floor (7) → WAIT not NO_DIFFERENCE', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 0, leaderOrders: 7, liftPercent: 0, consecutiveLeaderDays: 2 });
    expect(v.kind).toBe('WAIT');
  });

  it('non-zero loser at exactly the slid floor (15 with credit) → WINNER (boundary, inclusive)', () => {
    const v = decideVerdict({ ...PASSING, loserOrders: 15 });  // credit earned → floor 15
    expect(v.kind).toBe('WINNER');
  });

  it('LOW tier at cap without floor → INCONCLUSIVE', () => {
    const v = decideVerdict({
      ...PASSING, visitorsPerDay: 30, runningDays: 14, loserOrders: 5,
      consecutiveLeaderDays: 1, confidence: 0.96,
    });
    expect(v.kind).toBe('INCONCLUSIVE');
  });

  it('HIGH tier at cap without a winner → NO_DIFFERENCE backstop', () => {
    const v = decideVerdict({
      ...PASSING, runningDays: 14, loserOrders: 5, consecutiveLeaderDays: 1, confidence: 0.96,
    });
    expect(v.kind).toBe('NO_DIFFERENCE');
  });

  it('null candidate before cap → WAIT', () => {
    expect(decideVerdict({ ...PASSING, winnerCandidateId: null }).kind).toBe('WAIT');
  });
});
