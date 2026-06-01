/**
 * BLAST RADIUS MAP — Cart-editor / Addons preview: lowStockBadge consolidation
 * Target: applyLowStockBadge (NEW shared transform) in
 *         backend/src/app/dashboard/addons/addon-transforms.ts
 *
 * CHANGE (2026-05-29):
 *   The "Low Stock Badge" addon was previously implemented as an inline
 *   `if (addonKey === 'lowStockBadge')` block ONLY inside addon-preview.tsx.
 *   The cart-editor / live storefront paths could not render it at all, so
 *   the /addons preview did not match the live cart when other addons were
 *   focused. We extracted the logic into a shared `applyLowStockBadge` and
 *   wired it into preview-renderer.ts AND the background-render loop in
 *   addon-preview.tsx (so every enabled addon renders, not just the focused
 *   one).
 *
 * CALLERS of applyLowStockBadge:
 *   1) src/app/dashboard/cart-editor/preview-renderer.ts (cart-editor)
 *   2) src/app/dashboard/addons/addon-preview.tsx (addons settings preview —
 *      background-render loop for non-focused addons)
 *
 * LIVE EQUIVALENT: CCD.applyScarcity in extensions/cart-drawer/assets/v14-complete.js
 *
 * SHARED STATE: pure HTML-string transform; no DB / no runtime state.
 *
 * CROSS-PATH RISK:
 *   - Badge markup MUST match v14-complete.js byte-for-byte
 *     (class="ccd-scarcity-badge", same icon SVGs, same {n} substitution,
 *     same `.ccd-qty__btn--locked` when blockAddToCart=true) — otherwise the
 *     preview drifts from the live storefront.
 *   - target='1' selects item #1, target='2' selects item #2, target='last'
 *     selects the last item — preview must mirror live-cart targeting.
 *   - blockAddToCart=true must lock ONLY the targeted item's plus button.
 *   - When target index exceeds item count, must clamp to the last item
 *     (matches live cart behavior).
 */

import { describe, it, expect } from 'vitest';
import { applyLowStockBadge } from '@/app/dashboard/addons/addon-transforms';

// Minimal cart HTML containing 3 items with the structure applyLowStockBadge
// expects (depth-aware item-block parser walks <div class="ccd-item">…</div>).
function makeCartHtml(itemCount = 3): string {
  const items = Array.from({ length: itemCount }, (_, i) => `
    <div class="ccd-item">
      <div class="ccd-item__image"><img src="p${i}.jpg" alt=""></div>
      <div class="ccd-item__details">
        <div class="ccd-item__title-row">
          <a href="#" class="ccd-item__name">Product ${i + 1}</a>
        </div>
        <div class="ccd-item__variant">Variant ${i + 1}</div>
        <div class="ccd-item__bottom">
          <div class="ccd-qty">
            <button type="button" class="ccd-qty__btn ccd-qty__btn--minus">-</button>
            <input type="text" class="ccd-qty__input" value="1">
            <button type="button" class="ccd-qty__btn ccd-qty__btn--plus">+</button>
          </div>
        </div>
      </div>
    </div>`).join('\n');
  return `<div class="cart__items">${items}</div>`;
}

describe('applyLowStockBadge — shared transform', () => {
  it('LOCK: returns input HTML unchanged structurally when no items present', () => {
    const out = applyLowStockBadge('<div>nothing</div>', { mode: 'fake', fakeQty: 2 });
    // Positive: not throw, output is a string
    expect(typeof out).toBe('string');
    // Negative: no scarcity-badge injected when there are no ccd-item blocks
    expect(out).not.toContain('ccd-scarcity-badge');
  });

  it('BUG-FIX: injects badge on target=2 (second item) with fake mode', () => {
    const out = applyLowStockBadge(makeCartHtml(3), {
      mode: 'fake',
      target: '2',
      fakeQty: 1,
      text: 'Only {n} left!',
      icon: 'fire',
      blockAddToCart: true,
    });
    // Positive: badge rendered with substituted {n}
    expect(out).toContain('<span class="ccd-scarcity-badge">');
    expect(out).toContain('Only 1 left!');
    expect(out).toContain('🔥'); // fire icon
    // Negative: must NOT inject onto item #1 — extract item 1's block and assert no badge inside.
    const item1Start = out.indexOf('Product 1</a>');
    const item2Start = out.indexOf('Product 2</a>');
    const item1Slice = out.substring(item1Start, item2Start);
    expect(item1Slice).not.toContain('ccd-scarcity-badge');
  });

  it('LOCK: target=1 selects the first item', () => {
    const out = applyLowStockBadge(makeCartHtml(3), {
      mode: 'fake',
      target: '1',
      fakeQty: 5,
      text: 'Only {n} left!',
      icon: 'fire',
      blockAddToCart: false,
    });
    const item1Start = out.indexOf('Product 1</a>');
    const item2Start = out.indexOf('Product 2</a>');
    const item1Slice = out.substring(item1Start, item2Start);
    // Positive: badge inside item 1
    expect(item1Slice).toContain('ccd-scarcity-badge');
    expect(item1Slice).toContain('Only 5 left!');
    // Negative: item 2 has none
    const item2Slice = out.substring(item2Start);
    expect(item2Slice.split('Product 3</a>')[0]).not.toContain('ccd-scarcity-badge');
  });

  it('LOCK: target=last selects the last item', () => {
    const out = applyLowStockBadge(makeCartHtml(3), {
      mode: 'fake',
      target: 'last',
      fakeQty: 2,
    });
    const item3Start = out.indexOf('Product 3</a>');
    expect(out.substring(item3Start)).toContain('ccd-scarcity-badge');
  });

  it('LOCK: target out-of-range clamps to last item (matches live cart)', () => {
    const out = applyLowStockBadge(makeCartHtml(2), {
      mode: 'fake',
      target: '99', // only 2 items exist
      fakeQty: 1,
    });
    const item2Start = out.indexOf('Product 2</a>');
    expect(out.substring(item2Start)).toContain('ccd-scarcity-badge');
  });

  it('BUG-FIX: blockAddToCart=true locks only the targeted item\'s plus button', () => {
    const out = applyLowStockBadge(makeCartHtml(3), {
      mode: 'fake',
      target: '2',
      fakeQty: 1,
      blockAddToCart: true,
    });
    // Positive: exactly ONE locked plus button (the targeted item)
    const lockedMatches = out.match(/ccd-qty__btn--locked/g) || [];
    expect(lockedMatches.length).toBe(1);
    // Negative: item 1 plus button is NOT locked
    const item1Start = out.indexOf('Product 1</a>');
    const item2Start = out.indexOf('Product 2</a>');
    expect(out.substring(item1Start, item2Start)).not.toContain('ccd-qty__btn--locked');
  });

  it('LOCK: blockAddToCart=false leaves plus buttons unlocked', () => {
    const out = applyLowStockBadge(makeCartHtml(3), {
      mode: 'fake',
      target: '2',
      fakeQty: 1,
      blockAddToCart: false,
    });
    expect(out).not.toContain('ccd-qty__btn--locked');
  });

  it('LOCK: icon=clock renders the clock SVG, not the fire emoji', () => {
    const out = applyLowStockBadge(makeCartHtml(2), {
      mode: 'fake',
      target: '1',
      fakeQty: 1,
      icon: 'clock',
    });
    expect(out).toContain('<svg viewBox="0 0 24 24"');
    expect(out).not.toContain('🔥');
  });

  it('LOCK: auto mode clamps display quantity to min(threshold, 3)', () => {
    const out = applyLowStockBadge(makeCartHtml(2), {
      mode: 'auto',
      target: '1',
      threshold: 10,
      text: 'Only {n} left!',
    });
    // threshold=10 but auto mode clamps to 3
    expect(out).toContain('Only 3 left!');
    expect(out).not.toContain('Only 10 left!');
  });

  it('LOCK: strips any baked-in badge before re-injecting (no duplicates)', () => {
    const dirty = makeCartHtml(2).replace(
      '<div class="ccd-item__variant">Variant 1</div>',
      '<div class="ccd-item__variant">Variant 1</div><span class="ccd-scarcity-badge">STALE</span>'
    );
    const out = applyLowStockBadge(dirty, {
      mode: 'fake',
      target: '2',
      fakeQty: 1,
    });
    expect(out).not.toContain('STALE');
    // Exactly one badge after re-injection
    const matches = out.match(/ccd-scarcity-badge/g) || [];
    expect(matches.length).toBe(1);
  });
});

describe('applyLowStockBadge — preview-renderer integration', () => {
  it('BUG-FIX: preview-renderer wires lowStockBadge so cart-editor matches live', async () => {
    // Verifies the wiring change in preview-renderer.ts: when addons map has
    // lowStockBadge.enabled=true, the rendered HTML must contain the badge.
    const { renderPreview } = await import('@/app/dashboard/cart-editor/preview-renderer');
    const html = renderPreview({
      overrides: {},
      previewState: 'items',
      addons: {
        lowStockBadge: {
          enabled: true,
          config: { mode: 'fake', target: '2', fakeQty: 1, text: 'Only {n} left!', icon: 'fire', blockAddToCart: true },
        },
      },
    });
    // Positive: badge appears
    expect(html).toContain('ccd-scarcity-badge');
    expect(html).toContain('Only 1 left!');
    // Negative: when addon is NOT in the map, no badge appears
    const htmlNoAddon = renderPreview({
      overrides: {},
      previewState: 'items',
      addons: {},
    });
    expect(htmlNoAddon).not.toContain('ccd-scarcity-badge');
  });

  it('LOCK: lowStockBadge.enabled=false does NOT inject the badge', async () => {
    const { renderPreview } = await import('@/app/dashboard/cart-editor/preview-renderer');
    const html = renderPreview({
      overrides: {},
      previewState: 'items',
      addons: { lowStockBadge: { enabled: false, config: { mode: 'fake', target: '1', fakeQty: 1 } } },
    });
    expect(html).not.toContain('ccd-scarcity-badge');
  });
});
