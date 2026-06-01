/**
 * BLAST RADIUS MAP — Discount Code addon: above-checkout position + prettier UI
 *
 * USER REPORT (2026-05-31):
 *   "for the discount code, it has to be above the checkout, and make the
 *    design of it prettier, it looks bad ( the addon ), and make sure it
 *    works."
 *
 * TARGET (changes):
 *   1) applyDiscountCode  in backend/src/app/dashboard/addons/addon-transforms.ts
 *      - Add new position option 'above-checkout' (inserted IMMEDIATELY before
 *        .ccd-checkout-btn, like termsCheckbox does)
 *      - Make 'above-checkout' the new default when no position is configured
 *      - Keep 'top' and 'bottom' working unchanged (LOCK)
 *
 *   2) CCD.injectDiscountCode  in extensions/cart-drawer/assets/v14-complete.js
 *      - Mirror the same default + new branch — the storefront contract MUST
 *        match the dashboard preview transform byte-for-byte.
 *
 *   3) v14-complete.js stylesheet (CSS injected at boot)
 *      - The existing `.ccd-discount-row { display:flex; justify-content:
 *        space-between }` rule is for the discount-TOTALS row (.ccd-totals
 *        area) and collides with the discount-CODE input row (which also
 *        uses class `ccd-discount-row` on its root element). Need ID-scoped
 *        overrides on `#ccd-discount-code-row` for prettier UI.
 *      - Add styles for `#ccd-discount-code-row .ccd-discount-row__input`,
 *        `.ccd-discount-row__apply`, `.ccd-discount-row__status`. None of
 *        these currently have any CSS at all → the root cause of "looks bad".
 *
 *   4) addon-definitions.ts (discountCode entry)
 *      - Add `{ value: 'above-checkout', label: '...' }` to the position
 *        select options.
 *      - Change `default` and `defaultConfig.position` to 'above-checkout'.
 *
 * CALLERS / DUPLICATES:
 *   - addon-preview.tsx already delegates to applyDiscountCode (focused
 *     branch added 2026-05-30). No change needed there.
 *   - preview-renderer.ts already delegates via the shared transform.
 *   - cart-editor hotspots.ts targets `#ccd-discount-code-row, .ccd-discount-row`
 *     — still valid (id is unchanged).
 *   - The LIVE storefront copy is CCD.injectDiscountCode in v14-complete.js.
 *     This is the #1 duplicate that must stay in sync — same id, same
 *     class names, same insertion point per position.
 *
 * SHARED STATE:
 *   - Pure HTML/DOM transforms. No DB writes. Existing tenant configs with
 *     position: 'bottom' continue to work via fallback.
 *
 * CROSS-PATH RISK:
 *   - Class-name COLLISION: `.ccd-discount-row` is reused by the
 *     discount-TOTALS row (lines 266-271 of v14-complete.js stylesheet
 *     force display:flex + space-between — mangles the input layout).
 *     Fix: ID-scoped overrides on `#ccd-discount-code-row` (higher
 *     specificity than `.ccd-discount-row`).
 *   - If preview transform and live storefront diverge on the insertion
 *     point, the dashboard preview lies to the user — exactly the bug we
 *     just fixed in the footer-zones round.
 */

import { describe, it, expect } from 'vitest';
import { applyDiscountCode } from '@/app/dashboard/addons/addon-transforms';

// Minimal cart HTML — matches the structure used by addon-preview.tsx and
// preview-renderer.ts (sticky-footer with trust line + checkout button).
function makeCartHtml(): string {
  return [
    '<div id="CartDrawer">',
    '  <div class="cart__items">',
    '    <div class="ccd-item"><a class="ccd-item__name">Product 1</a></div>',
    '  </div>',
    '  <div class="ccd-sticky-footer">',
    '    <div class="ccd-trust">Secure checkout</div>',
    '    <button type="button" class="ccd-checkout-btn">Checkout</button>',
    '  </div>',
    '</div>',
  ].join('\n');
}

// =====================================================================
// Phase 2 — LOCK tests (existing position behavior MUST keep working)
// =====================================================================

describe('LOCK: applyDiscountCode existing position behavior', () => {
  it('LOCK: position="top" injects row as firstChild of .ccd-sticky-footer', () => {
    const out = applyDiscountCode(makeCartHtml(), {
      position: 'top',
      placeholder: 'Discount code',
      applyLabel: 'Apply',
    });
    expect(out).toContain('id="ccd-discount-code-row"');
    expect(out).toContain('ccd-discount-row--top');
    // Row appears immediately after the footer opening tag (firstChild).
    const footerOpenIdx = out.indexOf('<div class="ccd-sticky-footer">');
    const rowIdx = out.indexOf('id="ccd-discount-code-row"');
    const trustIdx = out.indexOf('ccd-trust');
    expect(rowIdx).toBeGreaterThan(footerOpenIdx);
    expect(rowIdx).toBeLessThan(trustIdx);
  });

  it('LOCK: position="bottom" injects row immediately before .ccd-trust', () => {
    const out = applyDiscountCode(makeCartHtml(), {
      position: 'bottom',
      placeholder: 'Discount code',
      applyLabel: 'Apply',
    });
    expect(out).toContain('id="ccd-discount-code-row"');
    expect(out).toContain('ccd-discount-row--bottom');
    const rowIdx = out.indexOf('id="ccd-discount-code-row"');
    const trustIdx = out.indexOf('ccd-trust');
    const checkoutIdx = out.indexOf('ccd-checkout-btn');
    // Row sits BEFORE the trust line (which sits before the checkout btn).
    expect(rowIdx).toBeLessThan(trustIdx);
    expect(trustIdx).toBeLessThan(checkoutIdx);
  });

  it('LOCK: invocation is idempotent (re-applying does not duplicate row)', () => {
    let html = applyDiscountCode(makeCartHtml(), { position: 'bottom' });
    html = applyDiscountCode(html, { position: 'bottom' });
    const matches = html.match(/id="ccd-discount-code-row"/g) || [];
    expect(matches.length).toBe(1);
  });
});

// =====================================================================
// Phase 3 — RED tests (FAIL until Phase 4 FIX lands)
// =====================================================================

describe('RED: applyDiscountCode supports new "above-checkout" position', () => {
  it('RED: position="above-checkout" inserts row IMMEDIATELY before .ccd-checkout-btn', () => {
    const out = applyDiscountCode(makeCartHtml(), {
      position: 'above-checkout',
      placeholder: 'Discount code',
      applyLabel: 'Apply',
    });
    // Positive: row exists with the new modifier
    expect(out).toContain('id="ccd-discount-code-row"');
    expect(out).toContain('ccd-discount-row--above-checkout');
    // Positive: row appears AFTER the trust line and IMMEDIATELY before checkout
    const rowIdx = out.indexOf('id="ccd-discount-code-row"');
    const trustIdx = out.indexOf('ccd-trust');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(trustIdx).toBeLessThan(rowIdx);
    expect(rowIdx).toBeLessThan(checkoutIdx);
    // Negative: must NOT use the "bottom" modifier when position is above-checkout
    expect(out).not.toContain('ccd-discount-row--bottom');
  });

  it('RED: default position (no position specified) is "above-checkout"', () => {
    const out = applyDiscountCode(makeCartHtml(), {});
    // Positive: defaults to above-checkout placement (per 2026-05-31 user intent)
    expect(out).toContain('ccd-discount-row--above-checkout');
    const rowIdx = out.indexOf('id="ccd-discount-code-row"');
    const trustIdx = out.indexOf('ccd-trust');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    // Above-checkout: row sits after trust → directly before the checkout button
    expect(trustIdx).toBeLessThan(rowIdx);
    expect(rowIdx).toBeLessThan(checkoutIdx);
    // Negative: must NOT default to top or bottom
    expect(out).not.toContain('ccd-discount-row--top');
    expect(out).not.toContain('ccd-discount-row--bottom');
  });

  it('RED: above-checkout works even when .ccd-trust is absent', () => {
    const html = makeCartHtml().replace(
      '    <div class="ccd-trust">Secure checkout</div>\n',
      '',
    );
    const out = applyDiscountCode(html, { position: 'above-checkout' });
    expect(out).toContain('id="ccd-discount-code-row"');
    const rowIdx = out.indexOf('id="ccd-discount-code-row"');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(rowIdx).toBeGreaterThan(-1);
    expect(rowIdx).toBeLessThan(checkoutIdx);
  });

  it('RED: above-checkout still renders input, apply button, and status div', () => {
    const out = applyDiscountCode(makeCartHtml(), {
      position: 'above-checkout',
      placeholder: 'Promo code',
      applyLabel: 'Redeem',
    });
    // Positive: contract markup unchanged for above-checkout
    expect(out).toContain('id="ccd-discount-code-input"');
    expect(out).toContain('class="ccd-discount-row__input"');
    expect(out).toContain('id="ccd-discount-code-apply"');
    expect(out).toContain('class="ccd-discount-row__apply"');
    expect(out).toContain('id="ccd-discount-code-status"');
    expect(out).toContain('class="ccd-discount-row__status"');
    expect(out).toContain('Promo code');
    expect(out).toContain('Redeem');
  });
});

describe('RED: addon-definitions.ts exposes "above-checkout" as discountCode default', () => {
  it('RED: discountCode position select includes "above-checkout" option', async () => {
    const mod = await import('@/lib/addon-definitions');
    const defs: any[] = (mod as any).ADDON_DEFINITIONS;
    const disc = defs.find((d) => d.key === 'discountCode');
    expect(disc).toBeTruthy();
    const positionDim = disc.dimensions.find((dim: any) => dim.key === 'position');
    expect(positionDim).toBeTruthy();
    const values = positionDim.options.map((o: any) => o.value);
    // Positive: new option present
    expect(values).toContain('above-checkout');
    // Positive: legacy options still present (don't break stored configs)
    expect(values).toContain('top');
    expect(values).toContain('bottom');
    // Positive: default is "above-checkout" (per 2026-05-31 user intent)
    expect(positionDim.default).toBe('above-checkout');
    expect(disc.defaultConfig.position).toBe('above-checkout');
  });

  it('RED: discountCode definition includes applyButtonColor dimension', async () => {
    const mod = await import('@/lib/addon-definitions');
    const defs: any[] = (mod as any).ADDON_DEFINITIONS;
    const disc = defs.find((d) => d.key === 'discountCode');
    const colorDim = disc.dimensions.find((dim: any) => dim.key === 'applyButtonColor');
    expect(colorDim).toBeTruthy();
    expect(colorDim.type).toBe('color');
    // Default must be a hex color (the existing baked-in #111 button background)
    expect(colorDim.default).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(disc.defaultConfig.applyButtonColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('RED: v14-complete.js storefront has matching above-checkout branch', () => {
  it('RED: CCD.injectDiscountCode source handles position === "above-checkout"', async () => {
    const fs = await import('node:fs/promises');
    const path = 'C:/Projects/eliminai-cart-drawer/extensions/cart-drawer/assets/v14-complete.js';
    const src = await fs.readFile(path, 'utf8');
    // Locate the injectDiscountCode function body
    const startIdx = src.indexOf('CCD.injectDiscountCode = function');
    expect(startIdx).toBeGreaterThan(-1);
    // Grab the next ~4000 chars (function body is well under that)
    const body = src.slice(startIdx, startIdx + 4000);
    // Positive: above-checkout branch present
    expect(body).toContain("'above-checkout'");
    expect(body).toMatch(/ccd-checkout-btn/);
    // Positive: default is now above-checkout (when cfg.position is missing)
    // We look for the default-resolution line.
    expect(body).toMatch(/position\s*===?\s*['"]above-checkout['"]/);
  });

  it('RED: v14-complete.js stylesheet has scoped CSS for #ccd-discount-code-row', async () => {
    const fs = await import('node:fs/promises');
    const path = 'C:/Projects/eliminai-cart-drawer/extensions/cart-drawer/assets/v14-complete.js';
    const src = await fs.readFile(path, 'utf8');
    // Positive: ID-scoped selectors exist (overrides the colliding .ccd-discount-row totals styles)
    expect(src).toContain('#ccd-discount-code-row');
    expect(src).toMatch(/#ccd-discount-code-row\s+\.ccd-discount-row__input/);
    expect(src).toMatch(/#ccd-discount-code-row\s+\.ccd-discount-row__apply/);
  });
});

// =====================================================================
// Phase 3 — Cross-path equivalence: preview transform == live storefront
// =====================================================================

describe('RED: preview transform and live storefront produce equivalent insertion', () => {
  it('RED: above-checkout default in transform matches default in v14-complete.js', async () => {
    const fs = await import('node:fs/promises');
    const path = 'C:/Projects/eliminai-cart-drawer/extensions/cart-drawer/assets/v14-complete.js';
    const src = await fs.readFile(path, 'utf8');
    const startIdx = src.indexOf('CCD.injectDiscountCode = function');
    const body = src.slice(startIdx, startIdx + 4000);
    // The transform defaults to 'above-checkout' when cfg.position is missing (2026-05-31).
    // The storefront MUST do the same — there must be a fallback to 'above-checkout'.
    expect(body).toMatch(/position\s*=[\s\S]*?cfg\.position[\s\S]*?['"]above-checkout['"]\s*\)?\s*;/);
  });

  it('RED: applyButtonColor CSS variable appears in transform output', () => {
    const out = applyDiscountCode(makeCartHtml(), { applyButtonColor: '#7c3aed' });
    // Positive: row carries an inline CSS variable for the apply button color
    expect(out).toMatch(/--ccd-da-bg:\s*#7c3aed/);
    expect(out).toContain('id="ccd-discount-code-row"');
  });

  it('RED: missing applyButtonColor produces no broken inline override', () => {
    const out = applyDiscountCode(makeCartHtml(), {});
    expect(out).not.toMatch(/--ccd-da-bg:\s*;/);
    expect(out).not.toMatch(/--ccd-da-bg:\s*undefined/);
  });

  it('RED: v14-complete.js storefront uses var(--ccd-da-bg) for apply button background', async () => {
    const fs = await import('node:fs/promises');
    const path = 'C:/Projects/eliminai-cart-drawer/extensions/cart-drawer/assets/v14-complete.js';
    const src = await fs.readFile(path, 'utf8');
    // Stylesheet rule for the apply button must reference the CSS variable
    expect(src).toMatch(/#ccd-discount-code-row \.ccd-discount-row__apply[^}]*var\(--ccd-da-bg/);
    // Storefront JS must set --ccd-da-bg from cfg.applyButtonColor
    expect(src).toMatch(/setProperty\(['"]--ccd-da-bg['"]/);
  });

  it('RED: REAL_CART_CSS mirrors var(--ccd-da-bg) usage', async () => {
    const mod = await import('@/app/dashboard/cart-constants');
    expect(mod.REAL_CART_CSS).toMatch(/#ccd-discount-code-row \.ccd-discount-row__apply[^}]*var\(--ccd-da-bg/);
  });
});
