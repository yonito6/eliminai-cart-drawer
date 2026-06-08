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
  // Average daily orders for this store (used for dynamic hard floor)
  dailyOrders?: number;
}

interface ThompsonResult {
  trafficSplit: Record<string, number>;
  confidence: number;           // P(best > second)
  expectedLoss: number;         // Expected conversion rate lost if we pick wrong winner (pp)
  winnerCandidateId: string | null;  // statistical leader (bestId); decision made by winner-decision.ts
  dynamicLossThreshold: number;      // tier-scaled expected-loss threshold (for decideVerdict)
  liftPercent: number;
  orderRates?: Record<string, number>;     // Per-variant order rate (orders/cartOpens) — THE metric
  checkoutRates?: Record<string, number>;  // Per-variant checkout rate — display only
  explorationMinPerVariant?: number;       // Exported for dashboard progress display
  minOrdersPerVariant: number;             // Dynamic minimum orders needed per variant
  // ── Smooth dampening fields (new) ──
  dataMaturity: number;                    // 0-1: how much data vs target (drives dampening)
  targetOrdersPerVariant: number;          // Dynamic order target from power analysis
  currentDetectableLift: number;           // Smallest relative lift detectable right now (%)
  hardFloorPerVariant: number;             // Dynamic hard floor — pure 50/50 until this many orders per arm
}

interface DailyLeader {
  date: string;       // ISO date (YYYY-MM-DD)
  leaderId: string;   // variant ID that led this day
  liftPct: number;    // observed lift that day
}

interface ConsistencyResult {
  score: number;         // 0-1: fraction of days the current leader led
  multiplier: number;    // 1.0, 1.5, or 2.0 — extends sample target
  message: string | null; // null = stable, string = explanation for user
}

interface SampleTargetResult {
  nPerVariant: number;    // visitors needed per variant
  totalNeeded: number;    // total visitors across all variants
  baselineRate: number;   // the purchase rate used for calculation
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
  const { priors = {}, dailyTraffic = 100, displayStats, minDaysRunning = 0, dailyOrders = 0 } = options;

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

  // Compute totals FIRST (used by dampening + winner declaration)
  const totalObservations = variants.reduce((s, v) => s + v.successes + v.failures, 0);
  const minObsPerArm = Math.min(...variants.map(v => v.successes + v.failures));
  const minOrdersPerArm = Math.min(...variants.map(v => v.successes));

  // ── Observed purchase rate (recalculated as data arrives) ──
  const observedRate = totalObservations > 0
    ? variants.reduce((s, v) => s + v.successes, 0) / totalObservations
    : 0.03; // default assumption: ~3% order rate before any data

  // ── Dynamic order target from power analysis ──
  // Uses adaptive MDE: 75% for low-rate stores, 50% for high-rate
  const sampleTarget = calculateSampleTarget(observedRate, variants.length);
  const targetOrdersPerVariant = Math.max(15, Math.ceil(sampleTarget.nPerVariant * Math.max(0.005, observedRate)));

  // ── Dynamic hard floor — pure 50/50 until enough orders for signal ──
  // Floor = 3 days of orders, clamped [5, 25]. Scales with store velocity:
  //   1 order/day → floor 5 (~5 days), 8/day → floor 24 (~3 days), 20+/day → floor 25 (cap)
  const hardFloorPerVariant = Math.max(5, Math.min(25, Math.round(dailyOrders * 3)));

  // ── Smooth dampening — replaces hard exploration/exploitation switch ──
  // dataMaturity goes from 0 (no data) to 1 (enough data).
  // Allocation blends between 50/50 (exploration) and Thompson (exploitation).
  // HARD FLOOR: dataMaturity stays at 0 (pure 50/50) until every arm has enough orders.
  // After the floor is crossed, smooth dampening ramps from floor to targetOrdersPerVariant.
  const dataMaturity = minOrdersPerArm < hardFloorPerVariant
    ? 0
    : Math.min(1.0, (minOrdersPerArm - hardFloorPerVariant) / Math.max(1, targetOrdersPerVariant - hardFloorPerVariant));

  // Blend: allocation = dataMaturity × thompsonSplit + (1 - dataMaturity) × 0.5
  const equalShare = 1 / variants.length;
  for (const id of Object.keys(trafficSplit)) {
    trafficSplit[id] = dataMaturity * trafficSplit[id] + (1 - dataMaturity) * equalShare;
  }

  // Safety floor: no variant ever gets less than 10% during dampened phase,
  // or 5% after full maturity for high-traffic stores
  const safetyFloor = dataMaturity >= 1.0
    ? (dailyTraffic >= 500 ? 0.05 : 0.10)
    : 0.10;
  for (const id of Object.keys(trafficSplit)) {
    if (trafficSplit[id] < safetyFloor) trafficSplit[id] = safetyFloor;
  }
  // Normalize after floor enforcement
  const splitTotal = Object.values(trafficSplit).reduce((a, b) => a + b, 0);
  for (const id of Object.keys(trafficSplit)) {
    trafficSplit[id] = trafficSplit[id] / splitTotal;
  }

  // ── Current detectable lift — what's the smallest real difference we can see right now? ──
  // Inverse of the sample size formula: given current n, what MDE can we detect?
  // n = zSumSq * [p1(1-p1) + p2(1-p2)] / (delta)^2  →  delta = sqrt(zSumSq * [...] / n)
  const currentN = minObsPerArm || 1;
  const p1 = Math.max(0.005, Math.min(observedRate, 0.50));
  const zSumSq = 6.175; // (1.645 + 0.84)^2
  const currentDelta = Math.sqrt(zSumSq * 2 * p1 * (1 - p1) / currentN);
  const currentDetectableLift = p1 > 0 ? (currentDelta / p1) * 100 : 999;

  // Legacy field — keep for backward compat with dashboard
  const explorationMin = Math.max(20, Math.round(sampleTarget.nPerVariant * 0.15));

  // Lift calculation
  const bestMean = means[bestId];
  const secondMean = means[secondId];
  const liftPercent = secondMean > 0
    ? ((bestMean - secondMean) / secondMean) * 100
    : 0;

  // Dynamic expected loss threshold — scaled by conversion rate (VWO approach)
  // Higher conversion stores can tolerate larger absolute loss
  const baselineLossScale = Math.max(0.5, Math.min(observedRate / 0.05, 2.0));
  const baseLossThreshold = dailyTraffic >= 500 ? 0.05 : dailyTraffic >= 50 ? 0.10 : 0.15;
  const dynamicLossThreshold = baseLossThreshold * baselineLossScale;

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
    winnerCandidateId: bestId,
    dynamicLossThreshold,
    liftPercent,
    orderRates,
    checkoutRates: Object.keys(checkoutRates).length > 0 ? checkoutRates : undefined,
    explorationMinPerVariant: explorationMin,
    minOrdersPerVariant: targetOrdersPerVariant,
    // ── Smooth dampening fields ──
    dataMaturity,
    targetOrdersPerVariant,
    currentDetectableLift: Math.min(currentDetectableLift, 999),
    hardFloorPerVariant,
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

/**
 * Calculate statistically-correct sample target per variant.
 *
 * Uses: n = (Z_α + Z_β)² × [p₁(1-p₁) + p₂(1-p₂)] / (p₂ - p₁)²
 * With: 50% relative MDE, 80% power, 5% significance (one-sided)
 */
export function calculateSampleTarget(
  baselineRate: number,
  numVariants: number = 2,
): SampleTargetResult {
  const p1 = Math.max(0.005, Math.min(baselineRate, 0.50));

  // Adaptive MDE: low-traffic stores use larger MDE (detect bigger effects faster)
  // High conversion stores can detect smaller effects.
  // - 3% base rate → 75% relative MDE (detect 3% → 5.25%) — practical for small stores
  // - 10% base rate → 50% relative MDE (detect 10% → 15%) — tighter for high-traffic
  const relativeMDE = p1 < 0.05 ? 0.75 : p1 < 0.10 ? 0.60 : 0.50;
  const p2 = p1 * (1 + relativeMDE);

  // Z-scores: α=0.05 one-sided → 1.645, β=0.20 → 0.84
  const zSum = 1.645 + 0.84; // = 2.485
  const zSumSq = zSum * zSum; // ≈ 6.175

  const numerator = zSumSq * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = (p2 - p1) * (p2 - p1);

  let nPerVariant = Math.ceil(numerator / denominator);

  // Clamp: minimum 200 (not 500 — small stores shouldn't wait forever),
  // maximum 8000 (even high-traffic stores wrap up in reasonable time)
  nPerVariant = Math.max(200, Math.min(nPerVariant, 8000));

  return {
    nPerVariant,
    totalNeeded: nPerVariant * numVariants,
    baselineRate: p1,
  };
}

/**
 * Calculate day-over-day consistency score.
 *
 * Tracks which variant leads each day. If results flip frequently,
 * the consistency score drops and we extend the test.
 */
export function calculateConsistency(
  dailyLeaders: DailyLeader[],
): ConsistencyResult {
  if (dailyLeaders.length < 2) {
    return { score: 1, multiplier: 1.0, message: null };
  }

  // Find the overall leading variant (most days in the lead)
  const leaderCounts: Record<string, number> = {};
  for (const d of dailyLeaders) {
    leaderCounts[d.leaderId] = (leaderCounts[d.leaderId] || 0) + 1;
  }
  const overallLeader = Object.entries(leaderCounts)
    .sort((a, b) => b[1] - a[1])[0][0];

  // Consistency = fraction of days the overall leader actually led
  const daysLeading = leaderCounts[overallLeader];
  const score = daysLeading / dailyLeaders.length;

  let multiplier: number;
  let message: string | null;

  if (score > 0.80) {
    multiplier = 1.0;
    message = null; // stable
  } else if (score >= 0.60) {
    multiplier = 1.5;
    message = `Results vary between days — extending for reliability (${daysLeading}/${dailyLeaders.length} days favor the leader)`;
  } else {
    multiplier = 2.0;
    message = `Daily results keep flipping — need more data to be confident (${daysLeading}/${dailyLeaders.length} days favor the leader)`;
  }

  return { score, multiplier, message };
}
