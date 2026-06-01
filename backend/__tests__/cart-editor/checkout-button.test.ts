/**
 * BLAST RADIUS MAP — Cart Editor: Checkout Button end-to-end (seed + icon + shape + custom icon)
 * Target: renderPreview checkout-button section in src/app/dashboard/cart-editor/preview-renderer.ts
 *         + CART_DEFAULTS / CHECKOUT_ICON_PATHS in src/lib/cart-editor/defaults.ts (NEW)
 *         + checkoutButtonSchema.iconCustom in src/lib/cart-editor/schema.ts
 *         + applyEditorOverrides checkout-button block in v14-complete.js (x2 copies, IDENTICAL)
 *
 * BUGS (confirmed on BOTH preview and live):
 *   #1 editor label control shows placeholder "Checkout" not the real "SECURE CHECKOUT"
 *   #2 editor icon control shows nothing (no seed) — not the real "lock"
 *   #3 changing icon does NOT change the preview — renderPreview never swaps the SVG,
 *      and v14 only sets data-icon with NO CSS rule to swap → silent no-op live too
 *   #4 no custom icon upload supported
 *   Also: radius/height modifier CSS classes (ccd-checkout-btn--soft / --h-m) DO NOT EXIST
 *         in v14 → those overrides are silent no-ops on live. Fix = inline styles in both.
 *
 * CALLERS:
 *   - preview-canvas.tsx (only direct caller of renderPreview)
 *   - checkout-button-editor.tsx (reads draft via readField; seeds from CART_DEFAULTS)
 *
 * DUPLICATED LOGIC (must stay in lockstep — preview == live mandate):
 *   - renderPreview() applies overrides to HTML string (this file's target)
 *   - v14 applyEditorOverrides() applies the SAME overrides to live DOM
 *   Both must produce the same icon / radius / height / colors / label.
 *
 * SHARED STATE:
 *   - editorOverrides JSON column (schema.ts checkoutButtonSchema is .strict())
 *   - adding iconCustom requires declaring it in the schema or PUT 400s
 *
 * CROSS-PATH RISK:
 *   - If preview swaps icon but v14 does not → preview != live (violates mandate)
 *   - If iconCustom added to editor but not schema → save rejected (strict)
 *   - LOCK: existing label override + product splicing + empty state must stay green
 */

import { describe, it, expect } from 'vitest';
import { renderPreview, type PreviewRenderInput } from '@/app/dashboard/cart-editor/preview-renderer';
import { CART_DEFAULTS, CHECKOUT_ICON_PATHS, renderCheckoutIcon, prepareUploadedSvgIcon } from '@/lib/cart-editor/defaults';
import { editorOverridesSchema } from '@/lib/cart-editor/schema';

const baseInput: PreviewRenderInput = {
  overrides: {},
  addons: {},
  previewState: 'items',
};

// ── LOCK: existing checkout-button behavior must not regress ──────────
describe('LOCK — checkout button defaults already in CONTROL_HTML', () => {
  it('default render shows the real label "SECURE CHECKOUT"', () => {
    const html = renderPreview(baseInput);
    expect(html).toContain('SECURE CHECKOUT');
  });

  it('default render shows the lock icon SVG path', () => {
    const html = renderPreview(baseInput);
    expect(html).toContain(CHECKOUT_ICON_PATHS.lock);
  });

  it('LOCK: label override still replaces SECURE CHECKOUT', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { label: 'Pay Now' } } });
    expect(html).toContain('Pay Now');
    expect(html).not.toContain('SECURE CHECKOUT');
  });
});

// ── Seeding defaults: editor must be able to read the REAL current values ──
describe('CART_DEFAULTS — seed source for editor controls (bugs #1, #2)', () => {
  it('exposes the real checkout button defaults matching CONTROL_HTML', () => {
    expect(CART_DEFAULTS.checkoutButton.label).toBe('SECURE CHECKOUT');
    expect(CART_DEFAULTS.checkoutButton.icon).toBe('lock');
    expect(CART_DEFAULTS.checkoutButton.bgColor).toBe('#111111');
    expect(CART_DEFAULTS.checkoutButton.textColor).toBe('#ffffff');
    expect(CART_DEFAULTS.checkoutButton.fontWeight).toBe(700);
    expect(CART_DEFAULTS.checkoutButton.radius).toBe('soft');
    expect(CART_DEFAULTS.checkoutButton.height).toBe('M');
  });
});

// ── Icon rendering in preview (bug #3) ────────────────────────────────
describe('renderPreview — icon override swaps the SVG (bug #3)', () => {
  it('icon=arrow renders the arrow path and drops the lock path', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { icon: 'arrow' } } });
    expect(html).toContain(CHECKOUT_ICON_PATHS.arrow);
    expect(html).not.toContain(CHECKOUT_ICON_PATHS.lock);
  });

  it('icon=cart renders the cart path and drops the lock path', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { icon: 'cart' } } });
    expect(html).toContain(CHECKOUT_ICON_PATHS.cart);
    expect(html).not.toContain(CHECKOUT_ICON_PATHS.lock);
  });

  it('icon=none removes the button SVG entirely', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { icon: 'none' } } });
    // The lock path must be gone and no checkout icon svg remains before the label.
    expect(html).not.toContain(CHECKOUT_ICON_PATHS.lock);
  });
});

// ── Custom SVG icon (feature #4) ──────────────────────────────────────
describe('renderPreview — custom SVG icon (feature #4)', () => {
  const CUSTOM = '<svg viewBox="0 0 24 24"><path d="M1 1h22v22H1z"/></svg>';

  it('renders a sanitized custom icon when iconCustom is set', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { icon: 'lock', iconCustom: CUSTOM } } as any });
    expect(html).toContain('M1 1h22v22H1z');
    // custom wins over the lock default
    expect(html).not.toContain(CHECKOUT_ICON_PATHS.lock);
  });

  it('strips <script> and on* handlers from a malicious custom svg', () => {
    const evil = '<svg onload="alert(1)"><script>alert(2)</script><path d="M2 2h4v4H2z"/></svg>';
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { icon: 'lock', iconCustom: evil } } as any });
    expect(html).toContain('M2 2h4v4H2z');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onload');
    expect(html).not.toContain('alert(');
  });

  it('icon=none ignores custom icon (no icon shown)', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { icon: 'none', iconCustom: CUSTOM } } as any });
    expect(html).not.toContain('M1 1h22v22H1z');
  });
});

// ── Shape & typography applied as INLINE styles (parity with live) ────
describe('renderPreview — shape/size/typography overrides paint the button', () => {
  it('radius=pill applies a pill border-radius inline', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { radius: 'pill' } } });
    expect(html).toMatch(/border-radius:\s*999px/);
  });

  it('bgColor + textColor applied inline', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { bgColor: '#ff0000', textColor: '#00ff00' } } });
    expect(html).toMatch(/background(-color)?:\s*#ff0000/);
    expect(html).toMatch(/color:\s*#00ff00/);
  });

  it('fontWeight + letterSpacing applied inline', () => {
    const html = renderPreview({ ...baseInput, overrides: { checkoutButton: { fontWeight: 400, letterSpacing: 3 } } });
    expect(html).toMatch(/font-weight:\s*400/);
    expect(html).toMatch(/letter-spacing:\s*3px/);
  });
});

// ── Schema accepts iconCustom (else PUT rejects it) ───────────────────
describe('schema — checkoutButton.iconCustom is accepted', () => {
  it('parses iconCustom svg string', () => {
    const parsed = editorOverridesSchema.parse({
      checkoutButton: { iconCustom: '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>' },
    });
    expect((parsed.checkoutButton as any).iconCustom).toContain('<svg');
  });

  it('renderCheckoutIcon helper returns empty for none and svg for known icons', () => {
    expect(renderCheckoutIcon('none')).toBe('');
    expect(renderCheckoutIcon('lock')).toContain(CHECKOUT_ICON_PATHS.lock);
    expect(renderCheckoutIcon('arrow')).toContain(CHECKOUT_ICON_PATHS.arrow);
  });
});

// ── EDITOR SEED + CUSTOM ICON (appended) ──
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EDITOR_SRC = readFileSync(
  resolve(__dirname, '../../src/app/dashboard/cart-editor/element-editors/checkout-button-editor.tsx'),
  'utf8',
);

describe('checkout-button-editor.tsx — seeds every control from CART_DEFAULTS (bugs #1, #2)', () => {
  it('imports CART_DEFAULTS from the shared defaults module', () => {
    expect(EDITOR_SRC).toMatch(
      /import\s*\{[^}]*CART_DEFAULTS[^}]*\}\s*from\s*['"]@\/lib\/cart-editor\/defaults['"]/,
    );
  });

  const seededFields = [
    'label', 'icon', 'bgColor', 'bgHoverColor', 'textColor',
    'radius', 'height', 'fontWeight', 'letterSpacing', 'fullWidth', 'loadingAnim',
  ];
  for (const field of seededFields) {
    it(`seeds ${field} via "?? CART_DEFAULTS.checkoutButton.${field}"`, () => {
      const re = new RegExp(
        `get<[^>]*>\\('checkoutButton\\.${field}'\\)\\s*\\?\\?\\s*CART_DEFAULTS\\.checkoutButton\\.${field}`,
      );
      expect(EDITOR_SRC).toMatch(re);
    });
  }
});

describe('checkout-button-editor.tsx — custom SVG icon upload (feature #4)', () => {
  it('binds a control to checkoutButton.iconCustom', () => {
    expect(EDITOR_SRC).toContain('checkoutButton.iconCustom');
  });
  it('persists the custom icon via setField', () => {
    expect(EDITOR_SRC).toMatch(/setField\(\s*['"]checkoutButton\.iconCustom['"]/);
  });
});

// ── Upload-from-PC (Issue #2) ─────────────────────────────────────────
// BLAST RADIUS MAP — Issue #2: "Custom icon (SVG) should allow upload from PC"
// Target: checkout-button-editor.tsx (UI) + prepareUploadedSvgIcon in defaults.ts (NEW pure helper)
// The stored value flows: iconCustom → renderCheckoutIcon → sanitizeSvgIcon (preview + v14, UNCHANGED).
// Upload mirrors paste: store raw trimmed svg text; render sanitizes. The helper only VALIDATES
// the picked file is a usable svg (rejects PNG/garbage/empty) before storing — no new render path.
describe('prepareUploadedSvgIcon — validates a file-picked svg before storing (Issue #2)', () => {
  it('returns the trimmed svg text for a valid <svg> file', () => {
    const raw = '\n  <svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>  \n';
    expect(prepareUploadedSvgIcon(raw)).toBe('<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>');
  });
  it('keeps an svg even if it carries a script (render strips it later)', () => {
    const raw = '<svg><script>alert(1)</script><path d="M2 2h4v4H2z"/></svg>';
    const out = prepareUploadedSvgIcon(raw);
    expect(out).toBe(raw);
    // and the render path still neutralizes it
    expect(renderCheckoutIcon('lock', out!)).not.toContain('<script');
  });
  it('returns null for a non-svg file (e.g. PNG bytes / plain text)', () => {
    expect(prepareUploadedSvgIcon('\x89PNG\r\n\x1a\n')).toBeNull();
    expect(prepareUploadedSvgIcon('just some text')).toBeNull();
  });
  it('returns null for empty / whitespace / non-string', () => {
    expect(prepareUploadedSvgIcon('')).toBeNull();
    expect(prepareUploadedSvgIcon('   ')).toBeNull();
    expect(prepareUploadedSvgIcon(undefined)).toBeNull();
    expect(prepareUploadedSvgIcon(123)).toBeNull();
  });
});

describe('checkout-button-editor.tsx — file upload control (Issue #2)', () => {
  it('renders a file input that accepts svg', () => {
    expect(EDITOR_SRC).toMatch(/type=["']file["']/);
    expect(EDITOR_SRC).toMatch(/accept=[^>]*svg/i);
  });
  it('reads the picked file (FileReader / readAsText / .text())', () => {
    expect(EDITOR_SRC).toMatch(/FileReader|readAsText|\.text\(\)/);
  });
  it('validates the upload through prepareUploadedSvgIcon before storing', () => {
    expect(EDITOR_SRC).toMatch(/prepareUploadedSvgIcon/);
  });
});
