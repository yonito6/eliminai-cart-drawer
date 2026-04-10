import { describe, it, expect } from 'vitest';
import { estimateDaysRemaining, calculateRequiredSamples } from '../lib/time-estimate';

describe('calculateRequiredSamples', () => {
  it('returns correct sample size for 20% baseline rate and 5% MDE', () => {
    // Formula: 16 * p*(1-p) / MDE^2 = 16 * 0.2 * 0.8 / 0.0025 = 1024
    const result = calculateRequiredSamples(0.2, 0.05);
    expect(result).toBe(1024);
  });

  it('returns higher samples for lower baseline rates', () => {
    const low = calculateRequiredSamples(0.05, 0.05);
    const high = calculateRequiredSamples(0.3, 0.05);
    expect(low).toBeLessThan(high);
  });

  it('returns higher samples for smaller MDE', () => {
    const small = calculateRequiredSamples(0.2, 0.02);
    const big = calculateRequiredSamples(0.2, 0.10);
    expect(small).toBeGreaterThan(big);
  });

  it('handles edge case of 0 baseline', () => {
    const result = calculateRequiredSamples(0, 0.05);
    expect(result).toBe(0);
  });
});

describe('estimateDaysRemaining', () => {
  it('returns days based on required samples and daily rate', () => {
    const result = estimateDaysRemaining({
      currentSamples: 100,
      requiredSamples: 1000,
      dailyRate: 50,
    });
    // (1000 - 100) / 50 = 18, but capped at maxDays (14)
    expect(result).toBe(14);
  });

  it('returns 0 when enough samples already collected', () => {
    const result = estimateDaysRemaining({
      currentSamples: 1200,
      requiredSamples: 1000,
      dailyRate: 50,
    });
    expect(result).toBe(0);
  });

  it('returns null when daily rate is 0', () => {
    const result = estimateDaysRemaining({
      currentSamples: 100,
      requiredSamples: 1000,
      dailyRate: 0,
    });
    expect(result).toBeNull();
  });

  it('caps at custom maxDays', () => {
    const result = estimateDaysRemaining({
      currentSamples: 0,
      requiredSamples: 10000,
      dailyRate: 10,
      maxDays: 30,
    });
    expect(result).toBe(30);
  });

  it('returns exact days when under cap', () => {
    const result = estimateDaysRemaining({
      currentSamples: 500,
      requiredSamples: 1000,
      dailyRate: 100,
    });
    expect(result).toBe(5);
  });
});
