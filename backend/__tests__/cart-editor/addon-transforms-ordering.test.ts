/**
 * BLAST RADIUS MAP — Cart-editor / Addons preview: milestone-bar vs scarcity-timer ordering
 * Target: applyFreeShippingBar (default position branch) + applyScarcityTimer
 *         in backend/src/app/dashboard/addons/addon-transforms.ts
 *
 * BUG (reported 2026-05-28):
 *   In the cart-editor preview the scarcity-timer renders ABOVE the milestone
 *   (reward-tier) progress bar, but on the LIVE Eliminai storefront the timer
 *   renders BELOW the milestone. The two surfaces drifted apart visually.
 *
 * ROOT CAUSE:
 *   LIVE storefront shell (extensions/cart-drawer/assets/v14-complete.js
 *   line ~702): `.ccd-progress` is rendered INSIDE `.ccd-fixed-header` as a
 *   sibling AFTER `.ccd-header`. The scarcity-timer with default position
 *   `below-header` inserts BEFORE `.ccd-inner`, so the milestone (in fixed-
 *   header) naturally sits ABOVE the timer.
 *
 *   In the cart-editor / addons preview, CONTROL_HTML originally has the same
 *   structure (`<ccd-progress>` inside `<drawer__fixed-header>`), but
 *   `applyFreeShippingBar` STRIPS the original `.ccd-progress` and then with
 *   its default position `above-items` RE-INJECTS the new milestone right
 *   before `<div class="cart__items">` — which lives INSIDE `<div class="drawer__inner">`.
 *   `applyScarcityTimer` then inserts the timer BEFORE `<div class="drawer__inner"`.
 *   Net effect: fixed-header → TIMER → drawer__inner(milestone → items). Timer
 *   ends up ABOVE the milestone — opposite of LIVE.
 *
 * FIX:
 *   When `applyFreeShippingBar` is called without an explicit `position`,
 *   re-inject the milestone at the same byte index where the original
 *   `.ccd-progress` lived (inside `.drawer__fixed-header`). This preserves
 *   the LIVE storefront ordering. Callers that pass an explicit position
 *   (`header`, `below-items`, `above-items`) keep their existing behavior.
 *
 * CALLERS of applyFreeShippingBar / applyScarcityTimer:
 *   1) src/app/dashboard/cart-editor/preview-renderer.ts (cart-editor)
 *   2) src/app/dashboard/addons/addon-preview.tsx (addons settings preview)
 *
 * SHARED STATE: pure HTML-string transforms; no DB / no runtime state.
 *
 * CROSS-PATH RISK:
 *   - Both renderers must agree because they share the same module — that is
 *     the point of consolidating into addon-transforms.ts.
 *   - Changing the default injection point must NOT break the explicit
 *     `position: 'above-items' | 'header' | 'below-items'` paths.
 *   - Must NOT break the existing test "includes the real milestone progress
 *     bar (.ccd-progress)" in preview-renderer.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  applyFreeShippingBar,
  applyScarcityTimer,
} from '@/app/dashboard/addons/addon-transforms';
import { CONTROL_HTML } from '@/app/dashboard/cart-constants';

const baseShell = () => CONTROL_HTML.replace(/\r\n/g, '\n');

const sampleTiers = [
  { id: 't1', goal: 80, label: 'Free shipping', icon: 'shipping', beforeText: 'Add {remaining} more', afterText: '' },
  { id: 't2', goal: 150, label: '2+1 FREE', icon: 'tag', beforeText: '', afterText: '' },
];

function indexOfDataCcdProgress(html: string): number {
  // The new bar is emitted with data-ccd-progress; the stripped legacy one
  // had no such attribute, so this index pinpoints the NEW milestone.
  return html.indexOf('data-ccd-progress');
}

function indexOfScarcityTimer(html: string): number {
  return html.indexOf('id="ccd-scarcity-timer"');
}

function indexOfCartItems(html: string): number {
  return html.indexOf('<div class="cart__items"');
}

function indexOfFixedHeaderOpen(html: string): number {
  return html.indexOf('<div class="drawer__fixed-header">');
}

function indexOfDrawerInnerOpen(html: string): number {
  return html.indexOf('<div class="drawer__inner"');
}

// ──────────────────────────────────────────────────────────────────────────
// LOCK tests — explicit positions must keep working exactly as before.
// ──────────────────────────────────────────────────────────────────────────

describe('LOCK: applyFreeShippingBar respects explicit position overrides', () => {
  // NOTE: 'above-items' (the legacy default) is INTENTIONALLY changed by this
  // fix to mirror the LIVE storefront: milestone re-injected at the original
  // .ccd-progress byte location (inside .drawer__fixed-header). This matches
  // v14-complete.js LIVE shell. See RED tests below.
  it('position="above-items" injects the milestone at the ORIGINAL .ccd-progress location (inside .drawer__fixed-header) to mirror LIVE', () => {
    const html = applyFreeShippingBar(baseShell(), { tiers: sampleTiers, position: 'above-items' });
    const headerOpen = indexOfFixedHeaderOpen(html);
    const innerOpen = indexOfDrawerInnerOpen(html);
    const ms = indexOfDataCcdProgress(html);
    expect(ms).toBeGreaterThan(-1);
    // Milestone sits BETWEEN fixed-header open and drawer__inner open
    // (i.e. INSIDE fixed-header), matching the LIVE v14-complete.js shell.
    expect(ms).toBeGreaterThan(headerOpen);
    expect(ms).toBeLessThan(innerOpen);
  });

  it('LOCK: position="header" injects the milestone immediately after <div class="drawer__fixed-header">', () => {
    const html = applyFreeShippingBar(baseShell(), { tiers: sampleTiers, position: 'header' });
    const headerOpen = indexOfFixedHeaderOpen(html);
    const ms = indexOfDataCcdProgress(html);
    expect(ms).toBeGreaterThan(headerOpen);
    // Sanity: still strictly before the drawer__inner
    expect(ms).toBeLessThan(indexOfDrawerInnerOpen(html));
  });

  it('LOCK: position="below-items" injects the milestone INSIDE the .ccd-sticky-footer container (right after its opening tag)', () => {
    const html = applyFreeShippingBar(baseShell(), { tiers: sampleTiers, position: 'below-items' });
    const ms = indexOfDataCcdProgress(html);
    const footer = html.indexOf('<div class="ccd-sticky-footer">');
    expect(ms).toBeGreaterThan(-1);
    expect(footer).toBeGreaterThan(-1);
    // Current implementation prepends rewardsHtml AFTER the footer opening
    // tag (so it sits at the very top of the sticky-footer area, above the
    // checkout button). Assert that ordering explicitly.
    expect(ms).toBeGreaterThan(footer);
    // Sanity: still after the cart items area
    expect(ms).toBeGreaterThan(indexOfCartItems(html));
  });

  it('LOCK: applyScarcityTimer default position injects before <div class="drawer__inner"', () => {
    const html = applyScarcityTimer(baseShell(), { text: 'Reserved {time}', duration: 10 });
    const timer = indexOfScarcityTimer(html);
    const innerOpen = indexOfDrawerInnerOpen(html);
    expect(timer).toBeGreaterThan(-1);
    expect(innerOpen).toBeGreaterThan(-1);
    expect(timer).toBeLessThan(innerOpen);
  });

  it('LOCK: applyScarcityTimer position="above-checkout" still inserts directly before the checkout button', () => {
    const html = applyScarcityTimer(baseShell(), { text: 'Reserved {time}', position: 'above-checkout' });
    const timer = indexOfScarcityTimer(html);
    const checkout = html.indexOf('<button type="button" class="ccd-checkout-btn">');
    expect(timer).toBeGreaterThan(-1);
    expect(checkout).toBeGreaterThan(-1);
    expect(timer).toBeLessThan(checkout);
    // And the diff should be tiny — they are adjacent
    expect(checkout - timer).toBeLessThan(500);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// LOCK: stripping the original .ccd-progress must still work.
// ──────────────────────────────────────────────────────────────────────────

describe('LOCK: original .ccd-progress is always stripped before re-injection', () => {
  it('the legacy hardcoded .ccd-progress (with progress__line--first) is gone after applyFreeShippingBar', () => {
    const html = applyFreeShippingBar(baseShell(), { tiers: sampleTiers });
    expect(html).not.toContain('ccd-progress__line--first');
    expect(html).not.toContain('ccd-progress__line--second');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RED: default (no `position`) must put milestone ABOVE scarcity-timer,
//      matching the LIVE Eliminai storefront shell.
// ──────────────────────────────────────────────────────────────────────────

describe('BUG: default ordering — milestone (free-shipping bar) must render ABOVE the scarcity timer', () => {
  it('with no position config, applyFreeShippingBar puts milestone INSIDE .drawer__fixed-header (matches v14-complete.js LIVE shell)', () => {
    const html = applyFreeShippingBar(baseShell(), { tiers: sampleTiers });
    const headerOpen = indexOfFixedHeaderOpen(html);
    // The next <div class="drawer__inner" opening is the close-boundary of fixed-header
    const innerOpen = indexOfDrawerInnerOpen(html);
    const ms = indexOfDataCcdProgress(html);
    expect(headerOpen).toBeGreaterThan(-1);
    expect(innerOpen).toBeGreaterThan(-1);
    expect(ms).toBeGreaterThan(-1);
    // Milestone must sit between the fixed-header open and the drawer__inner open
    // → i.e. INSIDE the fixed-header (mirroring LIVE shell line 702 in v14-complete.js)
    expect(ms).toBeGreaterThan(headerOpen);
    expect(ms).toBeLessThan(innerOpen);
  });

  it('rendered together with default scarcity-timer, milestone is ABOVE timer (matches LIVE)', () => {
    let html = baseShell();
    html = applyFreeShippingBar(html, { tiers: sampleTiers });
    html = applyScarcityTimer(html, { text: 'Cart reserved for {time}', duration: 10 });
    const ms = indexOfDataCcdProgress(html);
    const timer = indexOfScarcityTimer(html);
    expect(ms).toBeGreaterThan(-1);
    expect(timer).toBeGreaterThan(-1);
    // POSITIVE: milestone strictly before timer
    expect(ms).toBeLessThan(timer);
    // NEGATIVE: timer must NOT be above milestone (the bug)
    expect(timer).toBeGreaterThan(ms);
  });

  it('order-of-application does not matter — timer first then milestone produces same ordering', () => {
    let html = baseShell();
    html = applyScarcityTimer(html, { text: 'Cart reserved for {time}', duration: 10 });
    html = applyFreeShippingBar(html, { tiers: sampleTiers });
    const ms = indexOfDataCcdProgress(html);
    const timer = indexOfScarcityTimer(html);
    expect(ms).toBeLessThan(timer);
  });
});
