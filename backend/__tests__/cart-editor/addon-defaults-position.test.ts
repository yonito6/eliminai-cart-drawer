/**
 * BLAST RADIUS MAP — Notes + Discount default position = "above-checkout"
 * + Order-notes textarea is smaller by default (min-height 44px).
 * Request (2026-05-31): both the Order-Note field and the Discount-Code field
 * must DEFAULT to the "above the checkout button" position, and the notes
 * textarea must be smaller by default.
 *
 * Target:
 *   - addon-definitions.ts notes/discountCode defaultConfig.position + dimension default
 *   - addon-transforms.ts applyNotes / applyDiscountCode (preview DOM)
 *   - v14-complete.js CCD.injectNotes / CCD.injectDiscountCode (live DOM)
 *   - cart-constants.ts REAL_CART_CSS + v14 inline CSS (.ccd-notes-row__input size)
 *
 * CALLERS:
 *   - addon-preview.tsx → applyNotes / applyDiscountCode (dashboard preview)
 *   - v14-complete.js dispatch map → CCD.injectNotes / CCD.injectDiscountCode (live cart)
 *
 * DUPLICATED LOGIC (must stay in agreement):
 *   - applyNotes (preview)  ↔ CCD.injectNotes (live)
 *   - applyDiscountCode (preview) ↔ CCD.injectDiscountCode (live)
 *   - REAL_CART_CSS .ccd-notes-row__input ↔ v14 inline .ccd-notes-row__input
 *
 * CROSS-PATH RISK:
 *   - Default in preview ≠ default in live cart → dashboard preview diverges from storefront
 *   - Notes added above-checkout in one path but not the other → previews diverge
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyNotes, applyDiscountCode } from '../../src/app/dashboard/addons/addon-transforms';
import { REAL_CART_CSS } from '../../src/app/dashboard/cart-constants';
import { ADDON_DEFINITIONS } from '../../src/lib/addon-definitions';

const V14_PATH = join(
  process.cwd(),
  '..',
  'extensions',
  'cart-drawer',
  'assets',
  'v14-complete.js',
);
const V14_SRC = readFileSync(V14_PATH, 'utf-8');

const BASE_HTML =
  '<div class="ccd-sticky-footer">' +
  '<button type="button" class="ccd-checkout-btn">Checkout</button>' +
  '<div class="ccd-trust">Trust</div>' +
  '</div>\n</div>';

function def(key: string) {
  const d = ADDON_DEFINITIONS.find((a) => a.key === key);
  if (!d) throw new Error('addon definition not found: ' + key);
  return d;
}

describe('Default position — addon-definitions registry', () => {
  it('notes defaultConfig.position is above-checkout', () => {
    expect(def('notes').defaultConfig.position).toBe('above-checkout');
    expect(def('notes').defaultConfig.position).not.toBe('bottom');
  });

  it('discountCode defaultConfig.position is above-checkout', () => {
    expect(def('discountCode').defaultConfig.position).toBe('above-checkout');
    expect(def('discountCode').defaultConfig.position).not.toBe('top');
  });

  it('notes position dimension offers above-checkout and defaults to it', () => {
    const dim = def('notes').dimensions.find((x) => x.key === 'position')!;
    expect(dim.default).toBe('above-checkout');
    expect((dim.options ?? []).map((o) => o.value)).toContain('above-checkout');
  });

  it('discountCode position dimension defaults to above-checkout', () => {
    const dim = def('discountCode').dimensions.find((x) => x.key === 'position')!;
    expect(dim.default).toBe('above-checkout');
  });
});

describe('Default position — preview transforms (empty config)', () => {
  it('applyNotes with no position inserts above the checkout button', () => {
    const out = applyNotes(BASE_HTML, {});
    expect(out).toContain('ccd-notes-row--above-checkout');
    expect(out).not.toContain('ccd-notes-row--bottom');
    const rowIdx = out.indexOf('ccd-notes-row');
    const btnIdx = out.indexOf('ccd-checkout-btn');
    expect(rowIdx).toBeGreaterThan(-1);
    expect(rowIdx).toBeLessThan(btnIdx);
  });

  it('applyNotes still honors explicit top and bottom', () => {
    expect(applyNotes(BASE_HTML, { position: 'top' })).toContain('ccd-notes-row--top');
    expect(applyNotes(BASE_HTML, { position: 'bottom' })).toContain('ccd-notes-row--bottom');
  });

  it('applyDiscountCode with no position inserts above the checkout button', () => {
    const out = applyDiscountCode(BASE_HTML, {});
    expect(out).toContain('ccd-discount-row--above-checkout');
    expect(out).not.toContain('ccd-discount-row--top');
    const rowIdx = out.indexOf('ccd-discount-code-row');
    const btnIdx = out.indexOf('ccd-checkout-btn');
    expect(rowIdx).toBeLessThan(btnIdx);
  });
});

describe('Default position — cross-path (live v14 mirrors preview)', () => {
  it('CCD.injectNotes defaults to above-checkout and inserts before checkout button', () => {
    const fn = V14_SRC.slice(V14_SRC.indexOf('CCD.injectNotes = function'));
    const body = fn.slice(0, fn.indexOf('CCD.injectDiscountCode = function'));
    // Default falls through to above-checkout (not bottom).
    expect(body).toContain("'above-checkout'");
    // Inserts before the checkout button when above-checkout.
    expect(body).toMatch(/above-checkout[\s\S]{0,200}querySelector\('\.ccd-checkout-btn'\)/);
  });

  it('CCD.injectDiscountCode defaults to above-checkout (not top)', () => {
    const fn = V14_SRC.slice(V14_SRC.indexOf('CCD.injectDiscountCode = function'));
    const body = fn.slice(0, 1500);
    // The position ternary must fall through to above-checkout, not top.
    expect(body).toMatch(/cfg\.position === 'top'[\s\S]{0,120}: 'above-checkout'/);
  });
});

describe('Notes textarea smaller by default — min-height 44px', () => {
  it('REAL_CART_CSS notes input min-height is 44px', () => {
    expect(REAL_CART_CSS).toMatch(/ccd-notes-row__input\{[^}]*min-height:\s*44px/);
    expect(REAL_CART_CSS).not.toMatch(/ccd-notes-row__input\{[^}]*min-height:\s*64px/);
  });

  it('v14 inline CSS notes input min-height is 44px', () => {
    expect(V14_SRC).toMatch(/ccd-notes-row__input ?\{[^}]*min-height:\s*44px/);
  });
});
