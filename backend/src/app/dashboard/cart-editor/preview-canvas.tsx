'use client';

// Preview Canvas — mounts the rendered drawer HTML in a non-iframe container.
// Re-renders when draft or previewState changes. Overlays (hover halo + selection
// ring) attach to this container in Chunk 5.3.
//
// Real Shopify products are fetched from /api/stores/[id]/products/preview and
// passed into renderPreview so the editor shows the same products customers see.

import React, { useEffect, useRef, useState } from 'react';
import { useDraftStore } from './draft-store';
import { PreviewState, renderPreview, PREVIEW_CSS, type PreviewProduct } from './preview-renderer';

type Viewport = 'desktop' | 'mobile';

export interface PreviewCanvasProps {
  previewState: PreviewState;
  viewport: Viewport;
  // Addon config — when omitted, the canvas auto-fetches the live demo addon
  // config from /api/stores/[id]/addons so the preview is always synced with
  // what customers see on the storefront.
  addons?: Record<string, any>;
}

export default function PreviewCanvas({ previewState, viewport, addons }: PreviewCanvasProps) {
  const { draft, storeId } = useDraftStore();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState<string>('');
  const [products, setProducts] = useState<PreviewProduct[]>([]);
  const [fetchedAddons, setFetchedAddons] = useState<Record<string, any> | null>(null);

  // Fetch real Shopify products once per storeId — same pattern as addon-preview.tsx.
  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/stores/${storeId}/products/preview?_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.products?.length) setProducts(data.products);
      })
      .catch(() => {});
  }, [storeId]);

  // Fetch live addon config so the preview shows every enabled addon (trust
  // badges, scarcity timer, milestones, shipping protection, upsells, social
  // proof, express payments) exactly as customers see them.
  useEffect(() => {
    if (!storeId) return;
    if (addons !== undefined) return; // explicit override from caller wins
    fetch(`/api/stores/${storeId}/addons?target=demo&_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.addons) setFetchedAddons(data.addons);
      })
      .catch(() => {});
  }, [storeId, addons]);

  // Recompute HTML on every draft / product / addon change. The render is pure
  // + fast (no network), so the < 500ms preview latency budget is easily met.
  const effectiveAddons = addons ?? fetchedAddons ?? undefined;
  useEffect(() => {
    setHtml(renderPreview({ overrides: draft, addons: effectiveAddons, previewState, products }));
  }, [draft, effectiveAddons, previewState, products]);

  const width = viewport === 'mobile' ? 375 : 440;

  return (
    <div
      style={{
        // Parent (overlayHostRef) is `position:relative; overflow:hidden`, NOT
        // a flex container — so `flex:1` was being ignored and the canvas
        // sized to natural content height, clipping the cart bottom. Fill the
        // relative ancestor with absolute positioning so `overflow:auto`
        // actually kicks in and the user can scroll the full-length cart.
        position: 'absolute',
        inset: 0,
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 16px',
        overflow: 'auto',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
      {/*
       * Scoped override: the live drawer is height:100vh which overflows the
       * dashboard preview area and clips the sticky footer (checkout button,
       * trust line). Inside the editor we anchor it to the preview host so the
       * internal flex layout puts the footer at the bottom and the items area
       * scrolls internally — same visual behaviour as the live cart drawer,
       * just sized for the editor canvas instead of the storefront viewport.
       */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Editor-scoped: let the drawer grow to its NATURAL height instead of
         * being clipped to the viewport. The parent canvas (flex:1; overflow:auto)
         * scrolls so the user can see the entire cart end-to-end — exactly what
         * customers see, no clipped checkout/footer. */
        #ce-preview-host .custom-cart-drawer {
          position: relative !important;
          height: auto !important;
          max-height: none !important;
          min-height: 0 !important;
          max-width: 100% !important;
          right: auto !important;
          top: auto !important;
          left: auto !important;
          bottom: auto !important;
          transform: none !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08) !important;
          border-radius: 12px !important;
          overflow: visible !important;
        }
        #ce-preview-host .drawer__contents { height: auto !important; overflow: visible !important; }
        #ce-preview-host .drawer__inner { flex: none !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
        #ce-preview-host .drawer__scrollable { flex: none !important; height: auto !important; max-height: none !important; overflow: visible !important; }
        #ce-preview-host .drawer__fixed-header { position: static !important; }
        #ce-preview-host .ccd-sticky-footer { position: static !important; }
      ` }} />
      <div
        ref={hostRef}
        id="ce-preview-host"
        style={{ width, transition: 'width 0.2s' }}
        // Direct HTML mount mirrors how v14 renders into the storefront DOM.
        // Trusted source: renderPreview escapes all user-provided strings.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
