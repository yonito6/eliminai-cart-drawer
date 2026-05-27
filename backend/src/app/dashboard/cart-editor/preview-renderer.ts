// Cart Editor Preview Renderer
//
// Pure function that produces an HTML string mirroring the live v14 drawer
// shell. Class names match production so the same `applyOverridesToDom`
// (see preview-canvas.tsx) can paint editorOverrides onto the preview DOM.
//
// This is intentionally a STATIC approximation, not a full v14 reimplementation.
// It covers the structural hotspots the editor needs to target:
//   .ccd-header, .ccd-title, .ccd-close-btn, .ccd-milestone, .ccd-items,
//   .ccd-item, .ccd-empty, .ccd-sticky-footer, .ccd-checkout-btn,
//   .ccd-trust-line, .ccd-footer-notes-zone, .ccd-footer-discount-zone,
//   .ccd-footer-terms-zone, .ccd-footer-express-zone

import type { EditorOverrides } from '@/lib/cart-editor/schema';

export type PreviewState = 'items' | 'empty' | 'unlocked' | 'loading';

export interface PreviewRenderInput {
  overrides: Partial<EditorOverrides>;
  // Addons config — for now we only need to know which footer zones to show.
  addons?: {
    notes?: { enabled?: boolean; label?: string };
    discountCode?: { enabled?: boolean; label?: string };
    termsCheckbox?: { enabled?: boolean; label?: string };
    expressPayments?: { enabled?: boolean; providers?: Record<string, boolean> };
    trustLine?: { enabled?: boolean };
  };
  previewState: PreviewState;
}

const MOCK_ITEMS = [
  {
    title: 'Orbit Quartz Watch',
    variant: 'Silver / Medium',
    price: '$129.00',
    qty: 1,
    img: 'https://via.placeholder.com/64x64.png?text=Watch',
  },
  {
    title: 'Eclipse Tote Bag',
    variant: 'Black',
    price: '$54.00',
    qty: 2,
    img: 'https://via.placeholder.com/64x64.png?text=Tote',
  },
  {
    title: 'Helix Sneakers',
    variant: 'White / 42',
    price: '$89.00',
    qty: 1,
    img: 'https://via.placeholder.com/64x64.png?text=Shoe',
  },
];

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderPreview(input: PreviewRenderInput): string {
  const { overrides, addons, previewState } = input;
  const h = overrides.header ?? {};
  const ms = overrides.milestoneBar ?? {};
  const empty = overrides.emptyState ?? {};
  const trust = overrides.trustLine ?? {};
  const cb = overrides.checkoutButton ?? {};

  const isEmpty = previewState === 'empty';
  const isLoading = previewState === 'loading';
  const isUnlocked = previewState === 'unlocked';

  // Header
  const headingLevel = (h as any).headingLevel && /^h[234]$/.test(String((h as any).headingLevel))
    ? String((h as any).headingLevel)
    : 'h2';
  const title = esc(String((h as any).title ?? 'Your Cart'));
  const headerHTML = `
    <div class="ccd-fixed-header">
      <div class="ccd-header" data-ce-id="header">
        <${headingLevel} class="ccd-title">${title}</${headingLevel}>
        <span class="ccd-close" data-ce-id="header.closeButton">
          <button class="ccd-close-btn" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </span>
      </div>
    </div>`;

  // Milestone bar
  const tierTextUnlocked = esc(String((ms as any).unlockedTemplate ?? '🎉 You unlocked free shipping!'));
  const tierTextLocked = esc(String((ms as any).preUnlockTemplate ?? 'Add {amount} more for free shipping'));
  const fillPct = isUnlocked ? 100 : 60;
  const tierText = isUnlocked ? tierTextUnlocked : tierTextLocked.replace('{amount}', '$25.00');
  const milestoneHTML = isLoading ? '' : `
    <div class="ccd-milestone" data-ce-id="milestoneBar">
      <div class="ccd-milestone-text">${tierText}</div>
      <div class="ccd-milestone-track">
        <div class="ccd-milestone-fill" style="width:${fillPct}%"></div>
      </div>
    </div>`;

  // Items
  let itemsHTML = '';
  if (isLoading) {
    itemsHTML = '<div class="ccd-loading">Loading…</div>';
  } else if (isEmpty) {
    const heading = esc(String((empty as any).heading ?? 'Your cart is empty'));
    const sub = esc(String((empty as any).subtext ?? "Looks like you haven't added anything yet."));
    const cta = esc(String((empty as any).ctaLabel ?? 'Continue shopping'));
    itemsHTML = `
      <div class="ccd-empty" data-ce-id="emptyState">
        <div class="ccd-empty-icon">🛒</div>
        <div class="ccd-empty-heading">${heading}</div>
        <div class="ccd-empty-sub">${sub}</div>
        <a class="ccd-continue-btn" href="#" data-ce-id="emptyState.cta">${cta}</a>
      </div>`;
  } else {
    itemsHTML =
      '<ul class="ccd-items">' +
      MOCK_ITEMS.map(
        (it, i) => `
        <li class="ccd-item" data-ce-id="${i === 0 ? 'lineItem' : ''}">
          <img class="ccd-item-img" src="${it.img}" alt="${esc(it.title)}" />
          <div class="ccd-item-body">
            <div class="ccd-item-title">${esc(it.title)}</div>
            <div class="ccd-item-variant">${esc(it.variant)}</div>
            <div class="ccd-item-bottom">
              <div class="ccd-qty">
                <button class="ccd-qty-btn" type="button">−</button>
                <span class="ccd-qty-val">${it.qty}</span>
                <button class="ccd-qty-btn" type="button">+</button>
              </div>
              <div class="ccd-item-price">${esc(it.price)}</div>
            </div>
          </div>
          <button class="ccd-remove" type="button" aria-label="Remove">✕</button>
        </li>`,
      ).join('') +
      '</ul>';
  }

  // Footer addon zones
  const notesEnabled = !!(addons?.notes?.enabled);
  const discountEnabled = !!(addons?.discountCode?.enabled);
  const termsEnabled = !!(addons?.termsCheckbox?.enabled);
  const expressEnabled = !!(addons?.expressPayments?.enabled);
  const trustEnabled = !!(addons?.trustLine?.enabled) || !!(trust as any).text;

  const notesZone = notesEnabled
    ? `<div class="ccd-footer-notes-zone" data-ce-id="addon.notes"><label class="ccd-notes-label">${esc((addons?.notes?.label as string) ?? 'Order notes')}</label><textarea class="ccd-notes-input" rows="2"></textarea></div>`
    : '';
  const discountZone = discountEnabled
    ? `<div class="ccd-footer-discount-zone" data-ce-id="addon.discountCode"><label class="ccd-discount-label">${esc((addons?.discountCode?.label as string) ?? 'Discount code')}</label><div class="ccd-discount-row"><input class="ccd-discount-input" placeholder="Enter code" /><button class="ccd-discount-apply" type="button">Apply</button></div></div>`
    : '';
  const termsZone = termsEnabled
    ? `<div class="ccd-footer-terms-zone" data-ce-id="addon.termsCheckbox"><label class="ccd-terms-label"><input type="checkbox" class="ccd-terms-input" /> <span>${esc((addons?.termsCheckbox?.label as string) ?? 'I agree to the terms')}</span></label></div>`
    : '';

  let expressZone = '';
  if (expressEnabled) {
    const providers = addons?.expressPayments?.providers ?? {};
    const provList = Object.keys(providers).filter((k) => providers[k]);
    expressZone = `<div class="ccd-footer-express-zone" data-ce-id="addon.expressPayments">${provList
      .map((p) => `<div class="ccd-express-btn ccd-express-${esc(p)}">${esc(p)}</div>`)
      .join('')}</div>`;
  }

  // Totals
  const totalLabel = esc(String((overrides.footer as any)?.totalLabel ?? 'Total'));

  // Checkout button
  const cbLabel = esc(String((cb as any).label ?? 'Checkout'));
  const checkoutBtnHTML = `<button class="ccd-checkout-btn" type="button" data-ce-id="checkoutButton"><span class="ccd-checkout-label">${cbLabel} · </span><span class="ccd-checkout-total">$272.00</span></button>`;

  // Trust line
  const trustText = esc(String((trust as any).text ?? 'Secure checkout — encrypted by Stripe'));
  const trustLineHTML = trustEnabled
    ? `<div class="ccd-trust-line" data-ce-id="trustLine"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg><span class="ccd-trust-text">${trustText}</span></div>`
    : '';

  // Footer
  const totalsHTML = isEmpty
    ? ''
    : `
    <div class="ccd-totals">
      <div class="ccd-row ccd-row-subtotal"><span>Subtotal</span><span>$272.00</span></div>
      <div class="ccd-row ccd-row-shipping"><span>Shipping</span><span>FREE</span></div>
      <div class="ccd-row ccd-row-total"><span class="ccd-checkout-total-label">${totalLabel}</span><span>$272.00</span></div>
    </div>`;

  const footerHTML = isEmpty
    ? ''
    : `
    <div class="ccd-sticky-footer" data-ce-id="footer">
      ${notesZone}
      ${discountZone}
      ${totalsHTML}
      ${termsZone}
      ${expressZone}
      ${checkoutBtnHTML}
      ${trustLineHTML}
    </div>`;

  return `
    <div id="CCD-Drawer" class="ccd-open" data-ce-preview="true">
      ${headerHTML}
      <div class="ccd-contents">
        <div class="ccd-inner">
          <div class="ccd-scrollable">
            ${milestoneHTML}
            ${itemsHTML}
          </div>
        </div>
      </div>
      ${footerHTML}
    </div>`;
}

// Compact CSS bundle covering the preview layout. Mirrors v14 class names
// closely enough that editorOverrides target the same selectors.
export const PREVIEW_CSS = `
  #CCD-Drawer { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--ccd-bg, #fff); color: var(--ccd-text, #111); width: 100%; display: flex; flex-direction: column;
    border-radius: 12px; overflow: hidden; box-shadow: 0 8px 28px rgba(0,0,0,0.1); min-height: 600px; }
  #CCD-Drawer * { box-sizing: border-box; }
  .ccd-fixed-header { background: var(--ccd-bg, #fff); flex-shrink: 0; }
  .ccd-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 8px; }
  .ccd-title { font-size: 22px; font-weight: 700; margin: 0; line-height: 1; }
  .ccd-close-btn { background: none; border: none; cursor: pointer; padding: 8px; display: flex; }
  .ccd-close-btn svg { stroke: currentColor; }
  .ccd-contents { display: flex; flex-direction: column; flex: 1 1 0%; min-height: 0; overflow: hidden; }
  .ccd-inner { display: flex; flex-direction: column; flex: 1 1 0%; min-height: 0; }
  .ccd-scrollable { flex: 1 1 0%; overflow-y: auto; padding: 0 20px 16px; }
  .ccd-milestone { padding: 12px 0 8px; }
  .ccd-milestone-text { font-size: 13px; color: var(--ccd-text-muted, #6b7280); margin-bottom: 6px; }
  .ccd-milestone-track { background: var(--ccd-surface, #e5e7eb); height: 6px; border-radius: 999px; overflow: hidden; }
  .ccd-milestone-fill { background: var(--ccd-accent, #7c3aed); height: 100%; transition: width 0.3s; }
  .ccd-items { list-style: none; margin: 0; padding: 0; }
  .ccd-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--ccd-border, #e5e7eb); }
  .ccd-item-img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; }
  .ccd-item-body { flex: 1; min-width: 0; }
  .ccd-item-title { font-size: 14px; font-weight: 600; color: var(--ccd-text, #111); margin-bottom: 2px; }
  .ccd-item-variant { font-size: 12px; color: var(--ccd-text-muted, #6b7280); margin-bottom: 6px; }
  .ccd-item-bottom { display: flex; justify-content: space-between; align-items: center; }
  .ccd-qty { display: inline-flex; align-items: center; gap: 6px; background: #f3f4f6; border-radius: 6px; padding: 2px 6px; }
  .ccd-qty-btn { background: none; border: none; cursor: pointer; padding: 4px 8px; font-size: 14px; }
  .ccd-qty-val { font-size: 13px; font-weight: 600; min-width: 16px; text-align: center; }
  .ccd-item-price { font-size: 14px; font-weight: 700; }
  .ccd-remove { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 14px; padding: 0 4px; align-self: flex-start; }
  .ccd-empty { text-align: center; padding: 64px 20px; }
  .ccd-empty-icon { font-size: 48px; margin-bottom: 12px; }
  .ccd-empty-heading { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
  .ccd-empty-sub { font-size: 13px; color: var(--ccd-text-muted, #6b7280); margin-bottom: 16px; }
  .ccd-continue-btn { display: inline-block; padding: 12px 24px; background: var(--ccd-accent, #111); color: #fff; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; }
  .ccd-loading { text-align: center; padding: 64px 20px; color: var(--ccd-text-muted, #6b7280); font-size: 13px; }
  .ccd-sticky-footer { padding: 16px 20px; border-top: 1px solid var(--ccd-border, #e5e7eb); background: var(--ccd-surface, #fff); flex-shrink: 0; }
  .ccd-footer-notes-zone, .ccd-footer-discount-zone, .ccd-footer-terms-zone, .ccd-footer-express-zone { margin-bottom: 12px; font-size: 13px; }
  .ccd-notes-label, .ccd-discount-label { display: block; font-size: 12px; font-weight: 600; color: var(--ccd-text-muted, #6b7280); margin-bottom: 4px; }
  .ccd-notes-input { width: 100%; padding: 8px; border: 1px solid var(--ccd-border, #d1d5db); border-radius: 6px; font-family: inherit; font-size: 13px; resize: vertical; }
  .ccd-discount-row { display: flex; gap: 6px; }
  .ccd-discount-input { flex: 1; padding: 8px 10px; border: 1px solid var(--ccd-border, #d1d5db); border-radius: 6px; font-size: 13px; }
  .ccd-discount-apply { padding: 8px 14px; background: #111; color: #fff; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .ccd-terms-label { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: var(--ccd-text, #111); cursor: pointer; }
  .ccd-footer-express-zone { display: flex; flex-direction: column; gap: 6px; }
  .ccd-express-btn { padding: 10px; border-radius: 6px; background: #111; color: #fff; text-align: center; font-size: 12px; font-weight: 600; text-transform: capitalize; }
  .ccd-totals { font-size: 13px; margin-bottom: 12px; }
  .ccd-row { display: flex; justify-content: space-between; padding: 4px 0; color: var(--ccd-text-muted, #6b7280); }
  .ccd-row-total { font-weight: 700; color: var(--ccd-text, #111); font-size: 15px; border-top: 1px solid var(--ccd-border, #e5e7eb); padding-top: 8px; margin-top: 4px; }
  .ccd-checkout-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 14px 24px; background: #111; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; }
  .ccd-trust-line { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; font-size: 11px; color: var(--ccd-text-muted, #6b7280); }
`;
