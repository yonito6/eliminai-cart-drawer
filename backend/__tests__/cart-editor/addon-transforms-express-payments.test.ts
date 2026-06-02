/**
 * BLAST RADIUS MAP — Express Checkout Buttons redesign → NATIVE Shopify wallets
 *
 * USER REQUEST (2026-06-01): "redesign the express checkout buttons, only allow
 *   the ones the user's shop allows (check it) — for me I don't have Shop Pay
 *   AVAILABLE. They need to be BELOW the checkout button and WITHOUT the OR."
 *
 * DECISION (user picked "Native Shopify button"):
 *   Stop rendering FAKE styled buttons (which advertised wallets the shop may
 *   not have, e.g. Shop Pay). Instead the live storefront renders Shopify's
 *   REAL dynamic-checkout buttons via Liquid:
 *     app-embed.liquid → hidden #ccd-native-express-host inside {% form 'cart' %}
 *       {{ form | payment_button }}                  (Shop Pay — only if enabled)
 *       {{ content_for_additional_checkout_buttons }} (PayPal/Apple/Google/Amazon)
 *   Shopify only emits the wallets the shop + device actually support, so the
 *   "only allow the ones the shop allows" requirement is satisfied natively.
 *   v14 CCD.injectExpressPayments RELOCATES that hydrated host into the footer
 *   BELOW the checkout button, no separator.
 *
 * TARGET:
 *   - addon-transforms.ts → applyExpressPayments (dashboard + cart-editor preview)
 *   - v14-complete.js → CCD.injectExpressPayments (root + extension copies)
 *   - app-embed.liquid (native host)
 *
 * CALLERS / DUPLICATES (must all agree):
 *   - addon-preview.tsx ORDER[expressPayments] + focused block → applyExpressPayments
 *   - cart-editor/preview-renderer.ts → applyExpressPayments
 *   - express-payments-addon-editor.tsx (config shape: { position })
 *
 * PREVIEW (2026-06-02 user request "I want to see how it actually looks"): the
 *   dashboard has no Shopify SDK so it cannot render REAL wallet buttons. Instead
 *   of a bare text note, the preview now renders REPRESENTATIVE example wallet
 *   buttons (Shop Pay / PayPal / Apple Pay / Google Pay) so the merchant can see
 *   the layout + spacing. The LIVE storefront (v14) is UNCHANGED — still native,
 *   never fake buttons.
 *
 * CAPTION REMOVED (2026-06-02 user request "I dont want the 'Example preview —
 *   your live store shows only the wallets your Shopify checkout supports.'"): the
 *   honesty caption is GONE. The preview now shows ONLY the example wallet buttons,
 *   no explanatory caption text underneath. applyExpressPayments must never emit
 *   `ccd-express__example-caption` or the "Example preview"/"only the wallets" copy.
 *
 * CROSS-PATH RISK: if v14 keeps building fake buttons but the editor/definitions
 *   drop providers → divergence. Fix touches all copies + both v14 files.
 */

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyExpressPayments } from '@/app/dashboard/addons/addon-transforms';

function makeCartHtml(): string {
  return [
    '<div class="ccd-sticky-footer">',
    '<button type="button" class="ccd-checkout-btn">Checkout</button>',
    '<div class="ccd-trust">trust</div>',
    '</div>\n</div>',
  ].join('');
}

describe('applyExpressPayments — PREVIEW (representative example wallet buttons)', () => {
  it('does not throw regardless of config', () => {
    expect(() => applyExpressPayments(makeCartHtml(), {})).not.toThrow();
    expect(() => applyExpressPayments(makeCartHtml(), { position: 'below' })).not.toThrow();
    // legacy stored config with providers/separator must be tolerated + ignored
    expect(() =>
      applyExpressPayments(makeCartHtml(), {
        providers: { shopPay: true },
        separatorLabel: 'or',
        layout: 'row',
      }),
    ).not.toThrow();
  });

  it('renders representative example wallet buttons so the merchant sees the layout', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    expect(out).toContain('id="ccd-express-payments"');
    expect(out).toContain('ccd-express--native');
    // example wallet buttons (preview only — clearly labelled as examples)
    expect(out).toContain('ccd-express__example');
    expect(out).toContain('Shop Pay');
    expect(out).toContain('PayPal');
    expect(out).toContain('Apple Pay');
    expect(out).toContain('Google Pay');
  });

  it('RED: renders the example wallets STACKED full-width (mirrors Shopify native layout)', () => {
    // The live store renders Shopify's native wallet buttons full-width, stacked
    // vertically (not side-by-side). The preview must mirror that so the merchant
    // sees how it will REALLY look.
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    // container stacks vertically…
    expect(out).toMatch(/ccd-express__example-row"[^>]*style="[^"]*flex-direction:\s*column/);
    // …and each example button is full-width (not flex:1 columns).
    const firstBtn = out.slice(out.indexOf('class="ccd-express__example"'));
    expect(firstBtn).toMatch(/^class="ccd-express__example"[^>]*style="[^"]*width:\s*100%/);
  });

  it('RED: shows NO caption — user removed the "Example preview" honesty text', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    // The caption div + its copy must be entirely gone.
    expect(out).not.toContain('ccd-express__example-caption');
    expect(out.toLowerCase()).not.toContain('only the wallets');
    expect(out.toLowerCase()).not.toContain('example preview');
    // …but the example wallet buttons themselves must still render.
    expect(out).toContain('ccd-express__example');
  });

  it('does NOT use the old fake-button class names or redirect behavior', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    expect(out).not.toContain('ccd-express__btn--shopPay');
    expect(out).not.toContain('ccd-express__btn--paypal');
    expect(out).not.toContain('data-provider=');
    expect(out).not.toContain('/checkout?payment=');
  });

  it('NEVER renders an "or" separator (user asked to remove it)', () => {
    const out = applyExpressPayments(makeCartHtml(), { separatorLabel: 'or' });
    expect(out).not.toContain('ccd-express__separator');
    expect(out).not.toContain('>or<');
  });

  it('defaults to BELOW the checkout button', () => {
    const out = applyExpressPayments(makeCartHtml(), {});
    const wrapIdx = out.indexOf('id="ccd-express-payments"');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(wrapIdx).toBeGreaterThan(-1);
    expect(wrapIdx).toBeGreaterThan(checkoutIdx);
    expect(out).toContain('ccd-express--below');
  });

  it('RED: places wallets DIRECTLY below the checkout button, above the returns line (.ccd-trust)', () => {
    // User report (2026-06-02, revised): the express wallets must sit DIRECTLY
    // under the checkout button — not after the returns line.
    // Order must be: checkout -> express wallets -> .ccd-trust(returns).
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    const wrapIdx = out.indexOf('id="ccd-express-payments"');
    const trustIdx = out.indexOf('class="ccd-trust"');
    expect(checkoutIdx).toBeGreaterThan(-1);
    expect(wrapIdx).toBeGreaterThan(-1);
    expect(trustIdx).toBeGreaterThan(-1);
    // wallets come straight after the checkout button…
    expect(wrapIdx).toBeGreaterThan(checkoutIdx);
    // …and BEFORE the returns line (returns line stays below the wallets).
    expect(wrapIdx).toBeLessThan(trustIdx);
  });

  it('RED: preview wrap carries an inline margin so wallets do not touch the checkout button', () => {
    // The dashboard preview iframe does NOT load v14 CSS, so the margin must be
    // inline on the wrapper (below → margin-top, above → margin-bottom).
    const below = applyExpressPayments(makeCartHtml(), { position: 'below' });
    expect(below).toMatch(/id="ccd-express-payments"[^>]*style="[^"]*margin-top:\s*12px/);
    const above = applyExpressPayments(makeCartHtml(), { position: 'above' });
    expect(above).toMatch(/id="ccd-express-payments"[^>]*style="[^"]*margin-bottom:\s*12px/);
  });

  it('honors position="above" if explicitly stored', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'above' });
    const wrapIdx = out.indexOf('id="ccd-express-payments"');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(wrapIdx).toBeLessThan(checkoutIdx);
    expect(out).toContain('ccd-express--above');
  });

  it('is idempotent — re-applying does not stack wrappers', () => {
    let out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    out = applyExpressPayments(out, { position: 'below' });
    const matches = out.match(/id="ccd-express-payments"/g) || [];
    expect(matches.length).toBe(1);
  });

  it('no-op when there is no checkout button', () => {
    const out = applyExpressPayments('<div class="ccd-sticky-footer"></div>', { position: 'below' });
    expect(out).not.toContain('ccd-express-payments');
  });
});

describe('v14 CCD.injectExpressPayments — NATIVE relocation contract (LOCK)', () => {
  const v14 = readFileSync(
    resolve(__dirname, '../../../extensions/cart-drawer/assets/v14-complete.js'),
    'utf8',
  );

  it('relocates the native host instead of building fake provider buttons', () => {
    expect(v14).toContain('ccd-native-express-host');
    // the fake provider catalogue must be gone
    expect(v14).not.toContain('_EXPRESS_PROVIDERS');
  });

  it('does not redirect to /checkout?payment= (fake button behavior removed)', () => {
    expect(v14).not.toContain('/checkout?payment=');
  });

  it('marks the relocated wrapper as native', () => {
    expect(v14).toContain('ccd-express--native');
  });

  it('RED: relocates the native host DIRECTLY below the checkout button, not anchored to the returns line', () => {
    // Cross-path of the preview fix: on the live storefront the express wallets
    // must sit DIRECTLY after the checkout button (checkoutBtn.nextSibling), not
    // after/relative to the .ccd-trust returns line.
    expect(v14).toContain('checkoutBtn.nextSibling');
    expect(v14).not.toMatch(/insertBefore\(\s*wrap\s*,\s*trust\.nextSibling\s*\)/);
    expect(v14).not.toMatch(/insertBefore\(\s*wrap\s*,\s*trust\s*\)/);
  });
});

describe('app-embed.liquid — native host rendered from Liquid', () => {
  const embed = readFileSync(
    resolve(__dirname, '../../../extensions/cart-drawer/blocks/app-embed.liquid'),
    'utf8',
  );

  it('renders the native host inside a cart form', () => {
    expect(embed).toContain('ccd-native-express-host');
    expect(embed).toContain('content_for_additional_checkout_buttons');
    expect(embed).toMatch(/form ['"]cart['"]/);
  });
});

describe('CSS — no FAKE-button styling, but wrapper carries spacing so it does not touch checkout', () => {
  const v14 = readFileSync(
    resolve(__dirname, '../../../extensions/cart-drawer/assets/v14-complete.js'),
    'utf8',
  );

  it('v14 has NO fake per-wallet button styling (.ccd-express__btn)', () => {
    // The native redesign removed the fake brand buttons; their CSS must stay gone.
    expect(v14).not.toMatch(/\.ccd-express__btn\s*\{/);
    expect(v14).not.toMatch(/\.ccd-express__separator\s*\{/);
  });

  it('v14 gives the express wrapper a margin so it does NOT touch the checkout button', () => {
    // User report (2026-06-02): native express buttons sat flush against the
    // checkout button with no gap. The wrapper must carry a margin toward it.
    expect(v14).toMatch(/\.ccd-express--below\s*\{[^}]*margin-top\s*:\s*\d+px/);
    expect(v14).toMatch(/\.ccd-express--above\s*\{[^}]*margin-bottom\s*:\s*\d+px/);
  });
});

/**
 * BLAST RADIUS MAP — per-wallet HIDE toggles (config.hiddenWallets)
 *
 * USER REQUEST (2026-06-02): merchant uses STRIPE (not Shopify Payments) so the
 *   wallet set cannot be controlled server-side. Add Show/Hide checkboxes per
 *   wallet (Shop Pay / Apple Pay / Google Pay / PayPal). Hidden wallets stored in
 *   config.hiddenWallets:string[] using camelCase keys
 *   ('shopPay'|'applePay'|'googlePay'|'paypal').
 *
 * TARGET / PATHS (all must agree):
 *   - addon-transforms.ts applyExpressPayments — PREVIEW: tag each example button
 *       with data-wallet and DROP the ones in hiddenWallets so the merchant sees
 *       the effect.
 *   - v14-complete.js CCD.injectExpressPayments (root + extension copies) — LIVE:
 *       inject a <style id="ccd-express-hide-style"> with display:none!important
 *       rules scoped to #ccd-native-express-host for each hidden wallet
 *       (best-effort selectors).
 *   - express-payments-addon-editor.tsx — UI: 4 Show/Hide checkboxes →
 *       config.hiddenWallets; buildPayload MUST include hiddenWallets.
 *
 * PERSISTENCE: addons route merges config as freeform JSON (no schema strip), so
 *   hiddenWallets survives. page.tsx express wiring is generic. No change there.
 *
 * CROSS-PATH RISK:
 *   - preview drops buttons / live hides via CSS — different mechanisms, same
 *     config. Lock both.
 *   - two v14 copies must carry IDENTICAL hide logic (lock equivalence).
 *   - PAYPAL CAVEAT: PayPal renders inside a cross-origin iframe. We can only hide
 *     its container element from the parent page; if PayPal's wrapper isn't one of
 *     our selectors, CSS cannot reach inside the iframe. Editor must warn the user.
 */

const WALLET_KEYS = ['shopPay', 'applePay', 'googlePay', 'paypal'] as const;

describe('applyExpressPayments — per-wallet HIDE toggles (hiddenWallets)', () => {
  it('LOCK: with no hiddenWallets, all four example wallets still render', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    expect(out).toContain('Shop Pay');
    expect(out).toContain('PayPal');
    expect(out).toContain('Apple Pay');
    expect(out).toContain('Google Pay');
  });

  it('LOCK: tolerates hiddenWallets being absent / null / non-array', () => {
    expect(() => applyExpressPayments(makeCartHtml(), {})).not.toThrow();
    expect(() => applyExpressPayments(makeCartHtml(), { hiddenWallets: null })).not.toThrow();
    expect(() => applyExpressPayments(makeCartHtml(), { hiddenWallets: 'shopPay' })).not.toThrow();
    // a non-array value must NOT accidentally hide anything
    const out = applyExpressPayments(makeCartHtml(), { hiddenWallets: 'shopPay' });
    expect(out).toContain('Shop Pay');
  });

  it('RED: tags each example wallet with a data-wallet key', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    for (const k of WALLET_KEYS) {
      expect(out).toContain(`data-wallet="${k}"`);
    }
  });

  it('RED: hiddenWallets:["shopPay"] drops ONLY the Shop Pay example', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'below', hiddenWallets: ['shopPay'] });
    expect(out).not.toContain('data-wallet="shopPay"');
    expect(out).not.toContain('Shop Pay');
    // the other three remain
    expect(out).toContain('data-wallet="applePay"');
    expect(out).toContain('data-wallet="googlePay"');
    expect(out).toContain('data-wallet="paypal"');
  });

  it('RED: hiding all four leaves the wrapper but no example buttons', () => {
    const out = applyExpressPayments(makeCartHtml(), {
      position: 'below',
      hiddenWallets: ['shopPay', 'applePay', 'googlePay', 'paypal'],
    });
    expect(out).toContain('id="ccd-express-payments"');
    expect(out).not.toContain('ccd-express__example"');
    expect(out).not.toContain('data-wallet=');
  });
});

describe('v14 CCD.injectExpressPayments — per-wallet hide CSS (hiddenWallets)', () => {
  const extV14 = readFileSync(
    resolve(__dirname, '../../../extensions/cart-drawer/assets/v14-complete.js'),
    'utf8',
  );
  const rootV14 = readFileSync(
    resolve(__dirname, '../../../v14-complete.js'),
    'utf8',
  );

  it('RED: reads cfg.hiddenWallets and injects display:none scoped to the native host', () => {
    expect(extV14).toContain('hiddenWallets');
    expect(extV14).toContain('ccd-express-hide-style');
    // hide CSS must be scoped to the native host and use display:none !important
    expect(extV14).toMatch(/#ccd-native-express-host/);
    expect(extV14).toMatch(/display\s*:\s*none\s*!important/);
  });

  it('RED: has best-effort selectors for each wallet (incl. PayPal iframe container)', () => {
    expect(extV14).toContain('shop-pay-button');
    expect(extV14).toContain('Apple Pay');
    expect(extV14).toContain('Google Pay');
    expect(extV14).toContain('PayPal');
    // PayPal lives in a cross-origin iframe — we target its container instead.
    expect(extV14).toContain('paypal-buttons');
  });

  it('LOCK: root and extension v14 carry IDENTICAL hide logic (copies stay in sync)', () => {
    // Both copies must contain the same wallet-selector + hide-style markers, or
    // one storefront build would silently ignore hiddenWallets.
    for (const marker of ['hiddenWallets', 'ccd-express-hide-style', 'paypal-buttons', 'shop-pay-button']) {
      expect(rootV14.includes(marker)).toBe(true);
      expect(extV14.includes(marker)).toBe(true);
    }
  });
});

describe('express-payments-addon-editor — Show/Hide checkboxes (static analysis)', () => {
  const editor = readFileSync(
    resolve(__dirname, '../../src/app/dashboard/addons/express-payments-addon-editor.tsx'),
    'utf8',
  );

  it('RED: exposes a Show/Hide control per wallet', () => {
    for (const k of WALLET_KEYS) {
      expect(editor).toContain(`'${k}'`);
    }
  });

  it('RED: includes hiddenWallets in the saved payload (buildPayload)', () => {
    expect(editor).toMatch(/hiddenWallets/);
    // buildPayload must emit hiddenWallets, not just position
    expect(editor).toMatch(/buildPayload[\s\S]*hiddenWallets/);
  });

  it('RED: warns that PayPal may not hide because it renders in an iframe', () => {
    expect(editor.toLowerCase()).toContain('iframe');
    expect(editor).toContain('PayPal');
  });
});
