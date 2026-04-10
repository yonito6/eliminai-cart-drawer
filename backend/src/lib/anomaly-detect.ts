/**
 * Anomaly detection for A/B test external factor awareness.
 * Three checks: traffic spikes, conversion shifts, segment drift.
 * All informational — never auto-pause or invalidate tests.
 */

interface AnomalyNote {
  timestamp: string;
  type: 'traffic_anomaly' | 'conversion_shift' | 'segment_drift';
  detail: string;
}

export function detectTrafficAnomaly(
  todayCartOpens: number,
  avgDailyCartOpens: number,
): AnomalyNote | null {
  if (avgDailyCartOpens <= 0) return null;

  const ratio = todayCartOpens / avgDailyCartOpens;
  if (ratio > 2 || ratio < 0.5) {
    const pctChange = Math.round((ratio - 1) * 100);
    const sign = pctChange > 0 ? '+' : '';
    return {
      timestamp: new Date().toISOString(),
      type: 'traffic_anomaly',
      detail: `Traffic anomaly: ${sign}${pctChange}% vs 7-day average (${todayCartOpens} vs ${Math.round(avgDailyCartOpens)} avg)`,
    };
  }
  return null;
}

interface VariantRateInfo {
  id: string;
  todayRate: number;
  avgRate: number;
}

export function detectConversionShift(
  variants: VariantRateInfo[],
): AnomalyNote | null {
  if (variants.length < 2) return null;

  const shifts = variants.map(v => {
    if (v.avgRate <= 0) return 0;
    return (v.todayRate - v.avgRate) / v.avgRate;
  });

  const allUp = shifts.every(s => s > 0.3);
  const allDown = shifts.every(s => s < -0.3);

  if (allUp || allDown) {
    const avgShift = Math.round((shifts.reduce((a, b) => a + b, 0) / shifts.length) * 100);
    const sign = avgShift > 0 ? '+' : '';
    return {
      timestamp: new Date().toISOString(),
      type: 'conversion_shift',
      detail: `Both variants saw ${sign}${avgShift}% conversion shift. External factor likely. Results still valid.`,
    };
  }
  return null;
}

export function detectSegmentDrift(
  todayNewRatio: number,
  avgNewRatio: number,
): AnomalyNote | null {
  const drift = Math.abs(todayNewRatio - avgNewRatio);
  if (drift > 0.20) {
    return {
      timestamp: new Date().toISOString(),
      type: 'segment_drift',
      detail: `Visitor mix changed: ${Math.round(todayNewRatio * 100)}% new visitors today vs ${Math.round(avgNewRatio * 100)}% average.`,
    };
  }
  return null;
}
