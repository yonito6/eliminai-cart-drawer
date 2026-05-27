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
  | 'emptyState'
  | 'footer'
  | 'checkoutButton'
  | 'trustLine'
  | 'global'
  // Addon footer zones — deep-linked to the Addons tab (Chunk 5.5).
  | 'addon.notes'
  | 'addon.discountCode'
  | 'addon.termsCheckbox'
  | 'addon.expressPayments';

export interface Hotspot {
  id: HotspotId;
  selector: string;
  label: string;
  // 'inline' → element editor renders in the right panel.
  // 'deep-link' → renders a deep-link card pointing to the Addons tab.
  target: 'inline' | 'deep-link';
}

// Order: most-specific first. Addon zones come before generic footer.
export const HOTSPOTS: ReadonlyArray<Hotspot> = [
  { id: 'checkoutButton',       selector: '.ccd-checkout-btn',           label: 'Checkout Button', target: 'inline' },
  { id: 'trustLine',             selector: '.ccd-trust-line',              label: 'Trust Line',       target: 'inline' },
  { id: 'addon.notes',           selector: '.ccd-footer-notes-zone',       label: 'Order Notes',      target: 'deep-link' },
  { id: 'addon.discountCode',    selector: '.ccd-footer-discount-zone',    label: 'Discount Code',    target: 'deep-link' },
  { id: 'addon.termsCheckbox',   selector: '.ccd-footer-terms-zone',       label: 'Terms Checkbox',   target: 'deep-link' },
  { id: 'addon.expressPayments', selector: '.ccd-footer-express-zone',     label: 'Express Payments', target: 'deep-link' },
  { id: 'footer',                selector: '.ccd-sticky-footer',           label: 'Footer',           target: 'inline' },
  { id: 'lineItem',              selector: '.ccd-item',                    label: 'Line Item',        target: 'inline' },
  { id: 'emptyState',            selector: '.ccd-empty',                   label: 'Empty State',      target: 'inline' },
  { id: 'milestoneBar',          selector: '.ccd-milestone',               label: 'Milestone Bar',    target: 'inline' },
  { id: 'header',                selector: '.ccd-header',                  label: 'Header',           target: 'inline' },
  { id: 'global',                selector: '#CCD-Drawer',                  label: 'Drawer (Global)',  target: 'inline' },
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
 */
export function findHotspotElement(
  previewRoot: HTMLElement | null,
  id: HotspotId,
): HTMLElement | null {
  if (!previewRoot) return null;
  const hs = HOTSPOTS.find((h) => h.id === id);
  if (!hs) return null;
  return previewRoot.querySelector(hs.selector);
}
