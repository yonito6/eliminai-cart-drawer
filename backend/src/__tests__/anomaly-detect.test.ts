import { describe, it, expect } from 'vitest';
import { detectTrafficAnomaly, detectConversionShift, detectSegmentDrift } from '../lib/anomaly-detect';

describe('detectTrafficAnomaly', () => {
  it('flags when today is 3x the average', () => {
    const result = detectTrafficAnomaly(300, 100);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('traffic_anomaly');
    expect(result!.detail).toContain('+200%');
  });

  it('flags when today is less than half the average', () => {
    const result = detectTrafficAnomaly(40, 100);
    expect(result).not.toBeNull();
    expect(result!.detail).toContain('-60%');
  });

  it('returns null for normal traffic', () => {
    const result = detectTrafficAnomaly(110, 100);
    expect(result).toBeNull();
  });

  it('returns null when average is 0', () => {
    const result = detectTrafficAnomaly(50, 0);
    expect(result).toBeNull();
  });
});

describe('detectConversionShift', () => {
  it('flags when both variants shift up >30%', () => {
    const result = detectConversionShift([
      { id: 'a', todayRate: 0.28, avgRate: 0.20 },
      { id: 'b', todayRate: 0.29, avgRate: 0.20 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.detail).toContain('Both variants');
  });

  it('returns null when only one variant shifts', () => {
    const result = detectConversionShift([
      { id: 'a', todayRate: 0.30, avgRate: 0.20 },
      { id: 'b', todayRate: 0.21, avgRate: 0.20 },
    ]);
    expect(result).toBeNull();
  });
});

describe('detectSegmentDrift', () => {
  it('flags when new visitor ratio shifts >20pp', () => {
    const result = detectSegmentDrift(0.75, 0.50);
    expect(result).not.toBeNull();
    expect(result!.detail).toContain('Visitor mix');
  });

  it('returns null for stable segments', () => {
    const result = detectSegmentDrift(0.52, 0.50);
    expect(result).toBeNull();
  });
});
