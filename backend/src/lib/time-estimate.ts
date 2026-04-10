/**
 * Power analysis for A/B test time estimation.
 * Uses simplified formula: requiredSamples = 16 * p*(1-p) / MDE^2
 * where p = baseline conversion rate, MDE = minimum detectable effect.
 */

export function calculateRequiredSamples(
  baselineRate: number,
  mde: number,
): number {
  if (baselineRate <= 0 || mde <= 0) return 0;
  return Math.ceil(16 * baselineRate * (1 - baselineRate) / (mde * mde));
}

interface EstimateInput {
  currentSamples: number;
  requiredSamples: number;
  dailyRate: number;
  maxDays?: number;
}

export function estimateDaysRemaining(input: EstimateInput): number | null {
  const { currentSamples, requiredSamples, dailyRate, maxDays = 14 } = input;

  if (currentSamples >= requiredSamples) return 0;
  if (dailyRate <= 0) return null;

  const remaining = requiredSamples - currentSamples;
  const days = Math.ceil(remaining / dailyRate);
  return Math.min(days, maxDays);
}
