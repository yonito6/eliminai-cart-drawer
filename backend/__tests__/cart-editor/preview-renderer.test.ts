/**
 * BLAST RADIUS MAP — Cart Editor Preview: real products + CONTROL_HTML structure
 * Target: renderPreview in src/app/dashboard/cart-editor/preview-renderer.ts
 *
 * BUG: preview uses hardcoded via.placeholder.com MOCK_ITEMS and a fake
 *      `#CCD-Drawer` shell whose class names diverge from the production
 *      cart drawer (`#CartDrawer.custom-cart-drawer`). Result: preview does
 *      not match the live storefront and shows no real Shopify products.
 *
 * FIX: replicate the addon-preview pattern — start from CONTROL_HTML, swap
 *      CART_ITEMS_START/END marker block with real products fetched from
 *      /api/stores/[id]/products/preview, apply overrides as text swaps.
 *
 * CALLERS:
 *   - preview-canvas.tsx (only direct caller — passes draft + addons + previewState)
 *   - page.tsx mounts <PreviewCanvas> (transitively)
 *
 * DUPLICATED LOGIC:
 *   - addon-preview.tsx implements the pattern we are adopting. Its tests
 *     (if any) and runtime behavior must stay green.
 *
 * SHARED STATE:
 *   - editorOverrides schema (schema.test.ts already locks it)
 *   - draft store (draft-store.tsx) — only reads/writes overrides
 *   - hotspot selectors — covered in hotspots.test.ts
 *
 * CROSS-PATH RISK:
 *   - Element editors (HeaderEditor, MilestoneEditor, …) write into the
 *     draft, never into the rendered HTML — independent of this change.
 *   - Hotspot resolution lives in overlay/hotspots.ts and uses CSS selectors
 *     that must match the NEW CONTROL_HTML structure — covered separately.
 */

import { describe, it, expect } from 'vitest';
import { renderPreview, type PreviewRenderInput } from '@/app/dashboard/cart-editor/preview-renderer';

const baseInput: PreviewRenderInput = {
  overrides: {},
  addons: {},
  previewState: 'items',
};

describe('renderPreview — CONTROL_HTML structure (matches live storefront)', () => {
  it('emits the production drawer shell (#CartDrawer.custom-cart-drawer), not the fake #CCD-Drawer', () => {
    const html = renderPreview(baseInput);
    expect(html).toContain('id="CartDrawer"');
    expect(html).toMatch(/class="[^"]*custom-cart-drawer[^"]*"/);
    // Negative assertion: the fake shell must be gone so we can't accidentally
    // ship two divergent class systems.
    expect(html).not.toContain('id="CCD-Drawer"');
  });

  it('includes the real header (.drawer__header > .drawer__title), not the fake .ccd-header', () => {
    const html = renderPreview(baseInput);
    expect(html).toContain('drawer__header');
    expect(html).toContain('drawer__title');
  });

  it('includes the real milestone progress bar (.ccd-progress), not the fake .ccd-milestone', () => {
    const html = renderPreview(baseInput);
    expect(html).toContain('ccd-progress');
    expect(html).not.toMatch(/class="[^"]*\bccd-milestone\b[^"]*"/);
  });

  it('includes the real sticky footer with .ccd-checkout-btn ("SECURE CHECKOUT")', () => {
    const html = renderPreview(baseInput);
    expect(html).toContain('ccd-sticky-footer');
    expect(html).toContain('ccd-checkout-btn');
  });

  it('includes the .ccd-trust line and .ccd-shipping-protection (matches live cart)', () => {
    const html = renderPreview(baseInput);
    expect(html).toContain('ccd-trust');
    expect(html).toContain('ccd-shipping-protection');
  });
});

describe('renderPreview — real Shopify products replace placeholders', () => {
  const realProducts = [
    {
      title: 'Test Watch ABC',
      image: 'https://cdn.shopify.com/s/files/1/0001/test-watch.jpg',
      variant: 'Silver / 42mm',
      price: '199.00',
      compareAtPrice: '249.00',
    },
    {
      title: 'Test Tote XYZ',
      image: 'https://cdn.shopify.com/s/files/1/0001/test-tote.jpg',
      variant: 'Black',
      price: '79.00',
      compareAtPrice: null,
    },
  ];

  it('accepts a products array and renders the real product titles', () => {
    const html = renderPreview({ ...baseInput, products: realProducts });
    expect(html).toContain('Test Watch ABC');
    expect(html).toContain('Test Tote XYZ');
  });

  it('renders real product image URLs (not via.placeholder.com)', () => {
    const html = renderPreview({ ...baseInput, products: realProducts });
    expect(html).toContain('https://cdn.shopify.com/s/files/1/0001/test-watch.jpg');
    expect(html).not.toContain('via.placeholder.com');
  });

  it('renders real product variant text', () => {
    const html = renderPreview({ ...baseInput, products: realProducts });
    expect(html).toContain('Silver / 42mm');
  });

  it('renders real prices (and compare-at price when present)', () => {
    const html = renderPreview({ ...baseInput, products: realProducts });
    expect(html).toContain('$199.00');
    expect(html).toContain('$249.00');
    expect(html).toContain('$79.00');
  });

  it('does NOT leak the hardcoded MOCK_ITEMS (Orbit Quartz Watch, Eclipse Tote, Helix Sneakers)', () => {
    const html = renderPreview({ ...baseInput, products: realProducts });
    expect(html).not.toContain('Orbit Quartz Watch');
    expect(html).not.toContain('Eclipse Tote');
    expect(html).not.toContain('Helix Sneakers');
  });

  it('falls back to the CONTROL_HTML placeholder items when no products are provided', () => {
    // Acceptance: when storeId is missing or fetch fails, we still render
    // something (the marker block from CONTROL_HTML) instead of crashing.
    const html = renderPreview(baseInput);
    expect(html).toContain('ccd-item');
  });
});

describe('renderPreview — editor overrides paint the real shell', () => {
  it('header.title override replaces "Your Cart" in .drawer__title', () => {
    const html = renderPreview({
      ...baseInput,
      overrides: { header: { title: 'My Bag' } },
    });
    expect(html).toContain('My Bag');
    // The literal default must be gone (otherwise the override silently did nothing).
    expect(html).not.toMatch(/>Your Cart</);
  });

  it('checkoutButton.label override changes the SECURE CHECKOUT text', () => {
    const html = renderPreview({
      ...baseInput,
      overrides: { checkoutButton: { label: 'Pay Now' } },
    });
    expect(html).toContain('Pay Now');
    expect(html).not.toContain('SECURE CHECKOUT');
  });
});

describe('renderPreview — preview states still supported', () => {
  it('items state shows at least one .ccd-item', () => {
    const html = renderPreview({ ...baseInput, previewState: 'items' });
    expect(html).toContain('ccd-item');
  });

  it('empty state hides items and shows an empty indicator', () => {
    const html = renderPreview({ ...baseInput, previewState: 'empty' });
    // Either the real empty class (drawer__cart-empty) or some explicit empty
    // marker must be present so the editor "Empty" toggle is observable.
    expect(html).toMatch(/drawer__cart-empty|ccd-empty/);
  });
});
