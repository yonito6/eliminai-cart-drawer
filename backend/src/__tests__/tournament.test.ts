import { describe, it, expect } from 'vitest';
import { createTournamentBracket, advanceTournament, getTournamentStatus } from '../lib/tournament';

describe('createTournamentBracket', () => {
  it('creates bracket from 4 variants', () => {
    const variants = [
      { id: 'a', name: 'Variant A', features: {} },
      { id: 'b', name: 'Variant B', features: {} },
      { id: 'c', name: 'Variant C', features: {} },
      { id: 'd', name: 'Variant D', features: {} },
    ];
    const bracket = createTournamentBracket(variants);
    expect(bracket.rounds).toHaveLength(2); // 4 variants = 2 rounds
    expect(bracket.rounds[0].matches).toHaveLength(2); // Round 1: 2 matches
    expect(bracket.rounds[1].matches).toHaveLength(1); // Final: 1 match
    expect(bracket.currentRound).toBe(0);
    expect(bracket.champion).toBeNull();
  });

  it('creates bracket from 3 variants (bye for odd)', () => {
    const variants = [
      { id: 'a', name: 'A', features: {} },
      { id: 'b', name: 'B', features: {} },
      { id: 'c', name: 'C', features: {} },
    ];
    const bracket = createTournamentBracket(variants);
    expect(bracket.rounds).toHaveLength(2);
    // Round 1: 1 match (a vs b) + c gets a bye
    expect(bracket.rounds[0].matches).toHaveLength(1);
    expect(bracket.rounds[0].byes).toContain('c');
  });

  it('handles 2 variants (just one match)', () => {
    const variants = [
      { id: 'a', name: 'A', features: {} },
      { id: 'b', name: 'B', features: {} },
    ];
    const bracket = createTournamentBracket(variants);
    expect(bracket.rounds).toHaveLength(1);
    expect(bracket.rounds[0].matches).toHaveLength(1);
  });
});

describe('advanceTournament', () => {
  it('advances winner to next round', () => {
    const variants = [
      { id: 'a', name: 'A', features: {} },
      { id: 'b', name: 'B', features: {} },
      { id: 'c', name: 'C', features: {} },
      { id: 'd', name: 'D', features: {} },
    ];
    let bracket = createTournamentBracket(variants);

    // Winner of match 0 in round 0
    bracket = advanceTournament(bracket, 0, 'a');
    expect(bracket.rounds[0].matches[0].winnerId).toBe('a');

    // Winner of match 1 in round 0
    bracket = advanceTournament(bracket, 1, 'd');
    expect(bracket.rounds[0].matches[1].winnerId).toBe('d');
    // Round should auto-advance since both matches done
    expect(bracket.currentRound).toBe(1);
    // Final should have a vs d
    expect(bracket.rounds[1].matches[0].variantA).toBe('a');
    expect(bracket.rounds[1].matches[0].variantB).toBe('d');
  });

  it('sets champion when final match decided', () => {
    const variants = [
      { id: 'a', name: 'A', features: {} },
      { id: 'b', name: 'B', features: {} },
    ];
    let bracket = createTournamentBracket(variants);
    bracket = advanceTournament(bracket, 0, 'a');
    expect(bracket.champion).toBe('a');
  });
});

describe('getTournamentStatus', () => {
  it('returns current match info', () => {
    const variants = [
      { id: 'a', name: 'A', features: {} },
      { id: 'b', name: 'B', features: {} },
      { id: 'c', name: 'C', features: {} },
      { id: 'd', name: 'D', features: {} },
    ];
    const bracket = createTournamentBracket(variants);
    const status = getTournamentStatus(bracket);
    expect(status.currentRound).toBe(0);
    expect(status.totalRounds).toBe(2);
    expect(status.currentMatch).toBeDefined();
    expect(status.isComplete).toBe(false);
  });
});
