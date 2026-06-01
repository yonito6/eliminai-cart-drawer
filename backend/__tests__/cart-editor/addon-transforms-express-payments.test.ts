/**
 * BLAST RADIUS MAP — Issue #3: "providers.map is not a function" crash + diverged preview
 *
 * USER REPORT (2026-06-01): "I enabled the expressPayments and it says:
 *   Dashboard Error / providers.map is not a function"
 *
 * ROOT CAUSE:
 *   The dashboard express-payments preview was written against a COMPLETELY
 *   different config shape than the live storefront (v14-complete.js
 *   CCD.injectExpressPayments, the SINGLE SOURCE OF TRUTH):
 *     - live: providers is an OBJECT { shopPay:true, googlePay:true, ... }
 *       (camelCase keys, from addon-definitions.ts defaultConfig)
 *     - dashboard preview/transform: expected an ARRAY of kebab-case strings
 *       ['apple-pay','google-pay','shop-pay'] → `.map` crashes on the object,
 *       and even the transform's Array.isArray fallback renders the WRONG
 *       buttons (default array) ignoring the user's object entirely.
 *
 * SOURCE OF TRUTH — v14 CCD.injectExpressPayments (extensions/.../v14-complete.js):
 *   _EXPRESS_PROVIDERS = [
 *     {key:'shopPay',  label:'Shop Pay',  bg:'#5a31f4', fg:'#ffffff'},
 *     {key:'googlePay',label:'Google Pay',bg:'#000000', fg:'#ffffff'},
 *     {key:'paypal',   label:'PayPal',    bg:'#ffc439', fg:'#003087'},
 *     {key:'applePay', label:'Apple Pay', bg:'#000000', fg:'#ffffff'},
 *     {key:'amazonPay',label:'Amazon Pay',bg:'#ff9900', fg:'#000000'},
 *     {key:'metaPay',  label:'Meta Pay',  bg:'#0866ff', fg:'#ffffff'}
 *   ]
 *   providers = cfg.providers || {}            (OBJECT, camelCase)
 *   position  = cfg.position==='below'?'below':'above'   (default above)
 *   layout    = cfg.layout==='row'?'row':'stacked'        (default stacked)
 *   separatorLabel = string (default '')
 *   wrap   id=ccd-express-payments  class="ccd-express ccd-express--{position} ccd-express--{layout}"
 *   btnRow class="ccd-express__buttons ccd-express__buttons--{layout}"
 *   btn    class="ccd-express__btn ccd-express__btn--{key}" data-provider=key
 *          style --ccd-ep-bg/--ccd-ep-fg + background:var(--ccd-ep-bg);color:var(--ccd-ep-fg)
 *          textContent = label
 *   sep    class="ccd-express__separator" textContent=separatorLabel
 *   above: footer.insertBefore(wrap, checkoutBtn); insertBefore(sep, checkoutBtn)
 *          → order: wrap, sep, checkoutBtn
 *   below: insert after checkoutBtn → order: checkoutBtn, sep, wrap
 *   NOTE: v14 has NO .ccd-express CSS — styling is inline + class-only.
 *         REAL_CART_CSS must therefore NOT add .ccd-express rules (parity).
 *
 * TARGET: backend/src/app/dashboard/addons/addon-transforms.ts → applyExpressPayments
 *
 * CALLERS / DUPLICATES (all must agree with v14):
 *   - addon-preview.tsx pipeline ORDER[expressPayments] (line ~254) — currently
 *     guarded by Array.isArray(c.providers) → SKIPS object → never renders.
 *   - addon-preview.tsx focused block (line ~818-848) — duplicated diverged copy,
 *     calls providers.map → CRASH on object.
 *
 * SHARED STATE: Store.config.addons.expressPayments.config (providers object).
 *
 * CROSS-PATH RISK:
 *   - If transform mirrors v14 but preview block keeps its own copy → preview
 *     still crashes. Fix MUST delegate both preview paths to applyExpressPayments.
 */

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

const DEFAULT_PROVIDERS = {
  shopPay: true,
  googlePay: true,
  paypal: true,
  applePay: true,
  amazonPay: false,
  metaPay: false,
};

describe('applyExpressPayments — does not crash on object providers (RED for #3)', () => {
  it('accepts providers as an OBJECT without throwing', () => {
    expect(() => applyExpressPayments(makeCartHtml(), { providers: DEFAULT_PROVIDERS })).not.toThrow();
  });

  it('renders only the enabled providers as ccd-express__btn--<camelKey>', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: DEFAULT_PROVIDERS });
    // enabled
    expect(out).toContain('ccd-express__btn--shopPay');
    expect(out).toContain('ccd-express__btn--googlePay');
    expect(out).toContain('ccd-express__btn--paypal');
    expect(out).toContain('ccd-express__btn--applePay');
    // disabled
    expect(out).not.toContain('ccd-express__btn--amazonPay');
    expect(out).not.toContain('ccd-express__btn--metaPay');
    // never the old kebab-case button shape
    expect(out).not.toContain('apple-pay');
    expect(out).not.toContain('google-pay');
  });
});

describe('applyExpressPayments — mirrors v14 contract (LOCK)', () => {
  it('wrap has the ccd-express + position + layout classes (defaults: above + stacked)', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: true } });
    expect(out).toMatch(/id="ccd-express-payments"/);
    expect(out).toContain('ccd-express ccd-express--above ccd-express--stacked');
    expect(out).toContain('ccd-express__buttons ccd-express__buttons--stacked');
  });

  it('row layout reflected in classes', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: true }, layout: 'row' });
    expect(out).toContain('ccd-express--row');
    expect(out).toContain('ccd-express__buttons--row');
  });

  it('buttons carry data-provider + brand CSS vars + label text', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: true } });
    expect(out).toContain('data-provider="shopPay"');
    expect(out).toContain('--ccd-ep-bg:#5a31f4');
    expect(out).toContain('--ccd-ep-fg:#ffffff');
    expect(out).toContain('background:var(--ccd-ep-bg)');
    expect(out).toContain('color:var(--ccd-ep-fg)');
    expect(out).toContain('>Shop Pay<');
  });

  it('default (no position) places the row ABOVE the checkout button', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: true } });
    const wrapIdx = out.indexOf('id="ccd-express-payments"');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(wrapIdx).toBeGreaterThan(-1);
    expect(wrapIdx).toBeLessThan(checkoutIdx);
  });

  it('position="below" places the row AFTER the checkout button', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: true }, position: 'below' });
    const wrapIdx = out.indexOf('id="ccd-express-payments"');
    const checkoutIdx = out.indexOf('class="ccd-checkout-btn"');
    expect(wrapIdx).toBeGreaterThan(checkoutIdx);
  });

  it('separatorLabel renders a ccd-express__separator with the label', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: true }, separatorLabel: 'or' });
    expect(out).toContain('ccd-express__separator');
    expect(out).toContain('>or<');
  });

  it('no separator element when separatorLabel is empty', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: true }, separatorLabel: '' });
    expect(out).not.toContain('ccd-express__separator');
  });

  it('renders nothing when no providers are enabled', () => {
    const out = applyExpressPayments(makeCartHtml(), { providers: { shopPay: false } });
    expect(out).not.toContain('ccd-express-payments');
  });
});

describe('CSS parity — REAL_CART_CSS must NOT add .ccd-express rules (v14 has none)', () => {
  it('v14 stylesheet has no .ccd-express selector block', () => {
    const v14 = readFileSync(
      resolve(__dirname, '../../../extensions/cart-drawer/assets/v14-complete.js'),
      'utf8',
    );
    // .ccd-express appears only inside JS (className assignment), never as a CSS rule
    expect(v14).not.toMatch(/\.ccd-express\s*\{/);
    expect(v14).not.toMatch(/\.ccd-express__btn\s*\{/);
  });
});
