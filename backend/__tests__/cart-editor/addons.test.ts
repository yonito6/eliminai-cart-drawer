/**
 * BLAST RADIUS MAP — Chunk 2: 4 new addon definitions + sanitizeLabelHtml
 * Target: backend/src/lib/addon-definitions.ts (additive)
 *
 * CALLERS of ADDON_DEFINITIONS / getAddonDefinition / getDefaultAddonsConfig:
 *   - backend/src/app/api/stores/[id]/addons/route.ts (GET + PATCH)
 *   - backend/src/app/api/stores/[id]/addons/test/route.ts
 *   - backend/src/app/api/stores/[id]/addons/apply-recommended/route.ts
 *   - backend/src/app/api/stores/[id]/autopilot/route.ts
 *
 * SHARED STATE:
 *   - Store.config.addons / Store.demoConfig.addons (JSON column) — new entries appear with
 *     enabled:false defaults on first PATCH call for a key (route.ts line ~145)
 *
 * CROSS-PATH RISK: LOW (purely additive). Existing 6 addons must be untouched.
 *
 * LOCK TESTS:
 *   - LOCK-1: existing 6 addons still present (trustBadges, scarcityTimer, shippingProtection,
 *     freeShippingBar, upsellRecommendations, socialProof)
 *   - LOCK-2: getDefaultAddonsConfig builds entries for ALL addons including new ones
 *
 * NEW BEHAVIOR TESTS:
 *   - 4 new addons exist with correct shape
 *   - sanitizeLabelHtml: rejects <script>, javascript: href, <img onerror>; keeps <a>
 */

import { describe, it, expect } from 'vitest';
import {
  ADDON_DEFINITIONS,
  getAddonDefinition,
  getDefaultAddonsConfig,
  sanitizeLabelHtml,
} from '@/lib/addon-definitions';

describe('ADDON_DEFINITIONS — existing addons (lock tests)', () => {
  const EXISTING = [
    'trustBadges',
    'scarcityTimer',
    'shippingProtection',
    'freeShippingBar',
    'upsellRecommendations',
    'socialProof',
  ];

  it('LOCK-1: all 6 existing addons remain in registry', () => {
    for (const key of EXISTING) {
      expect(getAddonDefinition(key)).toBeDefined();
    }
  });

  it('LOCK-2: getDefaultAddonsConfig contains an entry for every definition (old + new)', () => {
    const { addons } = getDefaultAddonsConfig();
    for (const def of ADDON_DEFINITIONS) {
      expect(addons[def.key]).toBeDefined();
      expect(addons[def.key].enabled).toBe(false);
      expect(addons[def.key].mode).toBe('off');
      expect(addons[def.key].config).toEqual(def.defaultConfig);
    }
  });
});

describe('ADDON_DEFINITIONS — notes addon', () => {
  const def = () => getAddonDefinition('notes')!;

  it('exists', () => {
    expect(def()).toBeDefined();
  });

  it('has dimensions: label, placeholder, maxChars, position', () => {
    const keys = def().dimensions.map((d) => d.key);
    expect(keys).toEqual(['label', 'placeholder', 'maxChars', 'position']);
  });

  it('maxChars dimension has min 0 and max 1000', () => {
    const dim = def().dimensions.find((d) => d.key === 'maxChars')!;
    expect(dim.type).toBe('number');
    expect(dim.min).toBe(0);
    expect(dim.max).toBe(1000);
    expect(dim.default).toBe(250);
  });

  it('position dimension has above-checkout/top/bottom options, default above-checkout', () => {
    const dim = def().dimensions.find((d) => d.key === 'position')!;
    expect(dim.type).toBe('select');
    expect(dim.testable).toBe(true);
    expect(dim.options?.map((o) => o.value)).toEqual(['above-checkout', 'top', 'bottom']);
    expect(dim.default).toBe('above-checkout');
  });

  it('defaultConfig disabled, position above-checkout, maxChars 250', () => {
    expect(def().defaultConfig).toEqual({
      enabled: false,
      label: 'Add a note to your order',
      placeholder: '',
      maxChars: 250,
      position: 'above-checkout',
    });
  });
});

describe('ADDON_DEFINITIONS — discountCode addon', () => {
  const def = () => getAddonDefinition('discountCode')!;

  it('exists', () => {
    expect(def()).toBeDefined();
  });

  it('has dimensions: placeholder, applyButtonLabel, applyButtonColor, position, showAppliedBadge', () => {
    const keys = def().dimensions.map((d) => d.key);
    expect(keys).toEqual(['placeholder', 'applyButtonLabel', 'applyButtonColor', 'position', 'showAppliedBadge']);
  });

  it('position dimension testable, options above-checkout/top/bottom, default above-checkout', () => {
    const dim = def().dimensions.find((d) => d.key === 'position')!;
    expect(dim.type).toBe('select');
    expect(dim.testable).toBe(true);
    expect(dim.options?.map((o) => o.value)).toEqual(['above-checkout', 'top', 'bottom']);
    expect(dim.default).toBe('above-checkout');
  });

  it('applyButtonColor dimension is a color picker with hex default', () => {
    const dim = def().dimensions.find((d) => d.key === 'applyButtonColor')!;
    expect(dim.type).toBe('color');
    expect(String(dim.default)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('showAppliedBadge is a toggle, default true', () => {
    const dim = def().dimensions.find((d) => d.key === 'showAppliedBadge')!;
    expect(dim.type).toBe('toggle');
    expect(dim.default).toBe(true);
  });

  it('defaultConfig has all five fields + enabled:false', () => {
    const cfg = def().defaultConfig;
    expect(cfg.enabled).toBe(false);
    expect(cfg.placeholder).toBe('Discount code');
    expect(cfg.applyButtonLabel).toBe('Apply');
    expect(cfg.position).toBe('above-checkout');
    expect(cfg.showAppliedBadge).toBe(true);
    expect(String(cfg.applyButtonColor)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('ADDON_DEFINITIONS — termsCheckbox addon', () => {
  const def = () => getAddonDefinition('termsCheckbox')!;

  it('exists', () => {
    expect(def()).toBeDefined();
  });

  it('has dimensions: labelHtml, errorMessage, blockCheckoutIfUnchecked', () => {
    const keys = def().dimensions.map((d) => d.key);
    expect(keys).toEqual(['labelHtml', 'errorMessage', 'blockCheckoutIfUnchecked']);
  });

  it('blockCheckoutIfUnchecked is a toggle, default true', () => {
    const dim = def().dimensions.find((d) => d.key === 'blockCheckoutIfUnchecked')!;
    expect(dim.type).toBe('toggle');
    expect(dim.default).toBe(true);
  });

  it('defaultConfig disabled, blockCheckoutIfUnchecked true, labelHtml contains <a>', () => {
    const cfg = def().defaultConfig;
    expect(cfg.enabled).toBe(false);
    expect(cfg.blockCheckoutIfUnchecked).toBe(true);
    expect(cfg.labelHtml).toContain('<a');
    expect(cfg.errorMessage).toBeTruthy();
  });
});

describe('ADDON_DEFINITIONS — expressPayments addon', () => {
  const def = () => getAddonDefinition('expressPayments')!;

  it('exists', () => {
    expect(def()).toBeDefined();
  });

  it('has dimensions: providers, position, layout, separatorLabel', () => {
    const keys = def().dimensions.map((d) => d.key);
    expect(keys).toEqual(['providers', 'position', 'layout', 'separatorLabel']);
  });

  it('providers dimension is checkboxes with 6 providers', () => {
    const dim = def().dimensions.find((d) => d.key === 'providers')!;
    expect(dim.type).toBe('checkboxes');
    const optionValues = dim.checkboxOptions!.map((o) => o.value);
    expect(optionValues).toEqual([
      'shopPay',
      'googlePay',
      'paypal',
      'applePay',
      'amazonPay',
      'metaPay',
    ]);
  });

  it('providers default has shopPay/googlePay/paypal/applePay true, amazonPay/metaPay false', () => {
    const dim = def().dimensions.find((d) => d.key === 'providers')!;
    expect(dim.default).toEqual({
      shopPay: true,
      googlePay: true,
      paypal: true,
      applePay: true,
      amazonPay: false,
      metaPay: false,
    });
  });

  it('position options above/below, default above', () => {
    const dim = def().dimensions.find((d) => d.key === 'position')!;
    expect(dim.options?.map((o) => o.value)).toEqual(['above', 'below']);
    expect(dim.default).toBe('above');
  });

  it('layout options stacked/row, default stacked', () => {
    const dim = def().dimensions.find((d) => d.key === 'layout')!;
    expect(dim.options?.map((o) => o.value)).toEqual(['stacked', 'row']);
    expect(dim.default).toBe('stacked');
  });

  it('defaultConfig enabled:true (only addon that is on by default), separatorLabel "or"', () => {
    const cfg = def().defaultConfig;
    expect(cfg.enabled).toBe(true);
    expect(cfg.separatorLabel).toBe('or');
    expect(cfg.position).toBe('above');
    expect(cfg.layout).toBe('stacked');
  });
});

describe('sanitizeLabelHtml', () => {
  it('passes a plain anchor with href through unchanged', () => {
    const input = 'I agree to the <a href="/policies/terms">Terms</a>';
    const out = sanitizeLabelHtml(input);
    expect(out).toContain('<a');
    expect(out).toContain('href="/policies/terms"');
    expect(out).toContain('Terms');
  });

  it('keeps target and rel attributes on <a>', () => {
    const out = sanitizeLabelHtml(
      'Read the <a href="https://example.com" target="_blank" rel="noopener">policy</a>'
    );
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener"');
  });

  it('XSS 1: strips <script> tag entirely', () => {
    const out = sanitizeLabelHtml('Hi<script>alert(1)</script> there');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('alert(1)');
  });

  it('XSS 2: rejects javascript: href (drops the <a> or strips href)', () => {
    const out = sanitizeLabelHtml('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('XSS 2b: rejects data: href', () => {
    const out = sanitizeLabelHtml('<a href="data:text/html,<script>1</script>">click</a>');
    expect(out.toLowerCase()).not.toContain('data:');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('XSS 3: strips <img onerror=...> entirely (img not in allowlist)', () => {
    const out = sanitizeLabelHtml('hello <img src=x onerror="alert(1)"> world');
    expect(out.toLowerCase()).not.toContain('<img');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  it('strips event-handler attributes on <a>', () => {
    const out = sanitizeLabelHtml('<a href="/x" onclick="alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out).toContain('href="/x"');
  });

  it('truncates input over 500 chars', () => {
    const out = sanitizeLabelHtml('a'.repeat(2000));
    expect(out.length).toBeLessThanOrEqual(500);
  });
});
