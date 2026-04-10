/**
 * Tournament bracket — sequential 2-at-a-time variant elimination.
 * Supports any number of variants, handles byes for odd counts.
 */

interface TournamentMatch {
  variantA: string;
  variantB: string;
  winnerId: string | null;
}

interface TournamentRound {
  matches: TournamentMatch[];
  byes: string[]; // variants that advance without playing (odd count)
}

export interface TournamentBracket {
  rounds: TournamentRound[];
  currentRound: number;
  champion: string | null;
  variants: Array<{ id: string; name: string; features: Record<string, any> }>;
}

/**
 * Create a bracket from a list of variants.
 * Always 2 variants per match, sequential elimination.
 */
export function createTournamentBracket(
  variants: Array<{ id: string; name: string; features: Record<string, any> }>,
): TournamentBracket {
  if (variants.length < 2) {
    return { rounds: [], currentRound: 0, champion: variants[0]?.id || null, variants };
  }

  const rounds: TournamentRound[] = [];
  let remaining = variants.map(v => v.id);

  // Build round structure
  while (remaining.length > 1) {
    const matches: TournamentMatch[] = [];
    const byes: string[] = [];

    for (let i = 0; i < remaining.length - 1; i += 2) {
      matches.push({
        variantA: remaining[i],
        variantB: remaining[i + 1],
        winnerId: null,
      });
    }

    // Odd variant gets a bye
    if (remaining.length % 2 === 1) {
      byes.push(remaining[remaining.length - 1]);
    }

    rounds.push({ matches, byes });

    // Next round has match winners + byes
    remaining = new Array(matches.length + byes.length).fill(null);
  }

  return { rounds, currentRound: 0, champion: null, variants };
}

/**
 * Record a match winner and advance the bracket.
 */
export function advanceTournament(
  bracket: TournamentBracket,
  matchIndex: number,
  winnerId: string,
): TournamentBracket {
  const updated = JSON.parse(JSON.stringify(bracket)) as TournamentBracket;
  const round = updated.rounds[updated.currentRound];

  if (!round || matchIndex >= round.matches.length) return updated;

  round.matches[matchIndex].winnerId = winnerId;

  // Check if all matches in current round are decided
  const allDecided = round.matches.every(m => m.winnerId !== null);

  if (allDecided) {
    const winners = round.matches.map(m => m.winnerId!);
    const advancing = [...winners, ...round.byes];

    // Is this the final round?
    if (updated.currentRound === updated.rounds.length - 1) {
      updated.champion = advancing[0];
    } else {
      // Populate next round matches
      updated.currentRound++;
      const nextRound = updated.rounds[updated.currentRound];
      let advIdx = 0;
      for (const match of nextRound.matches) {
        match.variantA = advancing[advIdx++];
        match.variantB = advancing[advIdx++];
      }
      // Handle bye for next round
      if (advancing.length % 2 === 1 && advIdx < advancing.length) {
        nextRound.byes = [advancing[advIdx]];
      }
    }
  }

  return updated;
}

/**
 * Get human-readable tournament status.
 */
export function getTournamentStatus(bracket: TournamentBracket) {
  const round = bracket.rounds[bracket.currentRound];
  const pendingMatch = round?.matches.find(m => m.winnerId === null);

  return {
    currentRound: bracket.currentRound,
    totalRounds: bracket.rounds.length,
    currentMatch: pendingMatch || null,
    isComplete: bracket.champion !== null,
    champion: bracket.champion,
    rounds: bracket.rounds,
  };
}
