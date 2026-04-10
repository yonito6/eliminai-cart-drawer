import { describe, it, expect } from 'vitest';
import { classifyChangeRisk, addExperimentNote } from '../lib/test-safety';

describe('classifyChangeRisk', () => {
  const runningExperiments = [
    { id: '1', slot: 'trustBadges', status: 'RUNNING' },
  ];

  it('returns high when changing the same slot as a running test', () => {
    expect(classifyChangeRisk('trustBadges', runningExperiments as any)).toBe('high');
  });

  it('returns medium for cart-related slots with running test', () => {
    expect(classifyChangeRisk('scarcityTimer', runningExperiments as any)).toBe('medium');
    expect(classifyChangeRisk('checkout', runningExperiments as any)).toBe('medium');
    expect(classifyChangeRisk('layout', runningExperiments as any)).toBe('medium');
    expect(classifyChangeRisk('colors', runningExperiments as any)).toBe('medium');
  });

  it('returns low for unrelated settings', () => {
    expect(classifyChangeRisk('storeBranding', runningExperiments as any)).toBe('low');
    expect(classifyChangeRisk('logo', runningExperiments as any)).toBe('low');
  });

  it('returns low when no experiments running', () => {
    expect(classifyChangeRisk('trustBadges', [])).toBe('low');
  });
});

describe('addExperimentNote', () => {
  it('adds a note with timestamp', () => {
    const notes = addExperimentNote([], 'paused', 'Settings changed by user');
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('paused');
    expect(notes[0].detail).toBe('Settings changed by user');
    expect(notes[0].timestamp).toBeDefined();
  });

  it('appends to existing notes', () => {
    const existing = [{ timestamp: '2026-01-01', type: 'started' as const, detail: 'Test started' }];
    const notes = addExperimentNote(existing, 'settings_changed', 'Scarcity timer toggled');
    expect(notes).toHaveLength(2);
  });

  it('handles null existing notes', () => {
    const notes = addExperimentNote(null, 'paused', 'Paused by user');
    expect(notes).toHaveLength(1);
  });
});
