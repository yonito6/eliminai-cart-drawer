// @vitest-environment jsdom
/**
 * BLAST RADIUS MAP — Issue #4 follow-up: kill the duplicate returns line +
 * make the seeded Custom HTML editable from the cart editor.
 *
 * USER REPORT (#3):
 *   "it still appears 2 times in the cart preview, and I dont see it as
 *    'custom html' code by the user in the cart editor neither I Cant edit it"
 *
 * ROOT CAUSE:
 *   - The built-in returns line (.ccd-trust) ALWAYS renders, and the merchant's
 *     returns badge was ALSO seeded into the customCode addon → it shows twice.
 *   - customCode is editable in the Addons tab but has NO cart-editor hotspot,
 *     so clicking it in the preview falls through to footer/global and the
 *     merchant can't reach its editor from the cart editor.
 *
 * FIX (two parts, behind a default-OFF flag so zero regression for every other
 * store):
 *   1. New addon-config flag `customCode.config.hideBuiltInTrustLine` (default
 *      false). When true, the built-in returns line is removed so the seeded
 *      customCode copy is the ONLY one shown.
 *        - CONTROL_HTML paths (preview-renderer.ts, addon-preview.tsx) strip the
 *          WHOLE `.ccd-trust` (it is the returns line only; payment badges are a
 *          SEPARATE `.ccd-trust-badges` element → preserved).
 *        - v14-complete.js (BOTH copies) strips ONLY `.ccd-trust__line` because
 *          there the payment badges (`.ccd-trust__badges`) are NESTED inside
 *          `.ccd-trust` and must survive.
 *   2. New `addon.customCode` deep-link hotspot (selector `#ccd-custom-code,
 *      .ccd-custom-code`, target deep-link, ordered BEFORE footer/global) +
 *      matching ELEMENT_EDITORS entry → AddonDeepLink addonKey="customCode".
 *
 * TARGET (NEW/changed code):
 *   - addon-transforms.ts        → new pure `hideBuiltInTrustLine(html)`
 *   - addon-definitions.ts       → customCode gains `hideBuiltInTrustLine`
 *   - cart-editor/preview-renderer.ts → strip when flag set (CONTROL_HTML path)
 *   - addons/addon-preview.tsx        → strip when flag set (CONTROL_HTML path)
 *   - cart-editor/overlay/hotspots.ts → addon.customCode hotspot
 *   - cart-editor/page.tsx            → addon.customCode ELEMENT_EDITORS entry
 *   - v14-complete.js (BOTH copies)   → injectCustomCode removes .ccd-trust__line
 *
 * CALLERS / PATHS THAT MUST AGREE:
 *   - renderPreview (cart-editor preview)  ↔ addon-preview (Addons-tab preview)
 *     ↔ CCD.injectCustomCode (live storefront): all three must drop the built-in
 *     returns line when the flag is set, and all three must keep payment badges.
 *   - HOTSPOTS ↔ ELEMENT_EDITORS: every hotspot id must have an editor entry.
 *
 * SHARED STATE:
 *   - addons.customCode.config (read by all 3 render paths). The flag MUST live
 *     here, NOT in editorOverrides, because addon-preview consumes ONLY the
 *     addons map (no editorOverrides) — an editorOverrides flag would break
 *     cross-path parity.
 *
 * CROSS-PATH RISK:
 *   - Flag honored in one preview but not the other → dashboard ≠ cart-editor.
 *   - v14 strips whole `.ccd-trust` → payment badges vanish on the live cart.
 *   - New hotspot ordered AFTER footer → click resolves to footer, not addon.
 *   - hotspot added but ELEMENT_EDITORS entry missing → "not implemented yet".
 *   - Default not OFF → every existing store loses its returns line.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyCustomCode,
  hideBuiltInTrustLine,
} from '@/app/dashboard/addons/addon-transforms';
import { renderPreview } from '@/app/dashboard/cart-editor/preview-renderer';
import {
  HOTSPOTS,
  findHotspotElement,
  resolveHotspotFromPoint,
} from '@/app/dashboard/cart-editor/overlay/hotspots';
import { getAddonDefinition } from '@/lib/addon-definitions';

const V14_PATH = join(process.cwd(), '..', 'extensions', 'cart-drawer', 'assets', 'v14-complete.js');
const V14_ROOT_PATH = join(process.cwd(), '..', 'v14-complete.js');
const V14_SRC = readFileSync(V14_PATH, 'utf-8');
const V14_ROOT_SRC = readFileSync(V14_ROOT_PATH, 'utf-8');
const PAGE_SRC = readFileSync(
  join(process.cwd(), 'src', 'app', 'dashboard', 'cart-editor', 'page.tsx'),
  'utf-8',
);

const RETURNS_HTML =
  '<div style="display:flex;align-items:center;justify-content:center;gap:8px">' +
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="#6BA4E8"><path d="M12 5V2L8 6l4 4V7z"></path></svg>' +
  '<span><strong>30 day</strong> risk free returns</span></div>';

// ── LOCK: existing behavior must not regress ─────────────────────────
describe('LOCK — built-in trust line renders by default (no flag)', () => {
  it('LOCK: renderPreview keeps the built-in .ccd-trust returns line when customCode has NO hide flag', () => {
    const out = renderPreview({
      overrides: {},
      addons: { customCode: { enabled: true, config: { html: RETURNS_HTML } } },
      previewState: 'items',
    });
    // Built-in returns line still present...
    expect(out).toContain('class="ccd-trust"');
    expect(out).toContain('risk free returns');
    // ...and the seeded customCode block also rendered (the duplicate scenario).
    expect(out).toContain('id="ccd-custom-code"');
  });

  it('LOCK: renderPreview with NO addons still renders the built-in .ccd-trust', () => {
    const out = renderPreview({ overrides: {}, previewState: 'items' });
    expect(out).toContain('class="ccd-trust"');
  });

  it('LOCK: applyCustomCode above-checkout placement unchanged', () => {
    const BASE =
      '<div class="ccd-sticky-footer">' +
      '<button type="button" class="ccd-checkout-btn">Checkout</button>' +
      '<div class="ccd-trust">Trust</div>' +
      '</div>\n</div>';
    const out = applyCustomCode(BASE, { html: '<p>x</p>' });
    expect(out).toContain('id="ccd-custom-code"');
    expect(out.indexOf('ccd-custom-code')).toBeLessThan(out.indexOf('ccd-checkout-btn'));
  });
});

describe('LOCK — existing hotspots + trustLine still resolve', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="preview-host">
      <div id="CartDrawer">
        <div class="ccd-sticky-footer">
          <div id="ccd-custom-code" class="ccd-custom-code ccd-custom-code--above-checkout">${RETURNS_HTML}</div>
          <button type="button" class="ccd-checkout-btn">go</button>
          <div class="ccd-trust"><span>30 day risk free returns</span></div>
        </div>
      </div>
    </div>`;
  });

  it('LOCK: trustLine still resolves to .ccd-trust', () => {
    const root = document.getElementById('preview-host') as HTMLElement;
    const el = findHotspotElement(root, 'trustLine');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('ccd-trust')).toBe(true);
  });

  it('LOCK: footer still resolves to .ccd-sticky-footer', () => {
    const root = document.getElementById('preview-host') as HTMLElement;
    const el = findHotspotElement(root, 'footer');
    expect(el!.classList.contains('ccd-sticky-footer')).toBe(true);
  });

  it('LOCK: every deep-link hotspot id starts with "addon."', () => {
    for (const hs of HOTSPOTS) {
      if (hs.target === 'deep-link') expect(hs.id.startsWith('addon.')).toBe(true);
    }
  });
});

describe('LOCK — v14 payment-badge markup still exists (must survive the hide)', () => {
  it('LOCK: both v14 copies still build .ccd-trust__badges', () => {
    expect(V14_SRC).toContain("'ccd-trust__badges'".replace(/'/g, ''));
    expect(V14_SRC).toContain('ccd-trust__badges');
    expect(V14_ROOT_SRC).toContain('ccd-trust__badges');
  });
});

// ── RED: pure hideBuiltInTrustLine transform ─────────────────────────
describe('hideBuiltInTrustLine — strips ONLY the built-in returns line', () => {
  const FOOTER =
    '<div class="ccd-sticky-footer">' +
    '<button type="button" class="ccd-checkout-btn">Checkout</button>' +
    '<div class="ccd-trust">\n  <svg viewBox="0 0 24 24"><path d="M1"></path></svg>\n  <span><strong>30 day</strong> risk free returns</span>\n</div>' +
    '<div id="ccd-trust-badges" class="ccd-trust-badges"><img src="visa.png" alt="visa"></div>' +
    '</div>';

  it('removes the .ccd-trust returns line', () => {
    const out = hideBuiltInTrustLine(FOOTER);
    expect(out).not.toContain('class="ccd-trust"');
    expect(out).not.toContain('risk free returns');
  });

  it('preserves the separate .ccd-trust-badges element', () => {
    const out = hideBuiltInTrustLine(FOOTER);
    expect(out).toContain('class="ccd-trust-badges"');
    expect(out).toContain('visa.png');
  });

  it('preserves the checkout button', () => {
    const out = hideBuiltInTrustLine(FOOTER);
    expect(out).toContain('ccd-checkout-btn');
  });

  it('is a no-op when there is no .ccd-trust line', () => {
    const noTrust = '<div class="ccd-sticky-footer"><button class="ccd-checkout-btn">x</button></div>';
    expect(hideBuiltInTrustLine(noTrust)).toBe(noTrust);
  });
});

// ── RED: renderPreview honors the flag ───────────────────────────────
describe('renderPreview — hideBuiltInTrustLine flag removes the duplicate', () => {
  it('drops the built-in returns line when customCode.config.hideBuiltInTrustLine = true', () => {
    const out = renderPreview({
      overrides: {},
      addons: {
        customCode: { enabled: true, config: { html: RETURNS_HTML, hideBuiltInTrustLine: true } },
      },
      previewState: 'items',
    });
    // The seeded customCode copy is the ONLY returns line now.
    expect(out).toContain('id="ccd-custom-code"');
    expect(out).not.toContain('class="ccd-trust"');
    // Exactly one "risk free returns" occurrence (the customCode one).
    const count = (out.match(/risk free returns/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('does NOT drop the returns line when flag is absent (default OFF)', () => {
    const out = renderPreview({
      overrides: {},
      addons: { customCode: { enabled: true, config: { html: RETURNS_HTML } } },
      previewState: 'items',
    });
    expect(out).toContain('class="ccd-trust"');
  });

  it('does NOT drop the returns line when customCode is disabled even if flag is set', () => {
    const out = renderPreview({
      overrides: {},
      addons: {
        customCode: { enabled: false, config: { html: RETURNS_HTML, hideBuiltInTrustLine: true } },
      },
      previewState: 'items',
    });
    expect(out).toContain('class="ccd-trust"');
  });
});

// ── RED: addon definition gains the flag ─────────────────────────────
describe('customCode addon definition — hideBuiltInTrustLine dimension', () => {
  it('has a hideBuiltInTrustLine toggle dimension defaulting to false', () => {
    const def = getAddonDefinition('customCode')!;
    const dim = def.dimensions.find((d) => d.key === 'hideBuiltInTrustLine');
    expect(dim).toBeDefined();
    expect(dim!.type).toBe('toggle');
    expect(dim!.default).toBe(false);
  });

  it('defaultConfig.hideBuiltInTrustLine is false (new stores keep their built-in line)', () => {
    const def = getAddonDefinition('customCode')!;
    expect((def.defaultConfig as Record<string, unknown>).hideBuiltInTrustLine).toBe(false);
  });
});

// ── RED: addon.customCode cart-editor hotspot ────────────────────────
describe('addon.customCode hotspot — makes Custom HTML editable from the cart editor', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="preview-host">
      <div id="CartDrawer">
        <div class="ccd-sticky-footer">
          <div id="ccd-custom-code" class="ccd-custom-code ccd-custom-code--above-checkout">
            <span><strong>30 day</strong> risk free returns</span>
          </div>
          <button type="button" class="ccd-checkout-btn">go</button>
        </div>
      </div>
    </div>`;
  });

  it('exists in HOTSPOTS, target deep-link, selector includes #ccd-custom-code', () => {
    const hs = HOTSPOTS.find((h) => h.id === 'addon.customCode');
    expect(hs).toBeDefined();
    expect(hs!.target).toBe('deep-link');
    expect(hs!.selector).toContain('#ccd-custom-code');
  });

  it('is ordered before footer and global', () => {
    const order = HOTSPOTS.map((h) => h.id);
    const idx = order.indexOf('addon.customCode' as never);
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(order.indexOf('footer' as never));
    expect(idx).toBeLessThan(order.indexOf('global' as never));
  });

  it('findHotspotElement resolves to the #ccd-custom-code block', () => {
    const root = document.getElementById('preview-host') as HTMLElement;
    const el = findHotspotElement(root, 'addon.customCode');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('ccd-custom-code');
  });

  it('clicking inside the custom-code block resolves to addon.customCode (NOT footer)', () => {
    const root = document.getElementById('preview-host') as HTMLElement;
    const inner = root.querySelector('#ccd-custom-code span') as HTMLElement;
    const orig = document.elementsFromPoint;
    (document as any).elementsFromPoint = () => [inner, inner.parentElement!, root];
    try {
      const hs = resolveHotspotFromPoint(root, { x: 0, y: 0 });
      expect(hs!.id).toBe('addon.customCode');
      expect(hs!.id).not.toBe('footer');
      expect(hs!.id).not.toBe('global');
    } finally {
      (document as any).elementsFromPoint = orig;
    }
  });

  it('cart-editor page wires addon.customCode → AddonDeepLink addonKey="customCode"', () => {
    expect(PAGE_SRC).toContain("'addon.customCode'");
    // The deep-link card for customCode must reference the addon key.
    const idx = PAGE_SRC.indexOf("'addon.customCode'");
    const slice = PAGE_SRC.slice(idx, idx + 400);
    expect(slice).toContain('addonKey="customCode"');
  });
});

// ── RED: v14 live storefront removes ONLY .ccd-trust__line ───────────
describe('v14 injectCustomCode — hide flag drops .ccd-trust__line, keeps __badges', () => {
  it('both v14 copies reference hideBuiltInTrustLine inside injectCustomCode', () => {
    for (const src of [V14_SRC, V14_ROOT_SRC]) {
      const start = src.indexOf('CCD.injectCustomCode = function');
      expect(start).toBeGreaterThan(-1);
      const body = src.slice(start, start + 900);
      expect(body).toContain('hideBuiltInTrustLine');
      // Removes the returns line only — by its dedicated nested class.
      expect(body).toContain('.ccd-trust__line');
      // Must NOT remove the badges container.
      expect(body).not.toContain('.ccd-trust__badges');
    }
  });

  it('the two v14 copies stay byte-identical around injectCustomCode', () => {
    const a = V14_SRC.indexOf('CCD.injectCustomCode = function');
    const b = V14_ROOT_SRC.indexOf('CCD.injectCustomCode = function');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
    expect(V14_SRC.slice(a, a + 900)).toBe(V14_ROOT_SRC.slice(b, b + 900));
  });
});
