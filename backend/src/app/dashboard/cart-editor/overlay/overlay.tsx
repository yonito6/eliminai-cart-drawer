'use client';

// Editor Overlay — sibling div positioned absolutely above the preview.
// Renders three things:
//  1. Invisible click-catcher that intercepts cursor events over the preview
//  2. Dashed purple hover-halo on whichever hotspot is under the cursor
//  3. Solid purple selection ring on the currently-selected hotspot
//
// The overlay never inserts nodes inside the cart DOM — it's a separate layer
// positioned via getBoundingClientRect() so it survives DOM re-renders that
// happen when the draft store mutates.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDraftStore } from '../draft-store';
import {
  HOTSPOTS,
  Hotspot,
  HotspotId,
  findHotspotElement,
  resolveHotspotFromPoint,
} from './hotspots';

function hotspotSelector(id: HotspotId): string | null {
  return HOTSPOTS.find((h) => h.id === id)?.selector ?? null;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PURPLE = '#7c3aed';

function rectFromEl(el: HTMLElement, host: HTMLElement): Rect | null {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return {
    top: r.top - h.top,
    left: r.left - h.left,
    width: r.width,
    height: r.height,
  };
}

interface OverlayProps {
  // The container that holds the preview AND this overlay as siblings.
  // The overlay positions itself absolutely inside this container.
  hostRef: React.RefObject<HTMLElement | null>;
}

export default function Overlay({ hostRef }: OverlayProps) {
  const router = useRouter();
  const { selectedElementId, selectElement } = useDraftStore();
  const [hovered, setHovered] = useState<Hotspot | null>(null);
  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [selectRect, setSelectRect] = useState<Rect | null>(null);
  const rafRef = useRef<number | null>(null);
  // Remember the exact clicked element (and its index among same-selector
  // siblings) so the selection ring tracks the SPECIFIC instance the user
  // clicked — not the first DOM match. The element ref is used while it
  // remains in the DOM; on re-render it goes stale, and the index ref
  // kicks in as a stable fallback.
  const clickedElRef = useRef<HTMLElement | null>(null);
  const instanceIndexRef = useRef<number>(0);

  // Recompute the selection ring's rect — called on selection change AND on
  // every draft mutation (the preview re-renders, swapping the DOM nodes).
  const updateSelectRect = useCallback(() => {
    const host = hostRef.current;
    if (!host || !selectedElementId) {
      setSelectRect(null);
      return;
    }
    // The preview host is inside the larger overlay host; find the actual
    // preview root element (the one with id="ce-preview-host") to scope
    // hotspot search.
    const previewRoot = host.querySelector<HTMLElement>('#ce-preview-host');
    if (!previewRoot) {
      setSelectRect(null);
      return;
    }
    const hint = clickedElRef.current;
    let el = findHotspotElement(previewRoot, selectedElementId as HotspotId, hint);
    // If the original clicked element was swapped out by a re-render, fall
    // back to the same instance-index so the ring stays on the right row.
    if (instanceIndexRef.current > 0 && (!hint || !previewRoot.contains(hint))) {
      const sel = hotspotSelector(selectedElementId as HotspotId);
      if (sel) {
        const all = previewRoot.querySelectorAll<HTMLElement>(sel);
        const byIdx = all[instanceIndexRef.current];
        if (byIdx) el = byIdx;
      }
    }
    setSelectRect(el ? rectFromEl(el, host) : null);
  }, [hostRef, selectedElementId]);

  // Mousemove → halo rect (rAF-coalesced).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    function onMove(e: MouseEvent) {
      if (rafRef.current != null) return; // already scheduled
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const hostEl = hostRef.current;
        if (!hostEl) return;
        const previewRoot = hostEl.querySelector<HTMLElement>('#ce-preview-host');
        if (!previewRoot) {
          setHovered(null);
          setHoverRect(null);
          return;
        }
        const hs = resolveHotspotFromPoint(previewRoot, { x: e.clientX, y: e.clientY });
        if (!hs) {
          setHovered(null);
          setHoverRect(null);
          return;
        }
        // Find the actual matched element for accurate rect (resolveHotspot
        // returns the hotspot but we need the closest matching element).
        const stack = (hostEl.ownerDocument || document).elementsFromPoint(e.clientX, e.clientY);
        let matched: HTMLElement | null = null;
        for (const el of stack) {
          if (!previewRoot.contains(el)) continue;
          const closest = (el as HTMLElement).closest(hs.selector) as HTMLElement | null;
          if (closest && previewRoot.contains(closest)) {
            matched = closest;
            break;
          }
        }
        setHovered(hs);
        setHoverRect(matched ? rectFromEl(matched, hostEl) : null);
      });
    }

    function onLeave() {
      setHovered(null);
      setHoverRect(null);
    }

    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    return () => {
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [hostRef]);

  // Click → select hotspot, or clear selection if click missed everything.
  // Deep-link hotspots (addon.*) navigate directly to the matching Addons card.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function onClick(e: MouseEvent) {
      const hostEl = hostRef.current;
      if (!hostEl) return;
      const previewRoot = hostEl.querySelector<HTMLElement>('#ce-preview-host');
      if (!previewRoot) return;
      // Only intercept clicks that land inside the preview root.
      const stack = (hostEl.ownerDocument || document).elementsFromPoint(e.clientX, e.clientY);
      const insidePreview = stack.some((el) => previewRoot.contains(el));
      if (!insidePreview) {
        selectElement(null);
        return;
      }
      // Always swallow the click so <a href="#"> wrappers in the cart HTML
      // don't navigate the dashboard URL to "#" on every selection.
      e.preventDefault();
      e.stopPropagation();
      const hs = resolveHotspotFromPoint(previewRoot, { x: e.clientX, y: e.clientY });
      if (hs && hs.target === 'deep-link' && hs.id.startsWith('addon.')) {
        const addonKey = hs.id.slice('addon.'.length);
        router.push(`/dashboard/addons?expand=${encodeURIComponent(addonKey)}`);
        return;
      }
      // Capture the SPECIFIC element under the cursor so the selection ring
      // tracks the clicked instance (line item #5), not the first DOM match.
      if (hs) {
        let matched: HTMLElement | null = null;
        for (const el of stack) {
          if (!previewRoot.contains(el)) continue;
          const ancestor = (el as HTMLElement).closest<HTMLElement>(hs.selector);
          if (ancestor && previewRoot.contains(ancestor)) {
            matched = ancestor;
            break;
          }
        }
        clickedElRef.current = matched;
        if (matched) {
          const siblings = Array.from(
            previewRoot.querySelectorAll<HTMLElement>(hs.selector),
          );
          instanceIndexRef.current = Math.max(0, siblings.indexOf(matched));
        } else {
          instanceIndexRef.current = 0;
        }
      } else {
        clickedElRef.current = null;
        instanceIndexRef.current = 0;
      }
      selectElement(hs ? hs.id : null);
    }
    host.addEventListener('click', onClick, true);
    return () => host.removeEventListener('click', onClick, true);
  }, [hostRef, selectElement, router]);

  // Recompute selection rect on selection change.
  useEffect(() => {
    updateSelectRect();
  }, [updateSelectRect]);

  // Recompute on window resize + scroll + when the preview DOM mutates.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function recompute() {
      updateSelectRect();
    }
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);

    const previewRoot = host.querySelector('#ce-preview-host');
    let mo: MutationObserver | null = null;
    if (previewRoot) {
      mo = new MutationObserver(recompute);
      mo.observe(previewRoot, { childList: true, subtree: true, attributes: true });
    }
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      mo?.disconnect();
    };
  }, [hostRef, updateSelectRect]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none', // halo + ring don't block; click-catcher uses bubble phase
        zIndex: 10,
      }}
    >
      {hoverRect && hovered && hovered.id !== selectedElementId && (
        <div
          style={{
            position: 'absolute',
            top: hoverRect.top - 2,
            left: hoverRect.left - 2,
            width: hoverRect.width + 4,
            height: hoverRect.height + 4,
            border: `2px dashed ${PURPLE}`,
            borderRadius: 6,
            pointerEvents: 'none',
            transition: 'top 0.08s, left 0.08s, width 0.08s, height 0.08s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -22,
              left: 0,
              background: PURPLE,
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
          >
            {hovered.label}
          </span>
        </div>
      )}
      {selectRect && (
        <div
          style={{
            position: 'absolute',
            top: selectRect.top - 3,
            left: selectRect.left - 3,
            width: selectRect.width + 6,
            height: selectRect.height + 6,
            // Dashed border (per design: same language as hover halo, but
            // thicker + halo so the user knows what they're editing).
            border: `3px dashed ${PURPLE}`,
            borderRadius: 6,
            pointerEvents: 'none',
            boxShadow: `0 0 0 4px rgba(124, 58, 237, 0.18)`,
          }}
        />
      )}
    </div>
  );
}
