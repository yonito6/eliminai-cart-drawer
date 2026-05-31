/**
 * BLAST RADIUS MAP — Order Notes visual redesign
 * Target: .ccd-notes-row visual styling (currently NO CSS exists for it)
 *
 * CALLERS:
 *   - applyNotes (addon-transforms.ts:765) called from addon-preview.tsx:255 + :856
 *   - CCD.injectNotes (v14-complete.js:5028) called from dispatch map line 3989
 *
 * DUPLICATED LOGIC:
 *   - applyNotes ↔ CCD.injectNotes must produce same DOM markup
 *   - v14 inline CSS ↔ REAL_CART_CSS must contain same .ccd-notes-row rules
 *
 * SHARED STATE:
 *   - DOM ids/classes: #ccd-notes-row, .ccd-notes-row, .ccd-notes-row__label, .ccd-notes-row__input
 *   - Strip regex in applyNotes:768 is non-greedy → DOM must stay FLAT (no nested divs)
 *
 * CROSS-PATH RISK:
 *   - CSS in v14 but not REAL_CART_CSS → dashboard preview ≠ live cart
 *   - DOM change in one path but not other → previews diverge
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyNotes } from '../../src/app/dashboard/addons/addon-transforms';
import { REAL_CART_CSS } from '../../src/app/dashboard/cart-constants';

const V14_PATH = join(
  process.cwd(),
  '..',
  'extensions',
  'cart-drawer',
  'assets',
  'v14-complete.js',
);
const V14_SOURCE = readFileSync(V14_PATH, 'utf-8');

const BASE_HTML =
  '<div class="ccd-sticky-footer">' +
  '<button class="ccd-checkout-btn">Checkout</button>' +
  '<div class="ccd-trust">30 day risk free</div>' +
  '</div>\n</div>';

describe('Notes addon — DOM structure (LOCK)', () => {
  it('renders flat DOM: label + textarea as direct children of #ccd-notes-row', () => {
    const out = applyNotes(BASE_HTML, {
      label: 'Add a note',
      placeholder: 'Optional',
      maxChars: 250,
      position: 'bottom',
    });

    // Must contain the row id and class
    expect(out).toContain('id="ccd-notes-row"');
    expect(out).toContain('class="ccd-notes-row ccd-notes-row--bottom"');

    // Label + textarea both present
    expect(out).toContain('class="ccd-notes-row__label"');
    expect(out).toContain('class="ccd-notes-row__input"');

    // FLAT structure — no nested divs inside #ccd-notes-row (regex strip dependency)
    const rowMatch = out.match(/<div id="ccd-notes-row"[\s\S]*?<\/div>/);
    expect(rowMatch).not.toBeNull();
    if (rowMatch) {
      // The matched row must not contain another <div> opener
      expect(rowMatch[0]).not.toMatch(/<div(?!\s+id="ccd-notes-row")/);
    }
  });

  it('honors top position — inserts as first child of sticky footer', () => {
    const out = applyNotes(BASE_HTML, { label: 'Top', position: 'top' });
    const footerStart = out.indexOf('<div class="ccd-sticky-footer">');
    const notesIdx = out.indexOf('id="ccd-notes-row"');
    const checkoutIdx = out.indexOf('ccd-checkout-btn');
    expect(notesIdx).toBeGreaterThan(footerStart);
    expect(notesIdx).toBeLessThan(checkoutIdx);
    expect(out).toContain('ccd-notes-row--top');
  });

  it('strip regex is idempotent — applying twice yields identical output', () => {
    const once = applyNotes(BASE_HTML, { label: 'X', position: 'bottom' });
    const twice = applyNotes(once, { label: 'X', position: 'bottom' });
    expect(twice).toBe(once);
  });
});

describe('Notes addon — visual CSS (RED → green after fix)', () => {
  it('REAL_CART_CSS contains .ccd-notes-row styling', () => {
    // After fix: REAL_CART_CSS must define padding/spacing for the row container
    expect(REAL_CART_CSS).toMatch(/\.ccd-notes-row\b/);
  });

  it('REAL_CART_CSS styles the textarea — border, padding, focus state', () => {
    expect(REAL_CART_CSS).toMatch(/\.ccd-notes-row__input/);
    // Textarea must have a border (cleanly rounded form input look)
    expect(REAL_CART_CSS).toMatch(/\.ccd-notes-row__input[\s\S]{0,300}border:/);
    // Focus state styled
    expect(REAL_CART_CSS).toMatch(/\.ccd-notes-row__input:focus/);
  });

  it('REAL_CART_CSS styles the label — small, gray, spaced from textarea', () => {
    expect(REAL_CART_CSS).toMatch(/\.ccd-notes-row__label/);
  });

  it('v14-complete.js inline stylesheet contains .ccd-notes-row CSS', () => {
    expect(V14_SOURCE).toMatch(/\.ccd-notes-row\b/);
    expect(V14_SOURCE).toMatch(/\.ccd-notes-row__input/);
    expect(V14_SOURCE).toMatch(/\.ccd-notes-row__input:focus/);
  });

  it('CSS rules match between v14 and REAL_CART_CSS (cross-path)', () => {
    // Both must define the same key selectors so preview matches live
    const v14Selectors = ['.ccd-notes-row', '.ccd-notes-row__label', '.ccd-notes-row__input', '.ccd-notes-row__input:focus'];
    for (const sel of v14Selectors) {
      const escaped = sel.replace(/[.()]/g, (c) => '\\' + c);
      const re = new RegExp(escaped + '\\b');
      expect(REAL_CART_CSS, `REAL_CART_CSS missing selector ${sel}`).toMatch(re);
      expect(V14_SOURCE, `v14-complete.js missing selector ${sel}`).toMatch(re);
    }
  });
});
