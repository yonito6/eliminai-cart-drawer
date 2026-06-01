// @vitest-environment jsdom
/**
 * BLAST RADIUS MAP — Cart Editor hotspot coverage gaps (2026-05-29)
 * Target: HOTSPOTS, resolveHotspotFromPoint, findHotspotElement
 *         in src/app/dashboard/cart-editor/overlay/hotspots.ts
 *         ELEMENT_EDITORS in src/app/dashboard/cart-editor/page.tsx
 *
 * BUGS reported by Yoni:
 *   1. Trust badges not selectable — the `.ccd-trust-badges` element rendered
 *      by applyTrustBadges() has NO matching hotspot. Click falls through to
 *      the `#CartDrawer` catch-all, opening Global editor.
 *   2. Line items: clicking item #5 still highlights item #1, because
 *      findHotspotElement() always returns previewRoot.querySelector(selector)
 *      → the FIRST match, regardless of which DOM node the user clicked.
 *   3. Hover halo wraps the entire .ccd-item row — user wants per-sub-element
 *      halos (image, name, qty, remove, price).
 *   4. Checkout button bug is a side-effect of #2: when clicking checkout the
 *      ring DOES land on it (only 1 instance) but state confusion from prior
 *      stale selection makes it look unreliable.
 *
 * FIX:
 *   a. Add HotspotIds: 'addon.trustBadges' (deep-link → /addons?expand=trustBadges)
 *      plus 'lineItem.image' / 'lineItem.name' / 'lineItem.quantity'
 *      / 'lineItem.remove' / 'lineItem.price' (inline editors).
 *   b. Order: sub-element line-item hotspots MUST come BEFORE the catch-all
 *      'lineItem' selector, so resolveHotspotFromPoint matches the most
 *      specific zone first.
 *   c. Extend findHotspotElement(root, id, hint?) so the selection ring tracks
 *      the SPECIFIC clicked instance, not always the first DOM match.
 *
 * CALLERS:
 *   - overlay/overlay.tsx → findHotspotElement + resolveHotspotFromPoint
 *   - cart-editor/page.tsx → ELEMENT_EDITORS lookup by hotspot id
 *   - __tests__/cart-editor/hotspots.test.ts → LOCK on existing ids
 *
 * SHARED STATE:
 *   - useDraftStore.selectedElementId is the hotspot id string. New ids must
 *     map to entries in ELEMENT_EDITORS or the side panel shows "not implemented".
 *
 * CROSS-PATH RISK:
 *   - Inserting sub-element hotspots BEFORE 'lineItem' must not break the
 *     existing "lineItem hotspot resolves to .ccd-item" test in hotspots.test.ts.
 *   - findHotspotElement signature change must remain backward-compatible
 *     (hint is optional; no-hint path keeps querySelector behavior).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HOTSPOTS,
  findHotspotElement,
  resolveHotspotFromPoint,
  type HotspotId,
} from '@/app/dashboard/cart-editor/overlay/hotspots';

// CONTROL_HTML-shaped DOM that includes:
//  - Multiple ccd-item rows so we can test per-instance selection
//  - Rich sub-elements (.ccd-item__image, __name, .ccd-qty, __remove, __price-col)
//  - A trust-badges container (output of applyTrustBadges)
const RICH_DOM = `
  <div id="CartDrawer" class="custom-cart-drawer">
    <form class="drawer__contents">
      <div class="drawer__fixed-header">
        <div class="drawer__header"><div class="h2 drawer__title">Your Cart</div></div>
        <div class="ccd-progress"><div class="ccd-progress__message">progress</div></div>
      </div>
      <div class="drawer__inner">
        <div class="drawer__scrollable">
          <div class="cart__items">
            <div class="ccd-item" data-test="row-1">
              <div class="ccd-item__image"><a href="#"><img src="a.jpg" alt="A"></a></div>
              <div class="ccd-item__details">
                <div class="ccd-item__title-row">
                  <a href="#" class="ccd-item__name">Product A</a>
                  <button class="ccd-item__remove">x</button>
                </div>
                <div class="ccd-item__bottom">
                  <div class="ccd-qty">
                    <button class="ccd-qty__btn ccd-qty__btn--minus">-</button>
                    <input class="ccd-qty__input" value="1">
                    <button class="ccd-qty__btn ccd-qty__btn--plus">+</button>
                  </div>
                  <div class="ccd-item__price-col">
                    <div class="ccd-item__price-row"><span class="ccd-item__price">$10</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="ccd-item" data-test="row-2">
              <div class="ccd-item__image"><a href="#"><img src="b.jpg" alt="B"></a></div>
              <div class="ccd-item__details">
                <div class="ccd-item__title-row">
                  <a href="#" class="ccd-item__name">Product B</a>
                  <button class="ccd-item__remove">x</button>
                </div>
                <div class="ccd-item__bottom">
                  <div class="ccd-qty">
                    <button class="ccd-qty__btn ccd-qty__btn--minus">-</button>
                    <input class="ccd-qty__input" value="1">
                    <button class="ccd-qty__btn ccd-qty__btn--plus">+</button>
                  </div>
                  <div class="ccd-item__price-col">
                    <div class="ccd-item__price-row"><span class="ccd-item__price">$20</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="ccd-sticky-footer">
        <button class="ccd-checkout-btn">SECURE CHECKOUT</button>
        <div id="ccd-trust-badges" class="ccd-trust-badges">
          <img src="visa.png" alt="visa">
          <img src="mastercard.png" alt="mc">
        </div>
        <div class="ccd-trust"><span>30 day risk free returns</span></div>
      </div>
    </form>
  </div>
`;

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `<div id="preview-host">${RICH_DOM}</div>`;
  root = document.getElementById('preview-host') as HTMLElement;
});

// ──────────────────────────────────────────────────────────────────────────
// LOCK — all pre-existing hotspot ids stay registered and resolve correctly.
// ──────────────────────────────────────────────────────────────────────────
describe('LOCK: existing hotspots still resolve via findHotspotElement', () => {
  const PRE_EXISTING: HotspotId[] = [
    'global',
    'header',
    'milestoneBar',
    'lineItem',
    'footer',
    'checkoutButton',
    'trustLine',
    'addon.notes',
    'addon.discountCode',
    'addon.termsCheckbox',
    'addon.expressPayments',
  ];

  it.each(PRE_EXISTING)('hotspot id "%s" remains in HOTSPOTS registry', (id) => {
    const found = HOTSPOTS.find((h) => h.id === id);
    expect(found).toBeDefined();
  });

  it('lineItem still resolves to a .ccd-item element (no-hint path unchanged)', () => {
    const el = findHotspotElement(root, 'lineItem');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-item')).toBe(true);
  });

  it('checkoutButton still resolves to .ccd-checkout-btn', () => {
    const el = findHotspotElement(root, 'checkoutButton');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-checkout-btn')).toBe(true);
  });

  it('trustLine still resolves to .ccd-trust', () => {
    const el = findHotspotElement(root, 'trustLine');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-trust')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RED — Trust badges hotspot (Issue #1).
// ──────────────────────────────────────────────────────────────────────────
describe('NEW: addon.trustBadges hotspot is deep-link to Addons tab', () => {
  it('HOTSPOTS contains addon.trustBadges entry', () => {
    const hs = HOTSPOTS.find((h) => h.id === 'addon.trustBadges');
    expect(hs).toBeDefined();
    expect(hs!.selector).toBe('.ccd-trust-badges');
    expect(hs!.target).toBe('deep-link');
  });

  it('findHotspotElement resolves addon.trustBadges to the .ccd-trust-badges container', () => {
    const el = findHotspotElement(root, 'addon.trustBadges');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-trust-badges')).toBe(true);
  });

  it('clicking inside the trust-badges container resolves to addon.trustBadges (NOT global)', () => {
    const badge = root.querySelector('.ccd-trust-badges img') as HTMLElement;
    expect(badge).not.toBeNull();
    // Stub elementsFromPoint to return our element first (jsdom has no layout)
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [badge, badge.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs).not.toBeNull();
      expect(hs!.id).toBe('addon.trustBadges');
      // Negative: must NOT fall through to global
      expect(hs!.id).not.toBe('global');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RED — Line-item sub-element hotspots (Issue #3).
// ──────────────────────────────────────────────────────────────────────────
describe('NEW: line-item sub-element hotspots', () => {
  const SUB_HOTSPOTS: { id: HotspotId; selector: string; label: string }[] = [
    { id: 'lineItem.image', selector: '.ccd-item__image', label: 'image' },
    { id: 'lineItem.name', selector: '.ccd-item__name', label: 'name' },
    { id: 'lineItem.quantity', selector: '.ccd-qty', label: 'quantity' },
    { id: 'lineItem.remove', selector: '.ccd-item__remove', label: 'remove' },
    { id: 'lineItem.price', selector: '.ccd-item__price-col', label: 'price' },
  ];

  it.each(SUB_HOTSPOTS)('HOTSPOTS contains $id with selector $selector', ({ id, selector }) => {
    const hs = HOTSPOTS.find((h) => h.id === id);
    expect(hs).toBeDefined();
    expect(hs!.selector).toBe(selector);
    expect(hs!.target).toBe('inline');
  });

  it('every sub-element hotspot is ordered BEFORE the generic lineItem hotspot', () => {
    const order = HOTSPOTS.map((h) => h.id);
    const lineItemIdx = order.indexOf('lineItem');
    for (const { id } of SUB_HOTSPOTS) {
      const idx = order.indexOf(id);
      expect(idx).toBeGreaterThan(-1);
      // Sub-element must come BEFORE the catch-all lineItem
      expect(idx).toBeLessThan(lineItemIdx);
    }
  });

  it('clicking inside .ccd-item__image resolves to lineItem.image (NOT lineItem)', () => {
    const img = root.querySelector('.ccd-item[data-test="row-2"] .ccd-item__image img') as HTMLElement;
    expect(img).not.toBeNull();
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [img, img.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs).not.toBeNull();
      expect(hs!.id).toBe('lineItem.image');
      expect(hs!.id).not.toBe('lineItem');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });

  it('clicking the .ccd-qty__btn resolves to lineItem.quantity (most-specific zone wins)', () => {
    const btn = root.querySelector('.ccd-item[data-test="row-1"] .ccd-qty__btn--plus') as HTMLElement;
    expect(btn).not.toBeNull();
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [btn, btn.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs!.id).toBe('lineItem.quantity');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RED — findHotspotElement(root, id, hint?) tracks the clicked instance
// (Issue #2 — selection ring jumps to row #1 regardless of click target).
// ──────────────────────────────────────────────────────────────────────────
describe('NEW: findHotspotElement accepts an optional hint element', () => {
  it('with hint inside row #2, returns row #2 .ccd-item (not the first one)', () => {
    const row2name = root.querySelector(
      '.ccd-item[data-test="row-2"] .ccd-item__name',
    ) as HTMLElement;
    expect(row2name).not.toBeNull();
    const el = findHotspotElement(root, 'lineItem', row2name);
    expect(el).not.toBeNull();
    expect((el as HTMLElement).getAttribute('data-test')).toBe('row-2');
  });

  it('with hint inside row #2 for lineItem.image, returns row #2 image (not row #1)', () => {
    const row2img = root.querySelector(
      '.ccd-item[data-test="row-2"] .ccd-item__image img',
    ) as HTMLElement;
    expect(row2img).not.toBeNull();
    const el = findHotspotElement(root, 'lineItem.image', row2img);
    expect(el).not.toBeNull();
    // The matching ancestor must be inside row 2
    expect(el!.closest('.ccd-item')!.getAttribute('data-test')).toBe('row-2');
  });

  it('without hint, still returns FIRST match (no-hint path unchanged)', () => {
    const el = findHotspotElement(root, 'lineItem');
    expect(el).not.toBeNull();
    expect((el as HTMLElement).getAttribute('data-test')).toBe('row-1');
  });

  it('with hint OUTSIDE the previewRoot, falls back to first match (safe default)', () => {
    const detached = document.createElement('div');
    detached.className = 'ccd-item';
    const el = findHotspotElement(root, 'lineItem', detached);
    expect(el).not.toBeNull();
    // Did not return the detached node, returned the in-root first match
    expect(root.contains(el)).toBe(true);
  });
});
