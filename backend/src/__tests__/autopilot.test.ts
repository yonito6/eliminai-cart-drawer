import { describe, it, expect } from 'vitest';
import { buildOptimizeQueue, pickNextTest, applyWinner } from '../lib/autopilot';

const ADDON_DEFS = [
  { key: 'trustBadges', category: 'trust', testable: true, dimensions: [
    { key: 'position', testable: true, options: ['below-price', 'above-button'] },
    { key: 'style', testable: true, options: ['minimal', 'detailed'] },
  ]},
  { key: 'scarcityTimer', category: 'scarcity', testable: true, dimensions: [
    { key: 'urgency', testable: true, options: ['low', 'high'] },
  ]},
  { key: 'upsellRecommendations', category: 'upsell', testable: true, dimensions: [] },
  { key: 'socialProof', category: 'social', testable: true, dimensions: [] },
];

describe('buildOptimizeQueue', () => {
  it('puts WITH/WITHOUT tests first, ordered by category priority', () => {
    const queue = buildOptimizeQueue(ADDON_DEFS, [], {});
    // trust first, then scarcity, then upsell, then social
    expect(queue[0]).toBe('trustBadges:enabled');
    expect(queue[1]).toBe('scarcityTimer:enabled');
  });

  it('skips already-tested addons', () => {
    const testedSlots = ['trustBadges', 'scarcityTimer'];
    const queue = buildOptimizeQueue(ADDON_DEFS, testedSlots, {});
    expect(queue.find(q => q.startsWith('trustBadges:enabled'))).toBeUndefined();
    expect(queue.find(q => q.startsWith('scarcityTimer:enabled'))).toBeUndefined();
  });

  it('adds dimension tests after WITH/WITHOUT for winning addons', () => {
    const testedSlots = ['trustBadges'];
    const winners = { trustBadges: { enabled: true } };
    const queue = buildOptimizeQueue(ADDON_DEFS, testedSlots, winners);
    // trustBadges dimension tests should appear
    expect(queue).toContain('trustBadges:position');
    expect(queue).toContain('trustBadges:style');
  });

  it('returns empty queue when everything tested', () => {
    const testedSlots = ['trustBadges', 'scarcityTimer', 'upsellRecommendations', 'socialProof'];
    const queue = buildOptimizeQueue(ADDON_DEFS, testedSlots, {});
    // Only WITH/WITHOUT tested, no dimension tests queued since no winners
    expect(queue).toEqual([]);
  });
});

describe('pickNextTest', () => {
  it('returns first item from queue', () => {
    const queue = ['trustBadges:enabled', 'scarcityTimer:enabled'];
    const next = pickNextTest(queue);
    expect(next).toBe('trustBadges:enabled');
  });

  it('returns null for empty queue', () => {
    expect(pickNextTest([])).toBeNull();
  });
});

describe('applyWinner', () => {
  it('saves winner features and previousConfig', () => {
    const currentConfig = { trustBadges: { enabled: true, config: { position: 'below-price' } } };
    const winnerFeatures = { position: 'above-button' };
    const result = applyWinner(currentConfig, 'trustBadges', winnerFeatures);

    expect(result.addons.trustBadges.config.position).toBe('above-button');
    expect(result.addons.trustBadges.previousConfig).toBeDefined();
    expect(result.addons.trustBadges.previousConfig.config.position).toBe('below-price');
  });

  it('creates addon entry if not present', () => {
    const result = applyWinner({}, 'trustBadges', { position: 'above-button' });
    expect(result.addons.trustBadges.config.position).toBe('above-button');
  });

  // BLAST RADIUS MAP — _enabled winner must flip the top-level `enabled` flag.
  // Target: applyWinner (lib/autopilot.ts).
  // Callers: autopilot-engine.ts:76 (B1 nightly cron) + apply-winner/route.ts:40 (manual UI).
  //   Both go through this one shared fn — no duplicate to miss.
  // State consumer: v14 storefront renders an applied addon only when the
  //   TOP-LEVEL addons[slot].enabled === true (v14 lines 4020/4043/4045/4073).
  //   It never reads config._enabled for applied state, so _enabled belongs on
  //   the top-level flag, not in config.
  // Reference impl (unchanged): page.tsx:733 applyVariantConfig already does
  //   patchAddon({ enabled }) for the stop-test resolve path.
  it('ON winner (_enabled:true) flips top-level enabled, not config', () => {
    const cur = { trustBadges: { enabled: false, config: { position: 'below-price' } } };
    const result = applyWinner(cur, 'trustBadges', { _enabled: true });
    expect(result.addons.trustBadges.enabled).toBe(true);
    expect(result.addons.trustBadges.config._enabled).toBeUndefined();
    expect(result.addons.trustBadges.config.position).toBe('below-price');
  });

  it('OFF winner (_enabled:false) turns the addon off via top-level flag', () => {
    const cur = { trustBadges: { enabled: true, config: { position: 'below-price' } } };
    const result = applyWinner(cur, 'trustBadges', { _enabled: false });
    expect(result.addons.trustBadges.enabled).toBe(false);
    expect(result.addons.trustBadges.config._enabled).toBeUndefined();
    expect(result.addons.trustBadges.config.position).toBe('below-price');
  });

  it('LOCK: setting winner (no _enabled) leaves enabled untouched', () => {
    const cur = { trustBadges: { enabled: true, config: { position: 'below-price' } } };
    const result = applyWinner(cur, 'trustBadges', { position: 'above-button' });
    expect(result.addons.trustBadges.enabled).toBe(true);
    expect(result.addons.trustBadges.config.position).toBe('above-button');
  });

  it('applies an array-valued hiddenWallets winner (express PayPal hide test)', () => {
    const cur = { expressPayments: { enabled: true, config: { position: 'below', hiddenWallets: [] } } };
    const result = applyWinner(cur, 'expressPayments', { hiddenWallets: ['paypal'] });
    expect(result.addons.expressPayments.config.hiddenWallets).toEqual(['paypal']);
    // sibling settings must be untouched
    expect(result.addons.expressPayments.config.position).toBe('below');
  });
});
