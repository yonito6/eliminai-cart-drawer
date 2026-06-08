// backend/src/lib/cross-store-learning.ts
//
// When an experiment reaches a terminal verdict we snapshot what was learned so the
// (future) cross-store suggestion engine can mine it: the effect size, the exact
// variant configs that won/lost, and the store context the result was observed in.
//
// This is captured into the experiment's `notes.crossStoreLearning` JSON — no schema
// change, no migration. It is purely additive observability.

export type TrafficTier = 'low' | 'medium' | 'high';

export interface LearningVariant {
  id: string;
  label?: string;
  features: Record<string, any>;
}

export interface CrossStoreLearningInput {
  slot: string;
  verdict: 'WINNER' | 'NO_DIFFERENCE' | 'INCONCLUSIVE';
  liftPercent: number | null | undefined;
  winnerVariantId: string | null | undefined;
  variants: LearningVariant[];
  trafficTier: TrafficTier;
  dailyTraffic: number;
  runningDays: number;
  confidence?: number | null;
}

export interface CrossStoreLearning {
  slot: string;
  verdict: 'WINNER' | 'NO_DIFFERENCE' | 'INCONCLUSIVE';
  effectSizePercent: number;          // absolute lift magnitude of the winner over the loser
  winnerFeatures: Record<string, any> | null;
  loserFeatures: Record<string, any> | null;
  winnerLabel: string | null;
  trafficTier: TrafficTier;
  dailyTraffic: number;
  runningDays: number;
  confidence: number | null;
  decidedAt: string;                  // ISO timestamp
}

/**
 * Build the learning snapshot for a concluded experiment. Pure — no I/O — so the cron
 * can call it and store the result in `notes`.
 *
 * For a WINNER: winnerFeatures = the winning variant's config, loserFeatures = the other
 * arm (A/B), effectSize = |liftPercent|.
 * For NO_DIFFERENCE / INCONCLUSIVE: no winner, effectSize 0, winner/loser features null.
 */
export function buildCrossStoreLearning(input: CrossStoreLearningInput): CrossStoreLearning {
  const {
    slot, verdict, liftPercent, winnerVariantId, variants,
    trafficTier, dailyTraffic, runningDays, confidence,
  } = input;

  let winnerFeatures: Record<string, any> | null = null;
  let loserFeatures: Record<string, any> | null = null;
  let winnerLabel: string | null = null;
  let effectSizePercent = 0;

  if (verdict === 'WINNER' && winnerVariantId) {
    const winner = variants.find(v => v.id === winnerVariantId) || null;
    const loser = variants.find(v => v.id !== winnerVariantId) || null;
    winnerFeatures = winner ? winner.features : null;
    loserFeatures = loser ? loser.features : null;
    winnerLabel = winner?.label ?? null;
    effectSizePercent = Math.abs(Number(liftPercent ?? 0));
  }

  return {
    slot,
    verdict,
    effectSizePercent: Math.round(effectSizePercent * 100) / 100,
    winnerFeatures,
    loserFeatures,
    winnerLabel,
    trafficTier,
    dailyTraffic,
    runningDays,
    confidence: confidence ?? null,
    decidedAt: new Date().toISOString(),
  };
}
