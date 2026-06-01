/**
 * BLAST RADIUS MAP — Discount-code "still below + ugly" bug
 *
 * USER REPORT: After dashboard reload, discount-code addon still rendered
 *   BELOW the checkout button and the design was the old broken layout.
 *
 * ROOT CAUSES:
 *   1. discount-code-addon-editor.tsx hardcodes 2 position options
 *      (`top`|`bottom`) — user can't even SELECT 'above-checkout' from
 *      the dropdown, and editor's `useState ?? 'bottom'` fallback forces
 *      'bottom' when config has no position.
 *   2. REAL_CART_CSS in cart-constants.ts has NO #ccd-discount-code-row
 *      styling. Dashboard preview srcdoc (addon-preview.tsx line 925)
 *      injects REAL_CART_CSS — so the prettified design that lives in
 *      v14-complete.js stylesheet never shows in the dashboard preview.
 *
 * TARGETS:
 *   - src/app/dashboard/addons/discount-code-addon-editor.tsx
 *       (lines 5-10 type, 48 useState default, 88 discard default,
 *        127 select cast, 132-135 <option> list)
 *   - src/app/dashboard/cart-constants.ts → REAL_CART_CSS string
 *     (must include the same #ccd-discount-code-row block that lives in
 *      extensions/cart-drawer/assets/v14-complete.js)
 *
 * CALLERS (downstream of changes):
 *   - dashboard/addons/page.tsx:2016 renders the editor
 *   - addon-preview.tsx:925 builds srcdoc with REAL_CART_CSS
 *   - addon-preview.tsx:256, 859 call applyDiscountCode
 *   - extensions/cart-drawer/assets/v14-complete.js CCD.injectDiscountCode
 *     (mirror — already in sync, locked by addon-transforms-discount-code)
 *
 * DUPLICATED LOGIC:
 *   - Position values exist in 3 places that MUST agree:
 *       a) ADDON_DEFINITIONS.discountCode.dimensions[position].options
 *       b) discount-code-addon-editor.tsx <option> list + useState default
 *       c) applyDiscountCode position branch
 *   - CSS exists in 2 places that MUST agree:
 *       a) v14-complete.js inline stylesheet block (#ccd-discount-code-row)
 *       b) cart-constants.ts REAL_CART_CSS
 *
 * SHARED STATE:
 *   - Store.config.addons.discountCode.position (JSON column)
 *   - Existing stores may still hold 'bottom' — that overrides new default.
 *     This test does NOT migrate existing stores; it only ensures the
 *     editor lets users pick 'above-checkout' and the preview renders it
 *     prettily.
 *
 * CROSS-PATH RISK:
 *   - If editor never adds 'above-checkout' option, user can't change it
 *     even after we change the definition default.
 *   - If REAL_CART_CSS drifts from v14-complete.js, dashboard preview
 *     looks different from live storefront cart — the whole purpose of
 *     `feedback_dashboard_config_matches_cart` is violated.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyDiscountCode } from '@/app/dashboard/addons/addon-transforms';
import { REAL_CART_CSS } from '@/app/dashboard/cart-constants';

const EDITOR_PATH = resolve(
  __dirname,
  '../../src/app/dashboard/addons/discount-code-addon-editor.tsx',
);

const editorSrc = readFileSync(EDITOR_PATH, 'utf8');

// ── LOCK tests: prevent regression in already-fixed transform ───────────
describe('LOCK: applyDiscountCode (transform) still emits above-checkout', () => {
  function makeCartHtml() {
    return [
      '<div class="ccd-sticky-footer">',
      '<div class="ccd-trust">trust</div>',
      '<button type="button" class="ccd-checkout-btn">Checkout</button>',
      '</div>\n</div>',
    ].join('');
  }

  it('default (no position) emits above-checkout placement before the checkout button (2026-05-31 intent)', () => {
    const out = applyDiscountCode(makeCartHtml(), {});
    expect(out).toContain('ccd-discount-row--above-checkout');
    const rowIdx = out.indexOf('id="ccd-discount-code-row"');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(rowIdx).toBeGreaterThan(-1);
    expect(rowIdx).toBeLessThan(checkoutIdx);
    expect(out).not.toContain('ccd-discount-row--top');
    expect(out).not.toContain('ccd-discount-row--bottom');
  });

  it('explicit position="bottom" still works (no auto-migration of user choice)', () => {
    const out = applyDiscountCode(makeCartHtml(), { position: 'bottom' });
    expect(out).toContain('ccd-discount-row--bottom');
    expect(out).not.toContain('ccd-discount-row--above-checkout');
  });
});

// ── RED test #1: editor must offer above-checkout option ────────────────
describe('RED: discount-code-addon-editor.tsx exposes above-checkout', () => {
  it('TypeScript position type union includes above-checkout', () => {
    // Either the type union or a generic string — what we MUST NOT have is
    // the hard `'top' | 'bottom'` pair that excludes above-checkout.
    expect(editorSrc).toContain("'above-checkout'");
    // Negative assertion: no hardcoded 2-value union that excludes the new value
    expect(editorSrc).not.toMatch(/position\?:\s*'top'\s*\|\s*'bottom'\s*;/);
    expect(editorSrc).not.toMatch(/useState<'top'\s*\|\s*'bottom'>/);
  });

  it('select <option> list includes above-checkout', () => {
    expect(editorSrc).toMatch(/<option value="above-checkout">/);
    // Also keep top + bottom so existing users can switch back
    expect(editorSrc).toMatch(/<option value="top">/);
    expect(editorSrc).toMatch(/<option value="bottom">/);
  });

  it('default fallback for missing config.position is above-checkout (per 2026-05-31 user request)', () => {
    const useStateMatch = editorSrc.match(
      /useState[^(]*\(\s*config\.position\s*\?\?\s*'([^']+)'\s*\)/,
    );
    expect(useStateMatch, 'useState fallback not found').toBeTruthy();
    expect(useStateMatch![1]).toBe('above-checkout');

    const discardMatch = editorSrc.match(
      /setPosition\(\s*saved\.position\s*\?\?\s*'([^']+)'\s*\)/,
    );
    expect(discardMatch, 'discard fallback not found').toBeTruthy();
    expect(discardMatch![1]).toBe('above-checkout');
  });

  it('editor exposes a color picker for applyButtonColor', () => {
    expect(editorSrc).toMatch(/applyButtonColor/);
    expect(editorSrc).toMatch(/type="color"/);
  });
});

// ── RED test #2: REAL_CART_CSS must include prettified design ───────────
describe('RED: REAL_CART_CSS contains #ccd-discount-code-row styling', () => {
  it('includes the ID-scoped flex wrapper for the input row', () => {
    expect(REAL_CART_CSS).toMatch(/#ccd-discount-code-row\s*\{/);
  });

  it('styles the input with rounded-left + grey border', () => {
    // Must scope by ID so the .ccd-discount-row totals styles do not collide
    expect(REAL_CART_CSS).toMatch(
      /#ccd-discount-code-row\s+\.ccd-discount-row__input\s*\{/,
    );
  });

  it('styles the apply button with rounded-right + dark fill', () => {
    expect(REAL_CART_CSS).toMatch(
      /#ccd-discount-code-row\s+\.ccd-discount-row__apply\s*\{/,
    );
  });

  it('styles the status text and applied state', () => {
    expect(REAL_CART_CSS).toMatch(
      /#ccd-discount-code-row\s+\.ccd-discount-row__status\s*\{/,
    );
    expect(REAL_CART_CSS).toMatch(
      /#ccd-discount-code-row\s+\.ccd-discount-row__status--applied/,
    );
  });
});

// ── RED test #3: dashboard preview / storefront CSS parity ──────────────
describe('RED: REAL_CART_CSS mirrors v14-complete.js discount-code block', () => {
  const V14_PATH = resolve(
    __dirname,
    '../../../extensions/cart-drawer/assets/v14-complete.js',
  );
  const v14Src = readFileSync(V14_PATH, 'utf8');

  it('both files contain the same #ccd-discount-code-row selectors', () => {
    const selectors = [
      '#ccd-discount-code-row {',
      '#ccd-discount-code-row .ccd-discount-row__input {',
      '#ccd-discount-code-row .ccd-discount-row__apply {',
      '#ccd-discount-code-row .ccd-discount-row__status {',
      '#ccd-discount-code-row .ccd-discount-row__status--applied',
    ];
    for (const sel of selectors) {
      expect(v14Src, `v14-complete.js missing "${sel}"`).toContain(sel);
      expect(REAL_CART_CSS, `REAL_CART_CSS missing "${sel}"`).toContain(sel);
    }
  });
});
