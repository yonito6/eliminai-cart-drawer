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
 * PREVIEW LIMITATION: the dashboard has no Shopify SDK, so the preview CANNOT
 *   render real wallet buttons. It renders an honest placeholder note instead of
 *   fake brand buttons. This is MORE faithful than before (the old fake buttons
 *   showed Shop Pay even when the shop had none).
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

describe('applyExpressPayments — NATIVE preview (no fake brand buttons)', () => {
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

  it('renders a native express wrapper, NOT fake per-wallet buttons', () => {
    const out = applyExpressPayments(makeCartHtml(), { position: 'below' });
    expect(out).toContain('id="ccd-express-payments"');
    expect(out).toContain('ccd-express--native');
    // NO fake brand buttons anymore
    expect(out).not.toContain('ccd-express__btn--shopPay');
    expect(out).not.toContain('ccd-express__btn--paypal');
    expect(out).not.toContain('data-provider=');
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

describe('CSS parity — REAL_CART_CSS must NOT add .ccd-express rules (v14 has none)', () => {
  it('v14 stylesheet has no .ccd-express selector block', () => {
    const v14 = readFileSync(
      resolve(__dirname, '../../../extensions/cart-drawer/assets/v14-complete.js'),
      'utf8',
    );
    expect(v14).not.toMatch(/\.ccd-express\s*\{/);
    expect(v14).not.toMatch(/\.ccd-express__btn\s*\{/);
  });
});
