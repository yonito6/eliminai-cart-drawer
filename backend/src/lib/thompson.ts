// eslint-disable-next-line @typescript-eslint/no-require-imports
const jStat = require('jstat');

interface VariantStats {
  id: string;
  successes: number;  // ORDER_COMPLETED count (the metric we optimize for)
  failures: number;   // CART_OPENED without ORDER_COMPLETED
}

interface VariantDisplayStats {
  id: string;
  cartOpens: number;
  checkouts: number;
  orders: number;
}

interface Prior {
  alpha: number;  // prior successes (orders)
  beta: number;   // prior failures (non-orders)
}

interface ThompsonOptions {
  // Cross-store priors — learned from other stores' experiments
  priors?: Record<string, Prior>;
  // Traffic tier affects winner declaration thresholds
  dailyTraffic?: number;
  // Display stats — checkout & order rates for dashboard (NOT used in algorithm)
  displayStats?: VariantDisplayStats[];
  // Minimum calendar days before declaring winner (day-of-week effects)
  minDaysRunning?: number;
}

interface ThompsonResult {
  trafficSplit: Record<string, number>;
  confidence: number;           // P(best > second)
  expectedLoss: number;         // Expected conversion rate lost if we pick wrong winner (pp)
  winnerId: string | null;
  liftPercent: number;
  reason?: string;              // Why winner was/wasn't declared
  orderRates?: Record<string, number>;     // Per-variant order rate (orders/cartOpens) — THE metric
  checkoutRates?: Record<string, number>;  // Per-variant checkout rate — display only
  explorationMinPerVariant?: number;       // Exported for dashboard progress display
}

const NUM_SAMPLES = 10000;

/**
 * Thompson Sampling — optimizes for ORDER rate (orders / cart opens).
 *
 * successes = ORDER_COMPLETED, failures = CART_OPENED without order.
 * Checkout clicks are display-only and never fed into the algorithm.
 *
 * Why orders not checkouts: A variant with aggressive scarcity might get
 * 50 checkout clicks but 1 order, while a calmer variant gets 6 clicks
 * but 5 orders. Checkout-steered Thompson would starve the real winner.
 *
 * With rare order events, Thompson naturally stays ~50/50 (wide posteriors
 * overlap), so no special "checkout-steered phase" is needed.
 */
export function calculateThompsonSampling(
  variants: VariantStats[],
  options: ThompsonOptions = {}
): ThompsonResult {
  const { priors = {}, dailyTraffic = 100, displayStats, minDaysRunning = 0 } = options;

  // Draw samples from Beta distribution for each variant
  // Prior: cross-store data if available, otherwise weak uninformative Beta(1, 1)
  const samples: Record<string, number[]> = {};
  const means: Record<string, number> = {};

  for (const v of variants) {
    const prior = priors[v.id] || { alpha: 1, beta: 1 };
    const alpha = v.successes + prior.alpha;
    const beta = v.failures + prior.beta;
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

  // Expected loss (Spotify method): if we pick the best arm but it's actually worse,
  // how much conversion rate do we lose on average?
  // = average of max(0, second_sample - best_sample) across all simulations
  let totalLoss = 0;
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const loss = Math.max(0, samples[secondId][i] - samples[bestId][i]);
    totalLoss += loss;
  }
  const expectedLoss = (totalLoss / NUM_SAMPLES) * 100; // in percentage points

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

  // Compute totals FIRST (used by exploration + winner declaration)
  const totalObservations = variants.reduce((s, v) => s + v.successes + v.failures, 0);
  const minObsPerArm = Math.min(...variants.map(v => v.successes + v.failures));

  // Smart exploration phase — based on observed ORDER rate + daily traffic
  // Goal: enough data per variant so Thompson's posterior is stable
  // Formula: n ≥ p*(1-p) / 0.000417 for ~8pp CI width
  const observedRate = totalObservations > 0
    ? variants.reduce((s, v) => s + v.successes, 0) / totalObservations
    : 0.03; // default assumption: ~3% order rate before any data
  const rateForCalc = Math.max(0.01, Math.min(observedRate, 0.50));
  const statisticalMin = Math.ceil(rateForCalc * (1 - rateForCalc) / 0.000417);
  const clampedMin = Math.max(25, Math.min(statisticalMin, 200));
  const trafficDiscount = dailyTraffic < 50 ? 0.6 : dailyTraffic < 200 ? 0.8 : 1.0;
  const explorationMin = Math.max(20, Math.round(clampedMin * trafficDiscount));

  if (minObsPerArm < explorationMin) {
    // Exploration: force equal split — no Thompson steering until we have enough data
    const equalShare = 1 / variants.length;
    for (const id of Object.keys(trafficSplit)) {
      trafficSplit[id] = equalShare;
    }
  } else {
    // Exploitation: Thompson steers traffic, but with a safety floor
    // Floor scales inversely with traffic — high-traffic can be more aggressive
    const safetyFloor = dailyTraffic >= 500 ? 0.05 : dailyTraffic >= 50 ? 0.10 : 0.15;
    for (const id of Object.keys(trafficSplit)) {
      if (trafficSplit[id] < safetyFloor) trafficSplit[id] = safetyFloor;
    }
    // Normalize
    const total = Object.values(trafficSplit).reduce((a, b) => a + b, 0);
    for (const id of Object.keys(trafficSplit)) {
      trafficSplit[id] = trafficSplit[id] / total;
    }
  }

  // Lift calculation
  const bestMean = means[bestId];
  const secondMean = means[secondId];
  const liftPercent = secondMean > 0
    ? ((bestMean - secondMean) / secondMean) * 100
    : 0;

  // ── Winner declaration: traffic-adaptive thresholds ──
  let winnerId: string | null = null;
  let reason = '';

  // Minimum calendar days check (day-of-week effects)
  if (minDaysRunning < 3) {
    reason = 'Need at least 3 days to capture traffic patterns';
  }
  // Minimum observations check (traffic-adaptive)
  else if (minObsPerArm < explorationMin) {
    reason = `Need at least ${explorationMin} unique visitors per variant (${dailyTraffic}/day traffic)`;
  }
  // Traffic-adaptive winner declaration
  else {
    // Thresholds by traffic tier
    let confThreshold: number;
    let lossThreshold: number; // max expected loss in percentage points

    if (dailyTraffic >= 500) {
      // High traffic: can be aggressive
      confThreshold = 0.90;
      lossThreshold = 0.05;
    } else if (dailyTraffic >= 50) {
      // Medium traffic: balanced
      confThreshold = 0.90;
      lossThreshold = 0.10;
    } else {
      // Low traffic: more conservative
      confThreshold = 0.85;
      lossThreshold = 0.15;
    }

    if (confidence >= confThreshold && expectedLoss <= lossThreshold && Math.abs(liftPercent) > 1) {
      winnerId = bestId;
      reason = `Winner: confidence ${(confidence * 100).toFixed(1)}% >= ${confThreshold * 100}%, expected loss ${expectedLoss.toFixed(3)}pp <= ${lossThreshold}pp`;
    } else if (confidence >= 0.95 && Math.abs(liftPercent) <= 1) {
      // High confidence but no meaningful difference
      winnerId = null; // will be marked NO_DIFFERENCE by cron
      reason = `No meaningful difference (lift ${liftPercent.toFixed(1)}% with ${(confidence * 100).toFixed(1)}% confidence)`;
    } else if (minObsPerArm >= 50 && Math.abs(liftPercent) < 3 && confidence >= 0.60) {
      // Early stop: enough data to see there's no meaningful impact — move on to next test
      winnerId = null; // will be marked NO_DIFFERENCE by cron
      reason = `Low impact detected early (lift ${liftPercent.toFixed(1)}%, ${minObsPerArm} visitors/variant) — move on to next test`;
    } else {
      reason = `Collecting data: confidence ${(confidence * 100).toFixed(1)}%, expected loss ${expectedLoss.toFixed(3)}pp, lift ${liftPercent.toFixed(1)}%`;
    }
  }


  // Calculate per-variant rates for display
  // Order rate = the primary metric (what Thompson optimizes)
  const orderRates: Record<string, number> = {};
  for (const v of variants) {
    const total = v.successes + v.failures;
    orderRates[v.id] = total > 0 ? v.successes / total : 0;
  }

  // Checkout rate = display-only metric (NOT used by Thompson)
  const checkoutRates: Record<string, number> = {};
  if (displayStats && displayStats.length > 0) {
    for (const ds of displayStats) {
      checkoutRates[ds.id] = ds.cartOpens > 0 ? ds.checkouts / ds.cartOpens : 0;
    }
  }

  return {
    trafficSplit,
    confidence,
    expectedLoss,
    winnerId,
    liftPercent,
    reason,
    orderRates,
    checkoutRates: Object.keys(checkoutRates).length > 0 ? checkoutRates : undefined,
    explorationMinPerVariant: explorationMin,
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

/**
 * Build cross-store priors from completed experiments across all stores.
 * This is the hierarchical learning — stores that tested the same addon
 * share their results to help new/low-traffic stores converge faster.
 */
export function buildCrossStorePriors(
  completedExperiments: Array<{
    slot: string;
    variants: Array<{ id: string; successes: number; failures: number }>;
  }>,
  targetSlot: string,
  trafficTier: 'low' | 'medium' | 'high'
): Record<string, Prior> {
  // Find all completed experiments for this same addon slot
  const relevant = completedExperiments.filter(e => e.slot === targetSlot);
  if (relevant.length === 0) return {};

  // Aggregate successes/failures across stores per variant ID
  const aggregated: Record<string, { successes: number; failures: number }> = {};
  for (const exp of relevant) {
    for (const v of exp.variants) {
      if (!aggregated[v.id]) aggregated[v.id] = { successes: 0, failures: 0 };
      aggregated[v.id].successes += v.successes;
      aggregated[v.id].failures += v.failures;
    }
  }

  // Scale the prior strength based on traffic tier
  // Low traffic stores get stronger priors (more cross-store influence)
  // High traffic stores get weaker priors (let own data dominate)
  const scaleFactor = trafficTier === 'low' ? 0.5 : trafficTier === 'medium' ? 0.2 : 0.05;

  const priors: Record<string, Prior> = {};
  for (const [variantId, stats] of Object.entries(aggregated)) {
    const totalObs = stats.successes + stats.failures;
    if (totalObs < 10) continue; // not enough cross-store data
    priors[variantId] = {
      alpha: Math.max(1, Math.round(stats.successes * scaleFactor)),
      beta: Math.max(1, Math.round(stats.failures * scaleFactor)),
    };
  }

  return priors;
}

/**
 * Determine optimal batch frequency based on daily traffic.
 * Returns interval in hours.
 */
export function getOptimalBatchInterval(dailyTraffic: number): number {
  if (dailyTraffic >= 500) return 1;   // Hourly
  if (dailyTraffic >= 50) return 6;    // Every 6 hours
  return 24;                            // Daily
}
