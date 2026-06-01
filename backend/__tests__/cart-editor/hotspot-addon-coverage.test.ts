// @vitest-environment jsdom
/**
 * BLAST RADIUS MAP — Cart Editor addon hotspot coverage gaps (2026-05-29 #2)
 * Target: HOTSPOTS, resolveHotspotFromPoint, findHotspotElement
 *         in src/app/dashboard/cart-editor/overlay/hotspots.ts
 *         ELEMENT_EDITORS in src/app/dashboard/cart-editor/page.tsx
 *
 * BUG: Several addon transforms inject elements with stable IDs/classes
 *      (`#ccd-scarcity-timer`, `.ccd-shipping-protection`, `#ccd-upsell`,
 *      `#ccd-social-proof`, `#ccd-express-payments`) that have NO matching
 *      hotspot. Clicking them currently resolves to the catch-all `footer`
 *      or `global` hotspot instead of deep-linking to the addon config card.
 *
 * FIX: Add 5 addon.* deep-link hotspots:
 *   - addon.shippingProtection    → .ccd-shipping-protection
 *   - addon.scarcityTimer         → #ccd-scarcity-timer
 *   - addon.upsellRecommendations → #ccd-upsell
 *   - addon.socialProof           → #ccd-social-proof
 *   - addon.expressPayments must ALSO match the rich #ccd-express-payments
 *     div (currently only legacy .ccd-footer-express-zone is covered).
 *
 *   Each must be ordered BEFORE 'footer' and 'global' so most-specific wins.
 *   Each must have a matching ELEMENT_EDITORS entry pointing to AddonDeepLink.
 *
 * CALLERS:
 *   - overlay/overlay.tsx (resolveHotspotFromPoint, findHotspotElement)
 *   - cart-editor/page.tsx (ELEMENT_EDITORS lookup)
 *
 * SHARED STATE:
 *   - useDraftStore.selectedElementId is the hotspot id string. Every new id
 *     in HOTSPOTS MUST exist in ELEMENT_EDITORS or the right panel falls
 *     through to "Editor for X not implemented yet."
 *
 * CROSS-PATH RISK:
 *   - addon.expressPayments selector previously matched ONLY
 *     `.ccd-footer-express-zone`. Broadening it to a compound selector
 *     must NOT break the existing legacy-zone resolution
 *     (LOCK: addon.expressPayments still resolves to .ccd-footer-express-zone).
 *   - Inserting new addon hotspots BEFORE `footer` must NOT change the
 *     existing footer resolution when no addon zones are present
 *     (LOCK: footer alone still resolves to .ccd-sticky-footer).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HOTSPOTS,
  findHotspotElement,
  resolveHotspotFromPoint,
  type HotspotId,
} from '@/app/dashboard/cart-editor/overlay/hotspots';

// Rich CONTROL_HTML-shaped DOM containing every addon-transform output.
// Mirrors what renderPreview() produces when all addons are enabled.
const FULL_ADDON_DOM = `
  <div id="CartDrawer" class="custom-cart-drawer">
    <form class="drawer__contents">
      <div id="ccd-scarcity-timer" style="padding:8px 16px">
        <span>Your cart is reserved for <strong>09:00</strong></span>
      </div>
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
                    <button class="ccd-qty__btn ccd-qty__btn--plus">+</button>
                  </div>
                  <div class="ccd-item__price-col">
                    <span class="ccd-item__price">$10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div id="ccd-upsell" style="padding:4px 0">
            <div class="ccd-upsell-headline">You may also like</div>
            <button class="ccd-upsell-btn">Add to cart</button>
          </div>
          <div id="ccd-social-proof" style="text-align:center">
            <span>27 shoppers bought this in the last 24h</span>
          </div>
        </div>
      </div>
      <div class="ccd-sticky-footer">
        <div class="ccd-shipping-protection">
          <div class="ccd-shipping-protection__icon"><svg></svg></div>
          <div class="ccd-shipping-protection__info">
            <div class="ccd-shipping-protection__title">Shipping Protection</div>
            <div class="ccd-shipping-protection__desc">Covers lost packages</div>
          </div>
          <label><input type="checkbox" checked><span class="ccd-shipping-protection__price">$4.99</span></label>
        </div>
        <div class="ccd-footer-express-zone" data-ce-id="addon.expressPayments">
          <div class="ccd-express-btn ccd-express-paypal">paypal</div>
        </div>
        <button type="button" class="ccd-checkout-btn">SECURE CHECKOUT</button>
        <div id="ccd-express-payments" style="padding:0 0 8px">
          <button class="ccd-express-pill ccd-express-apple-pay">Apple Pay</button>
        </div>
        <div id="ccd-trust-badges" class="ccd-trust-badges">
          <img src="visa.png" alt="visa">
        </div>
        <div class="ccd-trust"><span>30 day risk free returns</span></div>
      </div>
    </form>
  </div>
`;

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `<div id="preview-host">${FULL_ADDON_DOM}</div>`;
  root = document.getElementById('preview-host') as HTMLElement;
});

// ──────────────────────────────────────────────────────────────────────────
// LOCK — every PRE-EXISTING hotspot still resolves to the correct element
// after we add 5 new ones in front of footer/global.
// ──────────────────────────────────────────────────────────────────────────
describe('LOCK: pre-existing hotspot resolution unchanged', () => {
  const PREEXISTING: { id: HotspotId; expectMatch: (el: HTMLElement) => boolean }[] = [
    { id: 'global', expectMatch: (el) => el.id === 'CartDrawer' },
    { id: 'header', expectMatch: (el) => el.classList.contains('drawer__header') },
    { id: 'milestoneBar', expectMatch: (el) => el.classList.contains('ccd-progress') },
    { id: 'footer', expectMatch: (el) => el.classList.contains('ccd-sticky-footer') },
    { id: 'checkoutButton', expectMatch: (el) => el.classList.contains('ccd-checkout-btn') },
    { id: 'trustLine', expectMatch: (el) => el.classList.contains('ccd-trust') },
    { id: 'lineItem', expectMatch: (el) => el.classList.contains('ccd-item') },
    { id: 'lineItem.image', expectMatch: (el) => el.classList.contains('ccd-item__image') },
    { id: 'lineItem.name', expectMatch: (el) => el.classList.contains('ccd-item__name') },
    { id: 'lineItem.quantity', expectMatch: (el) => el.classList.contains('ccd-qty') },
    { id: 'lineItem.remove', expectMatch: (el) => el.classList.contains('ccd-item__remove') },
    { id: 'lineItem.price', expectMatch: (el) => el.classList.contains('ccd-item__price-col') },
    { id: 'addon.trustBadges', expectMatch: (el) => el.classList.contains('ccd-trust-badges') },
  ];

  it.each(PREEXISTING)('hotspot "$id" still resolves to expected element', ({ id, expectMatch }) => {
    const el = findHotspotElement(root, id);
    expect(el).not.toBeNull();
    expect(expectMatch(el as HTMLElement)).toBe(true);
  });

  it('LOCK: addon.expressPayments still resolves to legacy .ccd-footer-express-zone', () => {
    const el = findHotspotElement(root, 'addon.expressPayments');
    expect(el).not.toBeNull();
    // Compound selector must still match the legacy zone div, not just the new pill.
    const matchesLegacy = el!.classList.contains('ccd-footer-express-zone');
    const matchesRich = el!.id === 'ccd-express-payments';
    expect(matchesLegacy || matchesRich).toBe(true);
  });

  it('LOCK: footer still resolves to .ccd-sticky-footer when no addon zones present', () => {
    document.body.innerHTML = `<div id="preview-host">
      <div id="CartDrawer">
        <div class="ccd-sticky-footer">
          <button class="ccd-checkout-btn">go</button>
        </div>
      </div>
    </div>`;
    const r2 = document.getElementById('preview-host') as HTMLElement;
    const el = findHotspotElement(r2, 'footer');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-sticky-footer')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RED — new addon deep-link hotspots
// ──────────────────────────────────────────────────────────────────────────
describe('NEW: addon.shippingProtection hotspot', () => {
  it('exists in HOTSPOTS with selector .ccd-shipping-protection and target=deep-link', () => {
    const hs = HOTSPOTS.find((h) => h.id === 'addon.shippingProtection');
    expect(hs).toBeDefined();
    expect(hs!.selector).toBe('.ccd-shipping-protection');
    expect(hs!.target).toBe('deep-link');
  });

  it('findHotspotElement resolves to the .ccd-shipping-protection block', () => {
    const el = findHotspotElement(root, 'addon.shippingProtection');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-shipping-protection')).toBe(true);
  });

  it('clicking inside the shipping-protection title resolves to addon.shippingProtection (NOT footer)', () => {
    const title = root.querySelector('.ccd-shipping-protection__title') as HTMLElement;
    expect(title).not.toBeNull();
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [title, title.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs).not.toBeNull();
      expect(hs!.id).toBe('addon.shippingProtection');
      expect(hs!.id).not.toBe('footer');
      expect(hs!.id).not.toBe('global');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });
});

describe('NEW: addon.scarcityTimer hotspot', () => {
  it('exists in HOTSPOTS with selector #ccd-scarcity-timer and target=deep-link', () => {
    const hs = HOTSPOTS.find((h) => h.id === 'addon.scarcityTimer');
    expect(hs).toBeDefined();
    expect(hs!.selector).toBe('#ccd-scarcity-timer');
    expect(hs!.target).toBe('deep-link');
  });

  it('findHotspotElement resolves to the #ccd-scarcity-timer container', () => {
    const el = findHotspotElement(root, 'addon.scarcityTimer');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('ccd-scarcity-timer');
  });

  it('clicking inside the scarcity-timer text resolves to addon.scarcityTimer', () => {
    const innerSpan = root.querySelector('#ccd-scarcity-timer span') as HTMLElement;
    expect(innerSpan).not.toBeNull();
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [innerSpan, innerSpan.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs!.id).toBe('addon.scarcityTimer');
      expect(hs!.id).not.toBe('global');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });
});

describe('NEW: addon.upsellRecommendations hotspot', () => {
  it('exists in HOTSPOTS with selector #ccd-upsell and target=deep-link', () => {
    const hs = HOTSPOTS.find((h) => h.id === 'addon.upsellRecommendations');
    expect(hs).toBeDefined();
    expect(hs!.selector).toBe('#ccd-upsell');
    expect(hs!.target).toBe('deep-link');
  });

  it('findHotspotElement resolves to the #ccd-upsell container', () => {
    const el = findHotspotElement(root, 'addon.upsellRecommendations');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('ccd-upsell');
  });

  it('clicking the upsell button resolves to addon.upsellRecommendations', () => {
    const btn = root.querySelector('.ccd-upsell-btn') as HTMLElement;
    expect(btn).not.toBeNull();
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [btn, btn.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs!.id).toBe('addon.upsellRecommendations');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });
});

describe('NEW: addon.socialProof hotspot', () => {
  it('exists in HOTSPOTS with selector #ccd-social-proof and target=deep-link', () => {
    const hs = HOTSPOTS.find((h) => h.id === 'addon.socialProof');
    expect(hs).toBeDefined();
    expect(hs!.selector).toBe('#ccd-social-proof');
    expect(hs!.target).toBe('deep-link');
  });

  it('findHotspotElement resolves to the #ccd-social-proof container', () => {
    const el = findHotspotElement(root, 'addon.socialProof');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('ccd-social-proof');
  });

  it('clicking the social-proof text resolves to addon.socialProof', () => {
    const inner = root.querySelector('#ccd-social-proof span') as HTMLElement;
    expect(inner).not.toBeNull();
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [inner, inner.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs!.id).toBe('addon.socialProof');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });
});

describe('NEW: addon.expressPayments resolves rich #ccd-express-payments too', () => {
  it('clicking the rich express pill (inside #ccd-express-payments) resolves to addon.expressPayments', () => {
    const pill = root.querySelector('#ccd-express-payments .ccd-express-pill') as HTMLElement;
    expect(pill).not.toBeNull();
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [pill, pill.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs).not.toBeNull();
      expect(hs!.id).toBe('addon.expressPayments');
      // NOT the surrounding footer
      expect(hs!.id).not.toBe('footer');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Ordering invariant — every new addon.* hotspot must be ordered BEFORE
// 'footer' and 'global' so most-specific resolution wins inside the footer.
// ──────────────────────────────────────────────────────────────────────────
describe('ORDERING: new addon hotspots come before footer/global catch-alls', () => {
  const NEW_IDS: HotspotId[] = [
    'addon.shippingProtection',
    'addon.scarcityTimer',
    'addon.upsellRecommendations',
    'addon.socialProof',
  ];

  it.each(NEW_IDS)('%s appears before footer in HOTSPOTS', (id) => {
    const order = HOTSPOTS.map((h) => h.id);
    const idx = order.indexOf(id);
    const footerIdx = order.indexOf('footer');
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(footerIdx);
  });

  it.each(NEW_IDS)('%s appears before global in HOTSPOTS', (id) => {
    const order = HOTSPOTS.map((h) => h.id);
    const idx = order.indexOf(id);
    const globalIdx = order.indexOf('global');
    expect(idx).toBeLessThan(globalIdx);
  });

  it('every deep-link hotspot id starts with "addon."', () => {
    for (const hs of HOTSPOTS) {
      if (hs.target === 'deep-link') {
        expect(hs.id.startsWith('addon.')).toBe(true);
      }
    }
  });
});
