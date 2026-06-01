// Cart Editor hotspot registry.
//
// Each hotspot maps a region of the preview DOM to an editor target id.
// Order matters: most-specific first. The first hotspot whose selector
// matches an element under the cursor wins, with `global` as the catch-all
// fallback for clicks anywhere in the drawer shell.
//
// Selectors match the production v14-complete.js class names used by
// preview-renderer.ts.

export type HotspotId =
  | 'header'
  | 'milestoneBar'
  | 'lineItem'
  // Line-item sub-element hotspots (per-row granularity)
  | 'lineItem.image'
  | 'lineItem.name'
  | 'lineItem.quantity'
  | 'lineItem.remove'
  | 'lineItem.price'
  | 'emptyState'
  | 'footer'
  | 'checkoutButton'
  | 'trustLine'
  | 'global'
  // Addon zones — deep-linked to the Addons tab.
  | 'addon.notes'
  | 'addon.discountCode'
  | 'addon.termsCheckbox'
  | 'addon.expressPayments'
  | 'addon.trustBadges'
  | 'addon.shippingProtection'
  | 'addon.scarcityTimer'
  | 'addon.lowStockBadge'
  | 'addon.upsellRecommendations'
  | 'addon.socialProof';

export interface Hotspot {
  id: HotspotId;
  selector: string;
  label: string;
  // 'inline' → element editor renders in the right panel.
  // 'deep-link' → renders a deep-link card pointing to the Addons tab.
  target: 'inline' | 'deep-link';
}

// Order: most-specific first. Sub-element line-item hotspots MUST come
// before the catch-all 'lineItem' so the per-zone editor wins. Addon zones
// come before the generic footer.
export const HOTSPOTS: ReadonlyArray<Hotspot> = [
  { id: 'checkoutButton',        selector: '.ccd-checkout-btn',           label: 'Checkout Button',  target: 'inline' },
  { id: 'addon.trustBadges',     selector: '.ccd-trust-badges',           label: 'Trust Badges',     target: 'deep-link' },
  { id: 'trustLine',             selector: '.ccd-trust',                  label: 'Trust Line',       target: 'inline' },
  { id: 'addon.notes',           selector: '#ccd-notes-row, .ccd-notes-row',            label: 'Order Notes',      target: 'deep-link' },
  { id: 'addon.discountCode',    selector: '#ccd-discount-code-row, .ccd-discount-row', label: 'Discount Code',    target: 'deep-link' },
  { id: 'addon.termsCheckbox',   selector: '#ccd-terms-row, .ccd-terms-row',            label: 'Terms Checkbox',   target: 'deep-link' },
  { id: 'addon.expressPayments', selector: '.ccd-footer-express-zone, #ccd-express-payments', label: 'Express Payments', target: 'deep-link' },
  { id: 'addon.shippingProtection',    selector: '.ccd-shipping-protection', label: 'Shipping Protection',    target: 'deep-link' },
  { id: 'addon.scarcityTimer',         selector: '#ccd-scarcity-timer',      label: 'Scarcity Timer',         target: 'deep-link' },
  { id: 'addon.lowStockBadge',         selector: '.ccd-scarcity-badge',      label: 'Low Stock Badge',        target: 'deep-link' },
  { id: 'addon.upsellRecommendations', selector: '#ccd-upsell',              label: 'Upsell Recommendations', target: 'deep-link' },
  { id: 'addon.socialProof',           selector: '#ccd-social-proof',        label: 'Social Proof',           target: 'deep-link' },
  { id: 'footer',                selector: '.ccd-sticky-footer',          label: 'Footer',           target: 'inline' },
  // Sub-element line-item hotspots — must precede 'lineItem'.
  { id: 'lineItem.image',        selector: '.ccd-item__image',            label: 'Product Image',    target: 'inline' },
  { id: 'lineItem.name',         selector: '.ccd-item__name',             label: 'Product Name',     target: 'inline' },
  { id: 'lineItem.quantity',     selector: '.ccd-qty',                    label: 'Quantity Control', target: 'inline' },
  { id: 'lineItem.remove',       selector: '.ccd-item__remove',           label: 'Remove Button',    target: 'inline' },
  { id: 'lineItem.price',        selector: '.ccd-item__price-col',        label: 'Price',            target: 'inline' },
  { id: 'lineItem',              selector: '.ccd-item',                   label: 'Line Item',        target: 'inline' },
  { id: 'emptyState',            selector: '.drawer__cart-empty',         label: 'Empty State',      target: 'inline' },
  { id: 'milestoneBar',          selector: '.ccd-progress',               label: 'Milestone Bar',    target: 'inline' },
  { id: 'header',                selector: '.drawer__header',             label: 'Header',           target: 'inline' },
  { id: 'global',                selector: '#CartDrawer',                 label: 'Drawer (Global)',  target: 'inline' },
];

/**
 * Resolve which hotspot is under a given screen point inside the preview
 * container. Pure function — easy to unit-test without a real overlay.
 */
export function resolveHotspotFromPoint(
  previewRoot: HTMLElement | null,
  point: { x: number; y: number },
): Hotspot | null {
  if (!previewRoot) return null;
  const doc = previewRoot.ownerDocument;
  if (!doc) return null;
  const stack = doc.elementsFromPoint(point.x, point.y);
  for (const el of stack) {
    if (!previewRoot.contains(el)) continue;
    for (const hs of HOTSPOTS) {
      const matched = (el as HTMLElement).closest(hs.selector);
      if (matched && previewRoot.contains(matched)) {
        return hs;
      }
    }
  }
  return null;
}

/**
 * Find the actual element matching a hotspot inside the preview root.
 * Used by the selection ring to track a specific hotspot's bounding box.
 *
 * If `hint` is provided AND it lives inside previewRoot, walk UP from the
 * hint to find the closest ancestor matching the hotspot's selector. This
 * lets the selection ring track the SPECIFIC clicked instance (e.g. line
 * item #5) instead of always snapping to the first DOM match (#1).
 *
 * If `hint` is missing, detached, or has no matching ancestor, fall back to
 * `previewRoot.querySelector(selector)` (first match) for backward compat.
 */
export function findHotspotElement(
  previewRoot: HTMLElement | null,
  id: HotspotId,
  hint?: HTMLElement | null,
): HTMLElement | null {
  if (!previewRoot) return null;
  const hs = HOTSPOTS.find((h) => h.id === id);
  if (!hs) return null;
  if (hint && previewRoot.contains(hint)) {
    const ancestor = hint.closest<HTMLElement>(hs.selector);
    if (ancestor && previewRoot.contains(ancestor)) return ancestor;
  }
  return previewRoot.querySelector(hs.selector);
}
