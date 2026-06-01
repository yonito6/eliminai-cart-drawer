// Cart Editor Preview Renderer
//
// Produces an HTML string that mirrors the LIVE storefront drawer
// (cart-constants.ts → CONTROL_HTML), so the editor preview is visually
// identical to what shoppers see. Real products from the connected Shopify
// store are spliced in between the CART_ITEMS_START / CART_ITEMS_END markers.
//
// Renders ALL enabled addons (trust badges, scarcity timer, milestones /
// reward tiers, shipping protection overrides, upsells, social proof,
// express payments, plus the original footer zones: notes, discount,
// terms, express) — same HTML the storefront cart shows — so the
// cart-editor preview is always synced with what real customers see.
//
// ── SINGLE SOURCE OF TRUTH ─────────────────────────────────────────
// Per-addon transforms are imported from @/app/dashboard/addons/addon-transforms,
// the same module the /addons editor preview uses. This eliminates the drift
// bug where the cart-editor showed stale/text-based UI while /addons showed
// the real branded SVGs, gift items, and colored timer. If you change a
// transform, both renderers update automatically.
//
// The hotspot registry (overlay/hotspots.ts) targets CONTROL_HTML class
// names (`.drawer__header`, `.ccd-progress`, `.ccd-item`, `.ccd-sticky-footer`,
// `.ccd-checkout-btn`, `.ccd-trust`, `.drawer__cart-empty`, `#CartDrawer`).

import type { EditorOverrides } from '@/lib/cart-editor/schema';
import { CONTROL_HTML, REAL_CART_CSS } from '@/app/dashboard/cart-constants';
import { CHECKOUT_RADIUS_PX, CHECKOUT_HEIGHT_PADDING, renderCheckoutIcon, HEADER_PADDING, HEADER_MIN_HEIGHT, CLOSE_ICON_SIZE_PX, renderCloseIcon } from '@/lib/cart-editor/defaults';
import {
  applyTrustBadges,
  applyScarcityTimer,
  applyShippingProtection,
  applyFreeShippingBar,
  applyUpsellRecommendations,
  applySocialProof,
  applyExpressPayments,
  applyLowStockBadge,
  applyNotes,
  applyCustomCode,
  hideBuiltInTrustLine,
  applyDiscountCode,
  applyTermsCheckbox,
  type PreviewProduct as SharedPreviewProduct,
} from '@/app/dashboard/addons/addon-transforms';

export type PreviewState = 'items' | 'empty' | 'unlocked' | 'loading';

export type PreviewProduct = SharedPreviewProduct;

// Full addons shape returned by /api/stores/[id]/addons. Each entry has
// { enabled, mode, optimizeState, config }. We accept `any` here because the
// per-addon `config` shape varies and is fully owned by the cart-editor /
// addons feature — we only read the fields we know how to render.
export type AddonsMap = Record<string, {
  enabled?: boolean;
  config?: Record<string, any>;
  // Legacy thin-footer shape: some callers (tests) pass `{ notes: { enabled, label } }`
  // directly without wrapping in `config`. Accept both.
  label?: string;
  providers?: Record<string, boolean>;
}>;

export interface PreviewRenderInput {
  overrides: Partial<EditorOverrides>;
  // When omitted or undefined, no addon rendering happens (default render).
  // PreviewCanvas auto-fetches the live demo addon config and passes it in.
  addons?: AddonsMap;
  previewState: PreviewState;
  // Real Shopify products (fetched by PreviewCanvas via /api/stores/[id]/products/preview).
  // When omitted, the CONTROL_HTML placeholder items render as-is.
  products?: PreviewProduct[];
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildItemHtml(p: PreviewProduct): string {
  const imgHtml = p.image
    ? `<a href="#"><img src="${esc(p.image)}" alt="${esc(p.title)}" style="width:100%;height:auto;display:block;object-fit:cover"></a>`
    : `<a href="#"><div style="width:120px;height:120px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px"><svg width="40" height="40" viewBox="0 0 24 24" fill="#ccc"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div></a>`;
  const variantHtml = p.variant ? `<div class="ccd-item__variant">${esc(p.variant)}</div>` : '';
  const priceHtml = p.compareAtPrice
    ? `<span class="ccd-item__compare-price">$${esc(p.compareAtPrice)}</span><span class="ccd-item__price">$${esc(p.price)}</span>`
    : `<span class="ccd-item__price">$${esc(p.price)}</span>`;
  return `<div class="ccd-item">
    <div class="ccd-item__image">${imgHtml}</div>
    <div class="ccd-item__details">
      <div class="ccd-item__title-row">
        <a href="#" class="ccd-item__name">${esc(p.title)}</a>
        <button type="button" class="ccd-item__remove" aria-label="Remove">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
        </button>
      </div>
      ${variantHtml}
      <div class="ccd-item__bottom">
        <div class="ccd-qty">
          <button type="button" class="ccd-qty__btn ccd-qty__btn--minus"><svg viewBox="0 0 20 20"><path d="M17.543 11.029H2.1A1.032 1.032 0 0 1 1.071 10c0-.566.463-1.029 1.029-1.029h15.443c.566 0 1.029.463 1.029 1.029 0 .566-.463 1.029-1.029 1.029z"></path></svg></button>
          <input type="text" class="ccd-qty__input" value="1" aria-label="Quantity">
          <button type="button" class="ccd-qty__btn ccd-qty__btn--plus"><svg viewBox="0 0 20 20"><path d="M17.409 8.929h-6.695V2.258c0-.566-.506-1.029-1.071-1.029s-1.071.463-1.071 1.029v6.671H1.967C1.401 8.929.938 9.435.938 10s.463 1.071 1.029 1.071h6.605V17.7c0 .566.506 1.029 1.071 1.029s1.071-.463 1.071-1.029v-6.629h6.695c.566 0 1.029-.506 1.029-1.071s-.463-1.071-1.029-1.071z"></path></svg></button>
        </div>
        <div class="ccd-item__price-col">
          <div class="ccd-item__price-row">${priceHtml}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Pull addon config from either shape ────────────────────────────
// Tests pass `{ notes: { enabled, label } }` (legacy thin shape).
// API returns `{ notes: { enabled, config: { label } } }`. Unify.
function getAddon(addons: AddonsMap | undefined, key: string): { enabled: boolean; config: Record<string, any> } {
  const entry = addons?.[key];
  if (!entry) return { enabled: false, config: {} };
  const enabled = !!entry.enabled;
  // Prefer .config (API shape) but fall back to spreading the entry itself
  // (legacy thin shape) so existing tests stay green.
  const config = entry.config && typeof entry.config === 'object'
    ? entry.config
    : (entry as Record<string, any>);
  return { enabled, config };
}

// ── Strip baked-in lowStockBadge markup from CONTROL_HTML ──────────
// CONTROL_HTML ships with a sample `<span class="ccd-scarcity-badge">…</span>`
// and a `ccd-qty__btn--locked` class on one plus button so the storefront
// fallback looks complete even without the addon installed. When the addon
// is disabled (or absent), the cart-editor preview must hide that markup —
// otherwise toggling the addon off has no visual effect.
function stripBakedLowStock(html: string): string {
  let out = html.replace(/\s*<span class="ccd-scarcity-badge">[\s\S]*?<\/span>/g, '');
  out = out.replace(/\s*ccd-qty__btn--locked/g, '');
  out = out.replace(
    /<div class="ccd-item__variant-row">\s*<div class="ccd-item__variant">([^<]*)<\/div>\s*<\/div>/g,
    '<div class="ccd-item__variant">$1</div>',
  );
  return out;
}

// ── Legacy express-payments footer zone ────────────────────────────
// Notes / discount / terms are now handled by shared transforms
// (applyNotes / applyDiscountCode / applyTermsCheckbox) so the cart-editor
// preview emits the SAME class names as the live storefront. Only the legacy
// {providers: {...}} express-payments shape is rendered here for backwards
// compat with the old tests; the full addon path uses applyExpressPayments().
function buildAddonFooterZones(addons: AddonsMap | undefined): string {
  if (!addons) return '';
  const expressFooter = getAddon(addons, 'expressPayments');
  const legacyProviders = (addons.expressPayments as any)?.providers;
  if (expressFooter.enabled && legacyProviders && typeof legacyProviders === 'object' && !Array.isArray(expressFooter.config.providers)) {
    const provList = Object.keys(legacyProviders).filter((k) => legacyProviders[k]);
    return `<div class="ccd-footer-express-zone" data-ce-id="addon.expressPayments">${provList
      .map((p) => `<div class="ccd-express-btn ccd-express-${esc(p)}">${esc(p)}</div>`)
      .join('')}</div>`;
  }
  return '';
}

// ── Balanced <div> extractor — returns the full block (incl. nested divs) ──
// starting at startIdx (which must point at the opening '<div' of the block).
function extractBalancedDiv(html: string, startIdx: number): { block: string; endIdx: number } | null {
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = startIdx;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) return { block: html.slice(startIdx, re.lastIndex), endIdx: re.lastIndex };
    } else if (!m[0].endsWith('/>')) {
      depth++;
    }
  }
  return null;
}

// Moves the whole .ccd-progress block to sit just before the sticky footer
// (mirrors v14 CCD_relocateProgress for position === 'aboveCheckout').
function relocateProgressBeforeFooter(html: string): string {
  const startIdx = html.search(/<div class="ccd-progress[ "]/);
  if (startIdx === -1) return html;
  const ext = extractBalancedDiv(html, startIdx);
  if (!ext) return html;
  const without = html.slice(0, startIdx) + html.slice(ext.endIdx);
  const footerIdx = without.indexOf('<div class="ccd-sticky-footer"');
  if (footerIdx === -1) return html;
  return without.slice(0, footerIdx) + ext.block + without.slice(footerIdx);
}

export function renderPreview(input: PreviewRenderInput): string {
  const { overrides, addons, previewState, products } = input;
  const isEmpty = previewState === 'empty';
  const isLoading = previewState === 'loading';

  // Start from the live cart HTML and add the open-state classes so the drawer
  // is visible inside the preview frame (same trick as addon-preview.tsx).
  let html = CONTROL_HTML.replace(/\r\n/g, '\n');
  html = html.replace(
    'class="custom-cart-drawer"',
    'class="custom-cart-drawer drawer--right drawer--is-open"',
  );

  // ── Header overrides (title typography, bg/padding/border, close btn) ──
  // Mirrors the v14 applyEditorOverrides header block field-for-field so the
  // preview render is byte-identical to the live drawer. All values are applied
  // as inline styles / real SVG markup (the live cart has no modifier CSS).
  const h = (overrides.header as any) || {};
  const hasHeaderOverride = overrides.header && typeof overrides.header === 'object';
  if (hasHeaderOverride) {
    // Title element: text, typography, alignment + optional item-count badge
    const titleStyles: string[] = [];
    if (typeof h.titleColor === 'string') titleStyles.push(`color:${h.titleColor}`);
    if (typeof h.titleFontSize === 'number') titleStyles.push(`font-size:${h.titleFontSize}px`);
    if (h.titleFontWeight === 'normal') titleStyles.push('font-weight:400');
    else if (h.titleFontWeight === 'semibold') titleStyles.push('font-weight:600');
    else if (h.titleFontWeight === 'bold') titleStyles.push('font-weight:700');
    if (h.titleAlignment === 'center') titleStyles.push('text-align:center');
    else if (h.titleAlignment === 'side') titleStyles.push('text-align:left');
    const badgeHtml =
      h.showItemCountBadge === true
        ? `<span class="ccd-title-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;margin-left:8px;border-radius:999px;background:${esc(h.badgeColor || '#eeeeee')};color:#111;font-size:12px;font-weight:600;line-height:1">0</span>`
        : '';
    html = html.replace(
      /(<div class="h2 drawer__title")([^>]*)(>)([^<]*)(<\/div>)/,
      (_m, open, attrs, gt, inner, close) => {
        const text = typeof h.title === 'string' && h.title.length > 0 ? esc(h.title) : inner;
        let newAttrs = attrs as string;
        if (titleStyles.length) {
          newAttrs = /style="/.test(newAttrs)
            ? newAttrs.replace(/style="([^"]*)"/, (_mm: string, ss: string) => `style="${ss};${titleStyles.join(';')}"`)
            : `${newAttrs} style="${titleStyles.join(';')}"`;
        }
        return `${open}${newAttrs}${gt}${text}${close}${badgeHtml}`;
      },
    );

    // Header container: bg, padding, height preset, border style
    const headerStyles: string[] = [];
    if (typeof h.bgColor === 'string') headerStyles.push(`background:${h.bgColor}`);
    if (h.padding && HEADER_PADDING[h.padding as keyof typeof HEADER_PADDING]) {
      headerStyles.push(`padding:${HEADER_PADDING[h.padding as keyof typeof HEADER_PADDING]}`);
    }
    if (h.heightPreset && HEADER_MIN_HEIGHT[h.heightPreset as keyof typeof HEADER_MIN_HEIGHT]) {
      headerStyles.push(`min-height:${HEADER_MIN_HEIGHT[h.heightPreset as keyof typeof HEADER_MIN_HEIGHT]}`);
    }
    if (h.borderStyle === 'none') headerStyles.push('border-bottom:none', 'box-shadow:none');
    else if (h.borderStyle === 'line') headerStyles.push(`border-bottom:1px solid ${h.titleColor || '#111111'}`, 'box-shadow:none');
    else if (h.borderStyle === 'shadow') headerStyles.push('border-bottom:none', 'box-shadow:0 2px 8px rgba(0,0,0,.08)');
    if (headerStyles.length) {
      html = html.replace(
        /(<div class="drawer__header")([^>]*)(>)/,
        (_m, open, attrs, gt) => {
          const newAttrs = /style="/.test(attrs)
            ? (attrs as string).replace(/style="([^"]*)"/, (_mm: string, ss: string) => `style="${ss};${headerStyles.join(';')}"`)
            : `${attrs} style="${headerStyles.join(';')}"`;
          return `${open}${newAttrs}${gt}`;
        },
      );
    }

    // Close button: icon swap, colors, size, border
    const cb = (h.closeButton as any) || {};
    const swapClose = h.closeIcon === 'x' || h.closeIcon === 'chevron' || h.closeIcon === 'arrow';
    const closeSize = cb.iconSize && CLOSE_ICON_SIZE_PX[cb.iconSize as keyof typeof CLOSE_ICON_SIZE_PX]
      ? CLOSE_ICON_SIZE_PX[cb.iconSize as keyof typeof CLOSE_ICON_SIZE_PX]
      : null;
    const btnStyles: string[] = [];
    if (typeof cb.bgColor === 'string') btnStyles.push(`background-color:${cb.bgColor}`);
    if (typeof cb.iconColor === 'string') btnStyles.push(`color:${cb.iconColor}`);
    if (cb.border === 'none') btnStyles.push('border:none');
    else if (cb.border === 'thin' || cb.border === 'normal' || cb.border === 'thick') {
      const bw = cb.border === 'thin' ? '1px' : cb.border === 'thick' ? '3px' : '2px';
      btnStyles.push(`border:${bw} solid ${cb.borderColor || 'currentColor'}`);
    }
    if (swapClose || closeSize || btnStyles.length) {
      html = html.replace(
        /(<button type="button" class="drawer__close-button")([^>]*)(>)([\s\S]*?)(<\/button>)/,
        (_m, open, attrs, gt, inner, close) => {
          let newInner = inner as string;
          if (swapClose) {
            let svg = renderCloseIcon(h.closeIcon);
            if (closeSize) svg = svg.replace('<svg ', `<svg style="width:${closeSize};height:${closeSize}" `);
            newInner = newInner.replace(/<svg[\s\S]*?<\/svg>/, svg);
          } else if (closeSize) {
            newInner = newInner.replace(/<svg /, `<svg style="width:${closeSize};height:${closeSize}" `);
          }
          let newAttrs = attrs as string;
          if (btnStyles.length) {
            newAttrs = /style="/.test(newAttrs)
              ? newAttrs.replace(/style="([^"]*)"/, (_mm: string, ss: string) => `style="${ss};${btnStyles.join(';')}"`)
              : `${newAttrs} style="${btnStyles.join(';')}"`;
          }
          return `${open}${newAttrs}${gt}${newInner}${close}`;
        },
      );
    }
  }

  // ── Checkout button overrides (label, icon, colors, shape, type) ──
  // Applied as a single button-element transform so icon SVG, label, and
  // inline styles all land together. Icon and radius/height are applied as
  // real SVG markup + inline styles (the live cart has no modifier CSS for
  // these), keeping the preview byte-identical to v14 applyEditorOverrides.
  const cb = (overrides.checkoutButton as any) || {};
  const hasCheckoutOverride = overrides.checkoutButton && typeof overrides.checkoutButton === 'object';
  if (hasCheckoutOverride) {
    const styles: string[] = [];
    if (typeof cb.bgColor === 'string') styles.push(`background:${cb.bgColor}`);
    if (typeof cb.textColor === 'string') styles.push(`color:${cb.textColor}`);
    if (cb.radius && CHECKOUT_RADIUS_PX[cb.radius as keyof typeof CHECKOUT_RADIUS_PX]) {
      styles.push(`border-radius:${CHECKOUT_RADIUS_PX[cb.radius as keyof typeof CHECKOUT_RADIUS_PX]}`);
    }
    if (cb.height && CHECKOUT_HEIGHT_PADDING[cb.height as keyof typeof CHECKOUT_HEIGHT_PADDING]) {
      styles.push(`padding:${CHECKOUT_HEIGHT_PADDING[cb.height as keyof typeof CHECKOUT_HEIGHT_PADDING]}`);
    }
    if (typeof cb.fontWeight === 'number') styles.push(`font-weight:${cb.fontWeight}`);
    if (typeof cb.letterSpacing === 'number') styles.push(`letter-spacing:${cb.letterSpacing}px`);
    // Swap the icon only when the merchant set an icon / custom icon; otherwise
    // leave the CONTROL_HTML default lock untouched.
    const swapIcon = cb.icon !== undefined || cb.iconCustom !== undefined;
    const iconHtml = swapIcon ? renderCheckoutIcon(cb.icon ?? 'lock', cb.iconCustom) : null;

    html = html.replace(
      /(<button type="button" class="ccd-checkout-btn")([^>]*)(>)([\s\S]*?)(<\/button>)/,
      (_m, open, attrs, gt, inner, close) => {
        let newInner = inner as string;
        if (iconHtml !== null) {
          newInner = newInner.replace(/<svg[\s\S]*?<\/svg>/, '');
          newInner = iconHtml + newInner;
        }
        if (typeof cb.label === 'string' && cb.label.length > 0) {
          newInner = newInner.replace('SECURE CHECKOUT', esc(cb.label));
        }
        let newAttrs = attrs as string;
        if (styles.length) {
          if (/style="/.test(newAttrs)) {
            newAttrs = newAttrs.replace(/style="([^"]*)"/, (_mm: string, ss: string) => `style="${ss};${styles.join(';')}"`);
          } else {
            newAttrs = `${newAttrs} style="${styles.join(';')}"`;
          }
        }
        return `${open}${newAttrs}${gt}${newInner}${close}`;
      },
    );
  }

  // ── Real Shopify products replace the CONTROL_HTML placeholders ───
  if (products && products.length > 0) {
    const itemsHtml = products.map(buildItemHtml).join('\n');
    const startMarker = '<!-- CART_ITEMS_START -->';
    const endMarker = '<!-- CART_ITEMS_END -->';
    const startIdx = html.indexOf(startMarker);
    const endIdx = html.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1) {
      html = html.substring(0, startIdx + startMarker.length) + itemsHtml + html.substring(endIdx);
    }
    const productsTotal = products.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
    const checkoutVal = productsTotal + 4.99;
    html = html.replace(
      /(<span class="ccd-checkout-total">)\$[\d.]+(<\/span>)/,
      `$1$${checkoutVal.toFixed(2)}$2`,
    );
    const hasDiscount = products.some((p) => p.compareAtPrice);
    if (!hasDiscount) {
      html = html.replace(
        /(<div class="ccd-discount-row"[^>]*style=")[^"]*(")/,
        '$1display:none$2',
      );
    } else {
      const discountAmt = products.reduce((sum, p) => {
        if (!p.compareAtPrice) return sum;
        return sum + ((parseFloat(p.compareAtPrice) || 0) - (parseFloat(p.price) || 0));
      }, 0);
      if (discountAmt > 0) {
        html = html.replace(
          /(<span class="ccd-discount-row__amount">)-?\$[\d.]+(<\/span>)/,
          `$1-$${discountAmt.toFixed(2)}$2`,
        );
      }
    }
  }

  // ── Preview state: empty / loading swap the items area ────────────
  if (isEmpty || isLoading) {
    const startMarker = '<!-- CART_ITEMS_START -->';
    const endMarker = '<!-- CART_ITEMS_END -->';
    const startIdx = html.indexOf(startMarker);
    const endIdx = html.indexOf(endMarker);
    const replacement = isLoading
      ? '<div class="ccd-loading" style="text-align:center;padding:64px 20px;color:#6b7280;font-size:13px">Loading…</div>'
      : `<div class="drawer__cart-empty" data-ce-id="emptyState" style="padding:64px 20px;text-align:center"><div style="font-size:18px;font-weight:700;margin-bottom:6px">${esc(
          String((overrides.emptyState as any)?.heading ?? 'Your cart is empty'),
        )}</div><div style="font-size:13px;color:#888">${esc(
          String((overrides.emptyState as any)?.subtext ?? "Looks like you haven't added anything yet."),
        )}</div></div>`;
    if (startIdx !== -1 && endIdx !== -1) {
      html = html.substring(0, startIdx + startMarker.length) + replacement + html.substring(endIdx);
    }
  }

  // ── Live addon rendering — uses the canonical shared module ────────
  // Same transforms as /addons preview so cart-editor matches storefront.
  // The cart-editor canvas re-renders on every keystroke, so socialProof
  // uses deterministic=true to avoid count flicker.
  if (addons) {
    // Order matters: freeShippingBar strips the default progress bar, so it
    // must run BEFORE socialProof's "before ccd-progress" anchor.
    const freeShipping = getAddon(addons, 'freeShippingBar');
    if (freeShipping.enabled) {
      html = applyFreeShippingBar(html, freeShipping.config, { previewProducts: products });
    }
    const shipping = getAddon(addons, 'shippingProtection');
    if (shipping.enabled) {
      html = applyShippingProtection(html, shipping.config);
    }
    const trust = getAddon(addons, 'trustBadges');
    if (trust.enabled) {
      html = applyTrustBadges(html, trust.config);
    } else {
      // Remove the placeholder so it never leaks into the rendered DOM.
      html = html.replace('<!-- TRUST_BADGES_PLACEHOLDER -->', '');
    }
    const scarcity = getAddon(addons, 'scarcityTimer');
    if (scarcity.enabled) {
      html = applyScarcityTimer(html, scarcity.config);
    }
    const lowStock = getAddon(addons, 'lowStockBadge');
    if (lowStock.enabled) {
      html = applyLowStockBadge(html, lowStock.config);
    } else {
      // Strip baked-in scarcity badge + locked plus button from CONTROL_HTML so
      // disabling the addon actually hides the badge in the preview.
      html = stripBakedLowStock(html);
    }
    const upsell = getAddon(addons, 'upsellRecommendations');
    if (upsell.enabled) {
      html = applyUpsellRecommendations(html, upsell.config, { previewProducts: products });
    }
    const social = getAddon(addons, 'socialProof');
    if (social.enabled) {
      html = applySocialProof(html, social.config, { deterministic: true });
    }
    const express = getAddon(addons, 'expressPayments');
    // Only render the rich express buttons when caller used the full addon
    // shape (config.providers as array). Legacy {providers: {...}} stays in
    // the footer zone below.
    if (express.enabled && Array.isArray(express.config.providers)) {
      html = applyExpressPayments(html, express.config);
    }
    // ── Footer zones (notes / discount code / terms) ────────────────
    // These emit the SAME ccd-notes-row / ccd-discount-row / ccd-terms-row
    // class names as the live storefront (v14-complete.js), so the
    // cart-editor preview is byte-for-byte identical to what shoppers see.
    const notes = getAddon(addons, 'notes');
    if (notes.enabled) {
      html = applyNotes(html, notes.config);
    }
    const customCode = getAddon(addons, 'customCode');
    if (customCode.enabled) {
      html = applyCustomCode(html, customCode.config);
    }
    const discountCode = getAddon(addons, 'discountCode');
    if (discountCode.enabled) {
      html = applyDiscountCode(html, discountCode.config);
    }
    const termsCheckbox = getAddon(addons, 'termsCheckbox');
    if (termsCheckbox.enabled) {
      html = applyTermsCheckbox(html, termsCheckbox.config);
    }
  } else {
    // No addons map provided — still strip the trust badge placeholder so the
    // default render doesn't contain a stray comment, and strip baked-in
    // lowStockBadge markup so an absent addon never leaks a stale badge.
    html = html.replace('<!-- TRUST_BADGES_PLACEHOLDER -->', '');
    html = stripBakedLowStock(html);
  }

  // ── Legacy addon footer zones (notes, discount, terms, express) ────
  const addonZones = buildAddonFooterZones(addons);
  if (addonZones) {
    html = html.replace(
      '<button type="button" class="ccd-checkout-btn">',
      `${addonZones}<button type="button" class="ccd-checkout-btn">`,
    );
  }

  // ── Milestone bar overrides (fill/track/height/text + celebration + templates + position) ──
  // Mirrors the v14 applyEditorOverrides milestoneBar block field-for-field so the
  // preview's progress bar matches the live cart. Runs AFTER addon rendering so it
  // lands on the FINAL .ccd-progress element (whether the default or the one the
  // freeShippingBar addon re-injects). Values land as inline CSS vars; templates +
  // celebration as data-attrs/classes; position physically relocates the bar
  // (top/underHeader = default home, aboveCheckout = just before the sticky footer).
  const mb = (overrides.milestoneBar as any) || {};
  const hasMilestoneOverride = overrides.milestoneBar && typeof overrides.milestoneBar === 'object';
  if (hasMilestoneOverride) {
    const mbStyles: string[] = [];
    if (typeof mb.fillColor === 'string') mbStyles.push(`--ccd-progress-fill:${mb.fillColor}`);
    if (typeof mb.trackColor === 'string') mbStyles.push(`--ccd-progress-bg:${mb.trackColor}`);
    if (typeof mb.height === 'number') mbStyles.push(`--ccd-progress-height:${mb.height}px`);
    if (typeof mb.textSize === 'number') mbStyles.push(`--ccd-progress-text-size:${mb.textSize}px`);
    if (typeof mb.textWeight === 'number') mbStyles.push(`--ccd-progress-text-weight:${mb.textWeight}`);
    const mbAttrs: string[] = [];
    if (typeof mb.preUnlockTemplate === 'string') mbAttrs.push(`data-pre-unlock="${esc(mb.preUnlockTemplate)}"`);
    if (typeof mb.unlockedTemplate === 'string') mbAttrs.push(`data-unlocked="${esc(mb.unlockedTemplate)}"`);
    if (mb.position === 'top' || mb.position === 'underHeader' || mb.position === 'aboveCheckout') {
      mbAttrs.push(`data-position="${mb.position}"`);
    }
    const noCelebrate = mb.celebrationAnim === false;
    html = html.replace(
      /(<div class="ccd-progress)("|\s)([^>]*?)(>)/,
      (_m, open, sep, attrs, gt) => {
        const cls = noCelebrate ? `${open} ccd-progress--no-celebrate${sep}` : `${open}${sep}`;
        let newAttrs = attrs as string;
        if (mbStyles.length) {
          newAttrs = /style="/.test(newAttrs)
            ? newAttrs.replace(/style="([^"]*)"/, (_mm: string, ss: string) => `style="${ss};${mbStyles.join(';')}"`)
            : `${newAttrs} style="${mbStyles.join(';')}"`;
        }
        if (mbAttrs.length) newAttrs = `${newAttrs} ${mbAttrs.join(' ')}`;
        return `${cls}${newAttrs}${gt}`;
      },
    );
    // Template message substitution — when a preUnlockTemplate is set the live
    // cart shows it instead of the default "Add … more for FREE" copy ({{amount}}
    // = remaining toward the goal, {{tierName}} = the next tier label).
    if (typeof mb.preUnlockTemplate === 'string' && mb.preUnlockTemplate.length > 0) {
      html = html.replace(
        /(<div class="ccd-progress__message"[^>]*>)([\s\S]*?)(<\/div>)/,
        (_m, open, _inner, close) =>
          `${open}${mb.preUnlockTemplate
            .replace(/\{\{amount\}\}/g, '<strong>1</strong>')
            .replace(/\{\{tierName\}\}/g, '')}${close}`,
      );
    }
    if (mb.position === 'aboveCheckout') {
      html = relocateProgressBeforeFooter(html);
    }
  }

  // ── Hide built-in returns line ─────────────────────────────────────
  // When a merchant seeds their own returns badge into the customCode addon and
  // toggles hideBuiltInTrustLine, drop the built-in `.ccd-trust` returns line so
  // it isn't shown twice. Default OFF → every other store keeps its line.
  if (addons) {
    const cc = getAddon(addons, 'customCode');
    if (cc.enabled && cc.config?.hideBuiltInTrustLine) {
      html = hideBuiltInTrustLine(html);
    }
  }

  return html;
}

// CSS bundle for the preview — the SAME CSS the live storefront uses, so the
// preview is visually identical. Exported under the legacy `PREVIEW_CSS` name
// so existing imports (preview-canvas.tsx) keep working.
export const PREVIEW_CSS = REAL_CART_CSS;
