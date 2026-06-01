// @vitest-environment jsdom
/**
 * BLAST RADIUS MAP — Cart Editor hotspot resolution against CONTROL_HTML
 * Target: HOTSPOTS, resolveHotspotFromPoint, findHotspotElement
 *         in src/app/dashboard/cart-editor/overlay/hotspots.ts
 *
 * BUG: hotspot selectors target a fake `#CCD-Drawer` shell (`.ccd-header`,
 *      `.ccd-milestone`, `.ccd-empty`, `.ccd-trust-line`) that does NOT exist
 *      in the real cart HTML (CONTROL_HTML). When we switch the preview to
 *      CONTROL_HTML, every click-to-edit overlay breaks.
 *
 * FIX: remap hotspot selectors to CONTROL_HTML class names:
 *      header → .drawer__header
 *      milestoneBar → .ccd-progress
 *      lineItem → .ccd-item (unchanged)
 *      emptyState → .drawer__cart-empty
 *      footer → .ccd-sticky-footer (unchanged)
 *      checkoutButton → .ccd-checkout-btn (unchanged)
 *      trustLine → .ccd-trust
 *      global → #CartDrawer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { findHotspotElement, HOTSPOTS } from '@/app/dashboard/cart-editor/overlay/hotspots';

// Minimal CONTROL_HTML-shaped DOM so we can verify findHotspotElement() against
// the structure the live preview actually renders.
const CONTROL_DOM = `
  <div id="CartDrawer" class="custom-cart-drawer">
    <form class="drawer__contents">
      <div class="drawer__fixed-header">
        <div class="drawer__header">
          <div class="h2 drawer__title">Your Cart</div>
        </div>
        <div class="ccd-progress">
          <div class="ccd-progress__message">progress</div>
        </div>
      </div>
      <div class="drawer__inner">
        <div class="drawer__scrollable">
          <div class="cart__items">
            <div class="ccd-item">item A</div>
            <div class="ccd-item">item B</div>
          </div>
          <div class="drawer__cart-empty">Your cart is empty</div>
        </div>
      </div>
      <div class="ccd-sticky-footer">
        <button class="ccd-checkout-btn">SECURE CHECKOUT</button>
        <div class="ccd-trust"><span>30 day risk free returns</span></div>
      </div>
    </form>
  </div>
`;

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `<div id="preview-host">${CONTROL_DOM}</div>`;
  root = document.getElementById('preview-host') as HTMLElement;
});

describe('hotspot selectors match CONTROL_HTML structure', () => {
  it('global hotspot resolves to #CartDrawer', () => {
    const el = findHotspotElement(root, 'global');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('CartDrawer');
  });

  it('header hotspot resolves to .drawer__header', () => {
    const el = findHotspotElement(root, 'header');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('drawer__header')).toBe(true);
  });

  it('milestoneBar hotspot resolves to .ccd-progress', () => {
    const el = findHotspotElement(root, 'milestoneBar');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-progress')).toBe(true);
  });

  it('lineItem hotspot resolves to the first .ccd-item', () => {
    const el = findHotspotElement(root, 'lineItem');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-item')).toBe(true);
    expect(el!.textContent).toContain('item A');
  });

  it('emptyState hotspot resolves to .drawer__cart-empty', () => {
    const el = findHotspotElement(root, 'emptyState');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('drawer__cart-empty')).toBe(true);
  });

  it('footer hotspot resolves to .ccd-sticky-footer', () => {
    const el = findHotspotElement(root, 'footer');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-sticky-footer')).toBe(true);
  });

  it('checkoutButton hotspot resolves to .ccd-checkout-btn', () => {
    const el = findHotspotElement(root, 'checkoutButton');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-checkout-btn')).toBe(true);
  });

  it('trustLine hotspot resolves to .ccd-trust', () => {
    const el = findHotspotElement(root, 'trustLine');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-trust')).toBe(true);
  });
});

describe('hotspot registry hygiene', () => {
  it('keeps all original hotspot ids (header, milestoneBar, lineItem, emptyState, footer, checkoutButton, trustLine, global)', () => {
    const ids = new Set(HOTSPOTS.map((h) => h.id));
    for (const id of ['header', 'milestoneBar', 'lineItem', 'emptyState', 'footer', 'checkoutButton', 'trustLine', 'global']) {
      expect(ids.has(id as any)).toBe(true);
    }
  });

  it('most-specific selectors come before generic ones (checkoutButton before footer; lineItem before global)', () => {
    const order = HOTSPOTS.map((h) => h.id);
    expect(order.indexOf('checkoutButton')).toBeLessThan(order.indexOf('footer'));
    expect(order.indexOf('lineItem')).toBeLessThan(order.indexOf('global'));
    expect(order.indexOf('trustLine')).toBeLessThan(order.indexOf('footer'));
  });
});

describe('addon hotspots route as deep-link (Issue #3)', () => {
  // CONTRACT: overlay click handler navigates addon.* hotspots to
  // /dashboard/addons?expand=<addonKey> instead of just selecting them.
  it.each([
    ['addon.notes'],
    ['addon.discountCode'],
    ['addon.termsCheckbox'],
    ['addon.expressPayments'],
  ])('%s is marked target=deep-link', (hotspotId) => {
    const hs = HOTSPOTS.find((h) => h.id === hotspotId);
    expect(hs).toBeDefined();
    expect(hs!.target).toBe('deep-link');
  });

  it('non-addon hotspots stay inline', () => {
    for (const id of ['header', 'milestoneBar', 'lineItem', 'emptyState', 'footer', 'checkoutButton', 'trustLine', 'global']) {
      const hs = HOTSPOTS.find((h) => h.id === id);
      expect(hs!.target).toBe('inline');
    }
  });

  it('every deep-link hotspot id starts with "addon." so the URL key is derivable', () => {
    const deepLinks = HOTSPOTS.filter((h) => h.target === 'deep-link');
    expect(deepLinks.length).toBeGreaterThan(0);
    for (const hs of deepLinks) {
      expect(hs.id.startsWith('addon.')).toBe(true);
      expect(hs.id.slice('addon.'.length).length).toBeGreaterThan(0);
    }
  });
});
