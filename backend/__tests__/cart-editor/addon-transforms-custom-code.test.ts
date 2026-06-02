/**
 * BLAST RADIUS MAP — Custom HTML block addon (Issue #4)
 * Feature: a "Custom HTML" addon that lets a merchant inject any HTML at a
 * chosen placement in the cart footer (e.g. a "30-Day Risk-Free Returns"
 * badge). New stores get it empty/disabled; eliminai-test is seeded with the
 * merchant's HTML.
 *
 * Target (NEW code added to shared dispatch points):
 *   - addon-definitions.ts        → ADDON_DEFINITIONS gains a `customCode` entry
 *                                    (consumed by getDefaultAddonsConfig for new stores)
 *   - addon-transforms.ts         → new applyCustomCode + sanitizeCustomHtml
 *   - addon-preview.tsx           → ORDER pipeline entry + focused block (dashboard preview)
 *   - cart-editor/preview-renderer.ts → getAddon('customCode') + applyCustomCode (cart-editor preview)
 *   - v14-complete.js (BOTH copies) → CCD.injectCustomCode + _addonHandlers registry entry (live cart)
 *
 * CALLERS / PATHS that must agree (byte-for-byte markup):
 *   - applyCustomCode (preview) ↔ CCD.injectCustomCode (live storefront)
 *   - getDefaultAddonsConfig iterates ADDON_DEFINITIONS → new addon auto-seeds disabled
 *
 * SHARED STATE:
 *   - store.config / store.demoConfig → addons.customCode = { enabled, mode, config:{html,position} }
 *
 * CROSS-PATH RISK:
 *   - Definition added but transform missing → enabling crashes preview (the expressPayments .map bug)
 *   - Wired in ORDER pipeline but not focused block → focused preview blank
 *   - Wired in one preview path but not the other → dashboard ≠ cart-editor ≠ live
 *   - v14 copies drift → live cart diverges from preview
 *   - Sanitizer too loose → stored XSS; too strict → merchant HTML stripped
 *
 * ── MULTI-INSTANCE EXTENSION (2026-06-02) ───────────────────────────
 * Custom HTML becomes multi-instance: a merchant can add N blocks, each with its
 * own html + position. New config shape (BACKWARD COMPATIBLE):
 *   addons.customCode.config = {
 *     blocks: Array<{ html, position }>,   // NEW (source of truth when present)
 *     hideBuiltInTrustLine: boolean,       // stays a single GLOBAL toggle
 *     html?, position?                     // LEGACY single-block (still honored
 *                                          //   when `blocks` is absent)
 *   }
 * DOM ids: first block keeps `ccd-custom-code` (byte-compat with live stores);
 *   subsequent blocks get `ccd-custom-code-1`, `-2`, … All carry the shared
 *   `.ccd-custom-code` class so strip/remove targets every instance.
 * Paths touched (all must agree): applyCustomCode (both previews) ↔
 *   CCD.injectCustomCode + _customCodeBlocks (both v14 copies) ↔ dedicated editor
 *   (custom-code-addon-editor.tsx) ↔ page.tsx dedicated-editor wiring.
 * Definition dimensions (html/position/hideBuiltInTrustLine) are KEPT as metadata
 *   (legacy default seed stays {html:'',position:'above-checkout'}); the dedicated
 *   editor drives the blocks array in the UI.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyCustomCode,
  sanitizeCustomHtml,
  applyNotes,
} from '../../src/app/dashboard/addons/addon-transforms';
import {
  ADDON_DEFINITIONS,
  getAddonDefinition,
  getDefaultAddonsConfig,
} from '../../src/lib/addon-definitions';

const V14_PATH = join(
  process.cwd(),
  '..',
  'extensions',
  'cart-drawer',
  'assets',
  'v14-complete.js',
);
const V14_ROOT_PATH = join(process.cwd(), '..', 'v14-complete.js');
const V14_SRC = readFileSync(V14_PATH, 'utf-8');
const V14_ROOT_SRC = readFileSync(V14_ROOT_PATH, 'utf-8');

const BASE_HTML =
  '<div class="ccd-sticky-footer">' +
  '<button type="button" class="ccd-checkout-btn">Checkout</button>' +
  '<div class="ccd-trust">Trust</div>' +
  '</div>\n</div>';

// ── LOCK: existing behavior must not regress ─────────────────────────
describe('LOCK — adding customCode does not break existing addons', () => {
  it('LOCK: applyNotes above-checkout still inserts before the checkout button', () => {
    const out = applyNotes(BASE_HTML, {});
    expect(out).toContain('ccd-notes-row--above-checkout');
    expect(out.indexOf('ccd-notes-row')).toBeLessThan(out.indexOf('ccd-checkout-btn'));
  });

  it('LOCK: getDefaultAddonsConfig still seeds every existing addon (disabled)', () => {
    const { addons } = getDefaultAddonsConfig();
    for (const key of ['notes', 'discountCode', 'termsCheckbox', 'expressPayments']) {
      expect(addons[key]).toBeDefined();
      expect(addons[key].enabled).toBe(false);
    }
  });
});

// ── RED: the custom-code definition ──────────────────────────────────
describe('customCode — addon definition', () => {
  it('is registered in ADDON_DEFINITIONS', () => {
    expect(ADDON_DEFINITIONS.some((d) => d.key === 'customCode')).toBe(true);
    expect(getAddonDefinition('customCode')).toBeTruthy();
  });

  it('has an html (text) dimension and a position (select) dimension', () => {
    const def = getAddonDefinition('customCode')!;
    const html = def.dimensions.find((d) => d.key === 'html');
    const position = def.dimensions.find((d) => d.key === 'position');
    expect(html?.type).toBe('text');
    expect(position?.type).toBe('select');
    expect((position?.options ?? []).map((o) => o.value)).toContain('above-checkout');
  });

  it('defaults to empty html, disabled, above-checkout (new stores get nothing)', () => {
    const def = getAddonDefinition('customCode')!;
    expect(def.defaultConfig.enabled).toBe(false);
    expect(def.defaultConfig.html).toBe('');
    expect(def.defaultConfig.position).toBe('above-checkout');
  });

  it('getDefaultAddonsConfig seeds customCode disabled with empty html', () => {
    const { addons } = getDefaultAddonsConfig();
    expect(addons.customCode).toBeDefined();
    expect(addons.customCode.enabled).toBe(false);
    expect(addons.customCode.config.html).toBe('');
  });
});

// ── RED: sanitizer ───────────────────────────────────────────────────
describe('sanitizeCustomHtml — keeps formatting, strips execution vectors', () => {
  it('keeps common formatting tags, inline styles, links and images', () => {
    const raw =
      '<div style="text-align:center"><strong>30-Day Risk-Free Returns</strong>' +
      '<p>Shop with confidence.</p><a href="/policies">Learn more</a>' +
      '<img src="/badge.png" alt="badge"></div>';
    const out = sanitizeCustomHtml(raw);
    expect(out).toContain('<strong>');
    expect(out).toContain('style="text-align:center"');
    expect(out).toContain('<a href="/policies">');
    expect(out).toContain('<img');
    expect(out).toContain('30-Day Risk-Free Returns');
  });

  it('strips <script> blocks and their contents', () => {
    const out = sanitizeCustomHtml('<div>ok</div><script>alert(1)</script>');
    expect(out).toContain('<div>ok</div>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips <iframe>, <object>, <embed>, <style>, <link>, <meta>', () => {
    const out = sanitizeCustomHtml(
      '<iframe src="x"></iframe><object></object><embed><style>a{}</style><link><meta>'
    );
    const lc = out.toLowerCase();
    expect(lc).not.toContain('<iframe');
    expect(lc).not.toContain('<object');
    expect(lc).not.toContain('<embed');
    expect(lc).not.toContain('<style');
    expect(lc).not.toContain('<link');
    expect(lc).not.toContain('<meta');
  });

  it('strips on* event handlers and javascript: URIs', () => {
    const out = sanitizeCustomHtml(
      '<div onclick="steal()"><a href="javascript:evil()">x</a></div>'
    );
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('returns empty string for non-string / empty input', () => {
    expect(sanitizeCustomHtml(undefined as unknown as string)).toBe('');
    expect(sanitizeCustomHtml('')).toBe('');
    expect(sanitizeCustomHtml('   ')).toBe('');
  });
});

// ── RED: applyCustomCode transform ───────────────────────────────────
describe('applyCustomCode — footer placement (mirrors applyNotes)', () => {
  const HTML = '<p>Returns</p>';

  it('above-checkout (default) inserts #ccd-custom-code before the checkout button', () => {
    const out = applyCustomCode(BASE_HTML, { html: HTML });
    expect(out).toContain('id="ccd-custom-code"');
    expect(out).toContain('ccd-custom-code--above-checkout');
    expect(out.indexOf('ccd-custom-code')).toBeLessThan(out.indexOf('ccd-checkout-btn'));
    expect(out).toContain('<p>Returns</p>');
  });

  it('top inserts as first child of the sticky footer', () => {
    const out = applyCustomCode(BASE_HTML, { html: HTML, position: 'top' });
    expect(out).toContain('ccd-custom-code--top');
    const footerIdx = out.indexOf('ccd-sticky-footer');
    expect(out.indexOf('ccd-custom-code')).toBeGreaterThan(footerIdx);
    expect(out.indexOf('ccd-custom-code')).toBeLessThan(out.indexOf('ccd-checkout-btn'));
  });

  it('bottom inserts before the trust row', () => {
    const out = applyCustomCode(BASE_HTML, { html: HTML, position: 'bottom' });
    expect(out).toContain('ccd-custom-code--bottom');
    expect(out.indexOf('ccd-custom-code')).toBeLessThan(out.indexOf('ccd-trust'));
    expect(out.indexOf('ccd-custom-code')).toBeGreaterThan(out.indexOf('ccd-checkout-btn'));
  });

  it('is idempotent — running twice does not duplicate the block', () => {
    const once = applyCustomCode(BASE_HTML, { html: HTML });
    const twice = applyCustomCode(once, { html: HTML });
    const count = (twice.match(/id="ccd-custom-code"/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('is a no-op (no block) when html is empty', () => {
    const out = applyCustomCode(BASE_HTML, { html: '' });
    expect(out).not.toContain('ccd-custom-code');
  });

  it('sanitizes the injected html (no script survives)', () => {
    const out = applyCustomCode(BASE_HTML, { html: '<b>ok</b><script>evil()</script>' });
    expect(out).toContain('<b>ok</b>');
    expect(out.toLowerCase()).not.toContain('<script');
  });
});

// ── RED: cross-path parity with the live storefront (v14) ────────────
describe('customCode — v14 live storefront mirrors the preview transform', () => {
  it('CCD.injectCustomCode is defined in both v14 copies', () => {
    expect(V14_SRC).toContain('CCD.injectCustomCode = function');
    expect(V14_ROOT_SRC).toContain('CCD.injectCustomCode = function');
  });

  it('customCode is registered in the _addonHandlers dispatch map', () => {
    expect(V14_SRC).toMatch(
      /customCode\s*:\s*\{\s*inject\s*:\s*function\s*\([^)]*\)\s*\{\s*CCD\.injectCustomCode/
    );
  });

  it('injectCustomCode builds #ccd-custom-code and honors above-checkout', () => {
    const fn = V14_SRC.slice(V14_SRC.indexOf('CCD.injectCustomCode = function'));
    const body = fn.slice(0, 2400);
    expect(body).toContain("'ccd-custom-code'");
    expect(body).toContain("'above-checkout'");
    expect(body).toContain('.ccd-checkout-btn');
  });

  it('the two v14 copies stay byte-identical around injectCustomCode', () => {
    const a = V14_SRC.indexOf('CCD.injectCustomCode = function');
    const b = V14_ROOT_SRC.indexOf('CCD.injectCustomCode = function');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
    expect(V14_SRC.slice(a, a + 1200)).toBe(V14_ROOT_SRC.slice(b, b + 1200));
  });
});

// ── MULTI-INSTANCE: many custom HTML blocks at once ──────────────────
describe('applyCustomCode — multi-instance (blocks array)', () => {
  function idsOf(out: string): string[] {
    return (out.match(/id="(ccd-custom-code(?:-\d+)?)"/g) ?? []).map((m) =>
      m.slice('id="'.length, -1),
    );
  }

  it('LOCK: legacy single-object config still renders one block with id ccd-custom-code', () => {
    const out = applyCustomCode(BASE_HTML, { html: '<p>Returns</p>', position: 'bottom' });
    expect(idsOf(out)).toEqual(['ccd-custom-code']);
    expect(out).toContain('ccd-custom-code--bottom');
    expect(out).toContain('<p>Returns</p>');
  });

  it('RED: renders MULTIPLE blocks at once, each with a unique id', () => {
    const out = applyCustomCode(BASE_HTML, {
      blocks: [
        { html: '<p>A</p>', position: 'above-checkout' },
        { html: '<p>B</p>', position: 'bottom' },
        { html: '<p>C</p>', position: 'top' },
      ],
    });
    const ids = idsOf(out);
    expect(ids).toContain('ccd-custom-code');
    expect(ids).toContain('ccd-custom-code-1');
    expect(ids).toContain('ccd-custom-code-2');
    // no duplicate ids
    expect(new Set(ids).size).toBe(ids.length);
    expect(out).toContain('<p>A</p>');
    expect(out).toContain('<p>B</p>');
    expect(out).toContain('<p>C</p>');
  });

  it('RED: each block honors its OWN position', () => {
    const out = applyCustomCode(BASE_HTML, {
      blocks: [
        { html: '<p>ABOVE</p>', position: 'above-checkout' },
        { html: '<p>BELOW</p>', position: 'bottom' },
      ],
    });
    const aboveIdx = out.indexOf('<p>ABOVE</p>');
    const belowIdx = out.indexOf('<p>BELOW</p>');
    const checkoutIdx = out.indexOf('ccd-checkout-btn');
    const trustIdx = out.indexOf('ccd-trust');
    // above-checkout block sits before the checkout button…
    expect(aboveIdx).toBeLessThan(checkoutIdx);
    // …bottom block sits after the checkout button but before the trust row.
    expect(belowIdx).toBeGreaterThan(checkoutIdx);
    expect(belowIdx).toBeLessThan(trustIdx);
  });

  it('RED: preserves array ORDER for blocks sharing a position', () => {
    const out = applyCustomCode(BASE_HTML, {
      blocks: [
        { html: '<p>FIRST</p>', position: 'above-checkout' },
        { html: '<p>SECOND</p>', position: 'above-checkout' },
      ],
    });
    expect(out.indexOf('<p>FIRST</p>')).toBeLessThan(out.indexOf('<p>SECOND</p>'));
  });

  it('RED: idempotent — re-applying does not stack blocks', () => {
    const cfg = {
      blocks: [
        { html: '<p>A</p>', position: 'above-checkout' },
        { html: '<p>B</p>', position: 'bottom' },
      ],
    };
    const once = applyCustomCode(BASE_HTML, cfg);
    const twice = applyCustomCode(once, cfg);
    expect(idsOf(twice).sort()).toEqual(['ccd-custom-code', 'ccd-custom-code-1']);
  });

  it('RED: skips blocks whose html is empty / sanitizes to nothing', () => {
    const out = applyCustomCode(BASE_HTML, {
      blocks: [
        { html: '', position: 'above-checkout' },
        { html: '<p>Real</p>', position: 'bottom' },
      ],
    });
    expect(out).toContain('<p>Real</p>');
    // exactly one block rendered (the empty one is skipped)
    expect(idsOf(out).length).toBe(1);
  });

  it('RED: empty blocks array is a no-op', () => {
    const out = applyCustomCode(BASE_HTML, { blocks: [] });
    expect(out).not.toContain('ccd-custom-code');
  });
});

describe('customCode — v14 live storefront supports multiple blocks', () => {
  it('RED: injectCustomCode normalizes a blocks array (helper present in both copies)', () => {
    expect(V14_SRC).toContain('_customCodeBlocks');
    expect(V14_ROOT_SRC).toContain('_customCodeBlocks');
  });

  it('RED: injectCustomCode removes ALL prior blocks by class (not a single id)', () => {
    const fn = V14_SRC.slice(V14_SRC.indexOf('CCD.injectCustomCode = function'));
    const body = fn.slice(0, 1800);
    expect(body).toContain("querySelectorAll('.ccd-custom-code')");
  });

  it('RED: the _addonHandlers remove() clears every .ccd-custom-code block', () => {
    expect(V14_SRC).toMatch(
      /customCode\s*:\s*\{[\s\S]*?remove\s*:\s*function[\s\S]*?querySelectorAll\('\.ccd-custom-code'\)/,
    );
  });
});
