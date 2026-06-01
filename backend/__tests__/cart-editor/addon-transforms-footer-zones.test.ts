/**
 * BLAST RADIUS MAP — Cart-editor / Addons preview: footer-zone addons
 *
 * USER REPORT (2026-05-30):
 *   "I enabled the Only X Left Badge and it doesn't show it on the preview,
 *    same when I enabled the Discount Code Field — it should always show in
 *    the preview and it has to look identical to how it will appear on the
 *    live store (eliminai-test store) in this case."
 *
 * TARGET (NEW shared transforms to add):
 *   applyDiscountCode   in backend/src/app/dashboard/addons/addon-transforms.ts
 *   applyNotes          in backend/src/app/dashboard/addons/addon-transforms.ts
 *   applyTermsCheckbox  in backend/src/app/dashboard/addons/addon-transforms.ts
 *
 * Plus a fix for applyLowStockBadge / addon-preview.tsx variant-dependent
 * regex (badge silently fails when preview product items lack a variant div).
 *
 * CALLERS that must wire to the new transforms:
 *   1) backend/src/app/dashboard/addons/addon-preview.tsx
 *        - Background ORDER loop (lines ~220-261) — currently has only the
 *          8 visual addons, missing notes / discountCode / termsCheckbox.
 *        - Per-addon focused branches — currently there is NO focused branch
 *          for notes / discountCode / termsCheckbox at all.
 *   2) backend/src/app/dashboard/cart-editor/preview-renderer.ts
 *        - Has its OWN buildAddonFooterZones (~lines 140-168) that emits
 *          WRONG class names (ccd-footer-notes-zone, ccd-footer-discount-zone,
 *          ccd-footer-terms-zone). Must be replaced by the new shared
 *          transforms so the cart-editor preview matches the live storefront.
 *
 * DUPLICATED LOGIC:
 *   - preview-renderer.ts:buildAddonFooterZones is a duplicate of what the
 *     live storefront does in v14-complete.js (CCD.injectNotes /
 *     injectDiscountCode / injectTermsCheckbox). Class names DRIFTED apart:
 *       preview-renderer.ts → ccd-footer-{notes,discount,terms}-zone
 *       v14-complete.js     → ccd-notes-row / ccd-discount-code-row + ccd-discount-row / ccd-terms-row
 *     The live storefront is the contract — the cart-editor must match it.
 *   - hotspots.ts wires addon.notes / addon.discountCode / addon.termsCheckbox
 *     to the WRONG (preview-renderer-only) selectors. Hotspots must be
 *     updated to live class names after the transforms land.
 *
 * SHARED STATE:
 *   - Pure HTML-string transforms. No DB. No runtime state.
 *
 * CROSS-PATH RISK:
 *   - Markup MUST match v14-complete.js byte-for-byte (ids: ccd-notes-row,
 *     ccd-discount-code-row, ccd-terms-row; classes: ccd-notes-row,
 *     ccd-discount-row, ccd-terms-row) — otherwise:
 *       a) /dashboard/addons preview drifts from live cart (user complaint)
 *       b) /cart-editor hotspot selectors stop matching
 *       c) downstream theme CSS targeting these classes silently breaks
 *   - Insertion point in live: notes/discountCode are appended into
 *     `.ccd-sticky-footer` (firstChild for "top" position, before `.ccd-trust`
 *     for "bottom"); terms-row is inserted before `.ccd-checkout-btn`.
 *   - applyLowStockBadge focused branch in addon-preview.tsx REQUIRES
 *     `<div class="ccd-item__variant">` to be present. The preview's
 *     buildItemHtml omits this div when products have no variant string, so
 *     enabling Low Stock Badge with a variant-less preview product silently
 *     renders nothing.
 *
 * LOCK TESTS BELOW capture the working baseline for the 8 visual addon
 * transforms (so adding the 3 new ones doesn't regress them).
 * RED TESTS BELOW assert the live class names appear once the new
 * transforms exist + are wired into preview-renderer.ts.
 */

import { describe, it, expect } from 'vitest';

// ── Existing transforms (LOCK — must still work after the fix) ────
import {
  applyTrustBadges,
  applyLowStockBadge,
} from '@/app/dashboard/addons/addon-transforms';

// ── New transforms (these imports will FAIL until Phase 4 FIX adds them) ──
//
// We import lazily inside each RED test via `await import(...)` so the
// LOCK tests can run/pass even before the FIX lands. This matches the
// pattern used by addon-transforms-low-stock-badge.test.ts.

// Minimal cart HTML mirroring CONTROL_HTML structure used by preview-renderer.
function makeCartHtml(): string {
  return [
    '<div id="CartDrawer">',
    '  <div class="drawer__header"><h2>Cart</h2></div>',
    '  <div class="cart__items">',
    '    <div class="ccd-item">',
    '      <div class="ccd-item__image"><img src="p1.jpg" alt=""></div>',
    '      <div class="ccd-item__details">',
    '        <div class="ccd-item__title-row">',
    '          <a href="#" class="ccd-item__name">Product 1</a>',
    '        </div>',
    '        <div class="ccd-item__variant">Variant 1</div>',
    '        <div class="ccd-item__bottom">',
    '          <div class="ccd-qty">',
    '            <button type="button" class="ccd-qty__btn ccd-qty__btn--minus">-</button>',
    '            <input type="text" class="ccd-qty__input" value="1">',
    '            <button type="button" class="ccd-qty__btn ccd-qty__btn--plus">+</button>',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="ccd-sticky-footer">',
    '    <div class="ccd-trust">Secure checkout</div>',
    '    <button type="button" class="ccd-checkout-btn">Checkout</button>',
    '  </div>',
    '</div>',
  ].join('\n');
}

// Same minimal cart but the item has NO ccd-item__variant div — mirrors what
// buildItemHtml in addon-preview.tsx produces when previewProducts have an
// empty/missing variant string. Used to lock in the variant-independent bug
// fix for applyLowStockBadge.
function makeCartHtmlNoVariant(): string {
  return [
    '<div id="CartDrawer">',
    '  <div class="cart__items">',
    '    <div class="ccd-item">',
    '      <div class="ccd-item__image"><img src="p1.jpg" alt=""></div>',
    '      <div class="ccd-item__details">',
    '        <div class="ccd-item__title-row">',
    '          <a href="#" class="ccd-item__name">Product 1</a>',
    '        </div>',
    '        <div class="ccd-item__bottom">',
    '          <div class="ccd-qty">',
    '            <button type="button" class="ccd-qty__btn ccd-qty__btn--minus">-</button>',
    '            <input type="text" class="ccd-qty__input" value="1">',
    '            <button type="button" class="ccd-qty__btn ccd-qty__btn--plus">+</button>',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="ccd-sticky-footer">',
    '    <div class="ccd-trust">Secure checkout</div>',
    '    <button type="button" class="ccd-checkout-btn">Checkout</button>',
    '  </div>',
    '</div>',
  ].join('\n');
}

// =====================================================================
// Phase 2 — LOCK tests (capture working baseline for existing transforms)
// =====================================================================

describe('LOCK: existing addon transforms still work after footer-zone changes', () => {
  it('LOCK: applyTrustBadges injects #ccd-trust-badges with default icons', () => {
    const html = makeCartHtml().replace('Checkout</button>', 'Checkout</button><!-- TRUST_BADGES_PLACEHOLDER -->');
    const out = applyTrustBadges(html, {});
    // Positive: badge container present
    expect(out).toContain('id="ccd-trust-badges"');
    expect(out).toContain('class="ccd-trust-badges"');
    // Negative: placeholder consumed
    expect(out).not.toContain('TRUST_BADGES_PLACEHOLDER');
  });

  // Note: applyScarcityTimer / applyShippingProtection are LOCKed by the
  // existing addons.test.ts + preview-renderer.test.ts suites — not
  // duplicated here. They target DOM structures (drawer__inner,
  // ccd-shipping-protection__icon) not present in this file's minimal cart.

  it('LOCK: applyLowStockBadge with variant div present still works (baseline)', () => {
    const out = applyLowStockBadge(makeCartHtml(), {
      mode: 'fake',
      target: '1',
      fakeQty: 3,
      text: 'Only {n} left!',
      icon: 'fire',
    });
    expect(out).toContain('ccd-scarcity-badge');
    expect(out).toContain('Only 3 left!');
  });
});

// =====================================================================
// Phase 3 — RED tests (FAIL until Phase 4 FIX lands)
// =====================================================================

describe('RED: applyNotes shared transform exists and matches live markup', () => {
  it('RED: applyNotes injects #ccd-notes-row with ccd-notes-row__input textarea', async () => {
    const mod = await import('@/app/dashboard/addons/addon-transforms');
    expect(typeof (mod as any).applyNotes).toBe('function');
    const out = (mod as any).applyNotes(makeCartHtml(), {
      position: 'bottom',
      placeholder: 'Add a note for your order',
      maxChars: 250,
      labelText: 'Order notes',
    });
    // Positive: live storefront id + class + input class
    expect(out).toContain('id="ccd-notes-row"');
    expect(out).toContain('ccd-notes-row--bottom');
    expect(out).toContain('class="ccd-notes-row__input"');
    expect(out).toContain('Add a note for your order');
    // Negative: must NOT use the legacy cart-editor-only class name
    expect(out).not.toContain('ccd-footer-notes-zone');
  });
});

describe('RED: applyDiscountCode shared transform exists and matches live markup', () => {
  it('RED: applyDiscountCode injects #ccd-discount-code-row with ccd-discount-row__input', async () => {
    const mod = await import('@/app/dashboard/addons/addon-transforms');
    expect(typeof (mod as any).applyDiscountCode).toBe('function');
    const out = (mod as any).applyDiscountCode(makeCartHtml(), {
      position: 'bottom',
      placeholder: 'Discount code',
      applyLabel: 'Apply',
    });
    // Positive: live storefront id + input class
    expect(out).toContain('id="ccd-discount-code-row"');
    expect(out).toContain('class="ccd-discount-row__input"');
    expect(out).toContain('class="ccd-discount-row__apply"');
    expect(out).toContain('Discount code');
    // Negative: must NOT use the legacy cart-editor-only class name
    expect(out).not.toContain('ccd-footer-discount-zone');
  });
});

describe('RED: applyTermsCheckbox shared transform exists and matches live markup', () => {
  it('RED: applyTermsCheckbox injects #ccd-terms-row with ccd-terms-row__checkbox', async () => {
    const mod = await import('@/app/dashboard/addons/addon-transforms');
    expect(typeof (mod as any).applyTermsCheckbox).toBe('function');
    const out = (mod as any).applyTermsCheckbox(makeCartHtml(), {
      labelHtml: 'I agree to the <a href="#">terms</a>',
    });
    // Positive: live storefront id + checkbox class
    expect(out).toContain('id="ccd-terms-row"');
    expect(out).toContain('class="ccd-terms-row"');
    expect(out).toContain('class="ccd-terms-row__checkbox"');
    expect(out).toContain('I agree to the');
    // Negative: must NOT use the legacy cart-editor-only class name
    expect(out).not.toContain('ccd-footer-terms-zone');
  });

  it('RED: applyTermsCheckbox inserts BEFORE .ccd-checkout-btn (matches live)', async () => {
    const mod = await import('@/app/dashboard/addons/addon-transforms');
    const out = (mod as any).applyTermsCheckbox(makeCartHtml(), {
      labelHtml: 'Agree',
    });
    const termsIdx = out.indexOf('id="ccd-terms-row"');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(termsIdx).toBeGreaterThan(-1);
    expect(checkoutIdx).toBeGreaterThan(-1);
    // Positive: terms row appears before the checkout button (matches live insertion)
    expect(termsIdx).toBeLessThan(checkoutIdx);
  });
});

describe('RED: applyLowStockBadge works even when item HTML has no variant div', () => {
  it('RED: badge injected on variant-less item (matches focused-branch fix)', () => {
    const out = applyLowStockBadge(makeCartHtmlNoVariant(), {
      mode: 'fake',
      target: '1',
      fakeQty: 2,
      text: 'Only {n} left!',
      icon: 'fire',
    });
    // Positive: badge rendered even though item has no .ccd-item__variant
    expect(out).toContain('ccd-scarcity-badge');
    expect(out).toContain('Only 2 left!');
    // Negative: untouched item content still present
    expect(out).toContain('Product 1');
  });
});

// =====================================================================
// Phase 3 — RED preview-renderer integration tests
// =====================================================================

describe('RED: preview-renderer wires footer-zone addons with live class names', () => {
  it('RED: notes enabled → renderPreview emits #ccd-notes-row', async () => {
    const { renderPreview } = await import('@/app/dashboard/cart-editor/preview-renderer');
    const html = renderPreview({
      overrides: {},
      previewState: 'items',
      addons: {
        notes: {
          enabled: true,
          config: { position: 'bottom', placeholder: 'Add a note', maxChars: 250, labelText: 'Notes' },
        },
      },
    });
    // Positive: live id appears
    expect(html).toContain('id="ccd-notes-row"');
    expect(html).toContain('ccd-notes-row__input');
    // Negative: legacy cart-editor-only zone wrapper is gone
    expect(html).not.toContain('ccd-footer-notes-zone');
  });

  it('RED: discountCode enabled → renderPreview emits #ccd-discount-code-row', async () => {
    const { renderPreview } = await import('@/app/dashboard/cart-editor/preview-renderer');
    const html = renderPreview({
      overrides: {},
      previewState: 'items',
      addons: {
        discountCode: {
          enabled: true,
          config: { position: 'bottom', placeholder: 'Discount code', applyLabel: 'Apply' },
        },
      },
    });
    expect(html).toContain('id="ccd-discount-code-row"');
    expect(html).toContain('ccd-discount-row__input');
    expect(html).not.toContain('ccd-footer-discount-zone');
  });

  it('RED: termsCheckbox enabled → renderPreview emits #ccd-terms-row', async () => {
    const { renderPreview } = await import('@/app/dashboard/cart-editor/preview-renderer');
    const html = renderPreview({
      overrides: {},
      previewState: 'items',
      addons: {
        termsCheckbox: {
          enabled: true,
          config: { labelHtml: 'I agree to the terms' },
        },
      },
    });
    expect(html).toContain('id="ccd-terms-row"');
    expect(html).toContain('ccd-terms-row__checkbox');
    expect(html).not.toContain('ccd-footer-terms-zone');
  });

  it('RED: disabled footer-zone addons do NOT inject their containers', async () => {
    const { renderPreview } = await import('@/app/dashboard/cart-editor/preview-renderer');
    const html = renderPreview({
      overrides: {},
      previewState: 'items',
      addons: {
        notes: { enabled: false, config: { position: 'bottom' } },
        discountCode: { enabled: false, config: { position: 'bottom' } },
        termsCheckbox: { enabled: false, config: { labelHtml: '' } },
      },
    });
    expect(html).not.toContain('id="ccd-notes-row"');
    expect(html).not.toContain('id="ccd-discount-code-row"');
    expect(html).not.toContain('id="ccd-terms-row"');
  });
});
