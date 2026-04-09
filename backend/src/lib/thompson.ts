// eslint-disable-next-line @typescript-eslint/no-require-imports
const jStat = require('jstat');

interface VariantStats {
  id: string;
  successes: number;
  failures: number;
}

interface ThompsonResult {
  trafficSplit: Record<string, number>;
  confidence: number;
  winnerId: string | null;
  liftPercent: number;
}

const NUM_SAMPLES = 10000;

export function calculateThompsonSampling(variants: VariantStats[]): ThompsonResult {
  // Draw samples from Beta distribution for each variant
  const samples: Record<string, number[]> = {};
  const means: Record<string, number> = {};

  for (const v of variants) {
    const alpha = v.successes + 1; // +1 uniform prior
    const beta = v.failures + 1;
    const draws: number[] = [];
    for (let i = 0; i < NUM_SAMPLES; i++) {
      draws.push(jStat.beta.sample(alpha, beta));
    }
    samples[v.id] = draws;
    means[v.id] = draws.reduce((a: number, b: number) => a + b, 0) / NUM_SAMPLES;
  }

  // Find best variant by mean
  const sortedIds = Object.keys(means).sort((a, b) => means[b] - means[a]);
  const bestId = sortedIds[0];
  const secondId = sortedIds[1];

  // Confidence: fraction of samples where best > second
  let bestWins = 0;
  for (let i = 0; i < NUM_SAMPLES; i++) {
    if (samples[bestId][i] > samples[secondId][i]) bestWins++;
  }
  const confidence = bestWins / NUM_SAMPLES;

  // Traffic split: probability each variant is best
  const trafficSplit: Record<string, number> = {};
  for (const v of variants) {
    let wins = 0;
    for (let i = 0; i < NUM_SAMPLES; i++) {
      const isBest = variants.every(
        other => other.id === v.id || samples[v.id][i] > samples[other.id][i]
      );
      if (isBest) wins++;
    }
    trafficSplit[v.id] = wins / NUM_SAMPLES;
  }

  // Ensure no variant gets less than 5% (safety floor)
  for (const id of Object.keys(trafficSplit)) {
    if (trafficSplit[id] < 0.05) trafficSplit[id] = 0.05;
  }
  // Normalize
  const total = Object.values(trafficSplit).reduce((a, b) => a + b, 0);
  for (const id of Object.keys(trafficSplit)) {
    trafficSplit[id] = trafficSplit[id] / total;
  }

  // Lift calculation
  const bestMean = means[bestId];
  const secondMean = means[secondId];
  const liftPercent = secondMean > 0
    ? ((bestMean - secondMean) / secondMean) * 100
    : 0;

  return {
    trafficSplit,
    confidence,
    winnerId: confidence >= 0.95 ? bestId : null,
    liftPercent,
  };
}

export function pickVariant(trafficSplit: Record<string, number>): string {
  const rand = Math.random();
  let cumulative = 0;
  for (const [id, weight] of Object.entries(trafficSplit)) {
    cumulative += weight;
    if (rand <= cumulative) return id;
  }
  // Fallback: return last variant
  return Object.keys(trafficSplit).at(-1)!;
}
