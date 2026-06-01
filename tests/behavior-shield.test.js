#!/usr/bin/env node
/**
 * Behavior Shield Tests — Comprehensive visual/structural behavior protection
 *
 * These tests verify EVERY visible behavior of the cart drawer stays intact.
 * The existing contract.test.js covers logic (protection, gifts, pricing).
 * The existing bug-regression.test.js covers specific reported bugs.
 * THIS file covers everything else — DOM structure, CSS rules, visual states,
 * mobile responsiveness, theme compatibility, animations, and component integrity.
 *
 * Born from 2026-04-18 triple incident: white invisible text, duplicate trust
 * badges, and milestone flash — all caused by Liquid/JS mismatch that no
 * existing test caught.
 *
 * Usage:
 *   node tests/behavior-shield.test.js                    # Test local v14-complete.js
 *   node tests/behavior-shield.test.js --file path/to.js  # Test specific file
 *
 * Run BEFORE every upload alongside contract.test.js and bug-regression.test.js.
 */

var fs = require('fs');
var path = require('path');

var args = process.argv.slice(2);
var fileIdx = args.indexOf('--file');
var customFile = fileIdx > -1 ? args[fileIdx + 1] : null;

var passed = 0;
var failed = 0;
var failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (err) {
    failed++;
    failures.push({ name: name, error: err.message });
    console.log('  \u2717 ' + name);
    console.log('    ' + err.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(code, pattern, message) {
  if (!code.includes(pattern)) {
    throw new Error(message + '\n    Missing: "' + pattern.substring(0, 100) + '"');
  }
}

function assertNotContains(code, pattern, message) {
  if (code.includes(pattern)) {
    throw new Error(message + '\n    Found: "' + pattern.substring(0, 100) + '"');
  }
}

function assertRegex(code, regex, message) {
  if (!regex.test(code)) {
    throw new Error(message + '\n    Pattern not found: ' + regex);
  }
}

function countOccurrences(code, pattern) {
  var count = 0;
  var pos = 0;
  while ((pos = code.indexOf(pattern, pos)) !== -1) {
    count++;
    pos += pattern.length;
  }
  return count;
}

// Extract CSS section (everything in s.textContent = '...')
function extractCSS(code) {
  var start = code.indexOf("s.textContent = '");
  if (start === -1) start = code.indexOf("s.textContent = \"");
  if (start === -1) return '';
  var end = code.indexOf("// Remove any existing external CSS", start);
  if (end === -1) end = code.indexOf("document.head.appendChild(s)", start);
  return code.substring(start, end);
}

function run() {
  var filePath = customFile || path.resolve(__dirname, '..', 'v14-complete.js');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  var code = fs.readFileSync(filePath, 'utf8');
  var css = extractCSS(code);

  console.log('\nBehavior Shield Tests \u2014 ' + path.basename(filePath) + ' (' + code.length + ' bytes)');
  console.log('='.repeat(60));

  // ================================================================
  // SECTION 1: DRAWER POSITIONING & LAYOUT
  // The drawer must be fixed to the right edge, full height, correct z-index
  // ================================================================
  console.log('\n--- Drawer Positioning & Layout ---');

  test('SHIELD-001: Drawer is position:fixed', function() {
    assertContains(css, '#CCD-Drawer { position: fixed !important', 'Drawer must be position:fixed');
  });

  test('SHIELD-002: Drawer is pinned to right edge', function() {
    assertContains(css, 'right: 0 !important', 'Drawer must be right:0');
    assertContains(css, 'top: 0 !important', 'Drawer must be top:0');
  });

  test('SHIELD-003: Drawer z-index is 9999', function() {
    assertContains(css, 'z-index: 9999 !important', 'Drawer must have z-index:9999');
  });

  test('SHIELD-004: Drawer has max-width 380px (mobile default)', function() {
    assertContains(css, 'max-width: 380px !important', 'Default max-width must be 380px');
  });

  test('SHIELD-005: Drawer uses 100dvh for full height', function() {
    assertContains(css, '100dvh', 'Drawer must use dvh for dynamic viewport height');
  });

  test('SHIELD-006: Drawer slides in from right (translateX)', function() {
    assertContains(css, 'transform: translateX(100%) !important', 'Closed state must be translateX(100%)');
    assertContains(css, 'transform: translateX(0) !important', 'Open state must be translateX(0)');
  });

  test('SHIELD-007: Drawer has smooth open animation', function() {
    assertContains(css, 'transition: transform 0.35s cubic-bezier', 'Must have cubic-bezier slide transition');
  });

  test('SHIELD-008: Open drawer has box-shadow', function() {
    assertContains(css, '.ccd-open { display: flex', 'Open state must be display:flex');
    assertContains(css, 'box-shadow:', 'Open drawer must have box-shadow');
  });

  // ================================================================
  // SECTION 2: HEADER — Title + Close Button
  // ================================================================
  console.log('\n--- Header Structure ---');

  test('SHIELD-009: Header has flex layout with space-between', function() {
    assertContains(css, '.ccd-header { display: flex !important', 'Header must be display:flex');
    assertContains(css, 'justify-content: space-between', 'Header must be space-between');
  });

  test('SHIELD-010: Title font-size is 22px and bold', function() {
    assertContains(css, '.ccd-title { font-size: 22px !important', 'Title must be 22px');
    assertContains(css, 'font-weight: 700', 'Title must be bold (700)');
  });

  test('SHIELD-011: Title color is dark (#111)', function() {
    assertContains(css, ".ccd-title { font-size: 22px !important; font-weight: 700 !important; color: #111", 'Title must be dark color #111');
  });

  test('SHIELD-012: Close button is an X SVG with stroke', function() {
    assertContains(code, 'aria-label="Close cart"', 'Close button must have aria-label');
    assertContains(code, '<line x1="18" y1="6" x2="6" y2="18"/>', 'Close button must have X SVG lines');
  });

  test('SHIELD-013: Close button has no background', function() {
    assertContains(css, '.ccd-close-btn { background: none', 'Close button must have transparent background');
  });

  test('SHIELD-014: Header uses configurable title', function() {
    assertContains(code, "CFG.cartTitle || 'Your cart'", 'Title must use CFG.cartTitle with fallback');
  });

  // ================================================================
  // SECTION 3: EMPTY CART STATE
  // ================================================================
  console.log('\n--- Empty Cart State ---');

  test('SHIELD-015: Empty cart text is dark color (#111), NOT white', function() {
    assertContains(css, '.ccd-cart-empty, #CCD-Drawer .ccd-empty { color: #111', 'Empty cart must use dark text #111');
    assertNotContains(css, '.ccd-cart-empty, #CCD-Drawer .ccd-empty { color: #fff', 'Empty cart must NOT use white text');
  });

  test('SHIELD-015b: Empty cart <p> has inline color:#111 (theme override protection)', function() {
    assertContains(code, 'color:#111;font-size:15px', 'Empty cart <p> must have inline dark color to prevent theme override');
  });

    test('SHIELD-016: Empty cart has shopping bag SVG icon', function() {
    assertContains(code, 'fill="#bbb"', 'Empty cart SVG must have light gray fill (#bbb)');
    assertContains(code, "width=\"48\" height=\"48\"", 'Empty cart SVG must be 48x48');
  });

  test('SHIELD-017: Empty cart has Continue Shopping button', function() {
    assertContains(code, 'ccd-continue-btn', 'Must have continue-btn class');
    assertContains(code, "CFG.continueShoppingText || 'Continue Shopping'", 'Continue Shopping must use config with fallback');
  });

  test('SHIELD-018: Continue Shopping button is dark with white text', function() {
    assertContains(css, '.ccd-continue-btn { background: #111', 'Continue btn must be dark background');
    assertContains(css, '.ccd-continue-btn { background: #111 !important; color: #fff', 'Continue btn must have white text');
  });

  test('SHIELD-019: Empty cart hidden by default, shown via ccd-show class', function() {
    assertContains(css, '.ccd-cart-empty.ccd-show, #CCD-Drawer .ccd-empty.ccd-show { display: flex', 'Empty cart must show via ccd-show class');
  });

  test('SHIELD-020: Empty cart text uses config fallback', function() {
    assertContains(code, "CFG.emptyCartText || 'Your cart is empty'", 'Must use CFG.emptyCartText with fallback');
  });

  // ================================================================
  // SECTION 4: TRUST BADGES
  // ================================================================
  console.log('\n--- Trust Badges ---');

  test('SHIELD-021: Trust section has return policy text', function() {
    assertContains(code, "CFG.trustText || '<strong>30 day</strong> risk free returns'", 'Trust text must use config with fallback');
  });

  test('SHIELD-022: Trust badges include all 7 payment methods', function() {
    assertContains(code, 'PayPal', 'Must include PayPal badge');
    assertContains(code, 'VISA', 'Must include VISA badge');
    assertContains(code, 'AMEX', 'Must include AMEX badge');
    assertContains(code, 'DISC', 'Must include Discover badge');
    // MC is an SVG with circles, not text
    assertContains(code, 'ccd-badge--mc', 'Must include Mastercard badge');
    assertContains(code, '>Pay<', 'Must include Apple Pay badge');
    assertContains(code, '>GPay<', 'Must include Google Pay badge');
  });

  test('SHIELD-023: Trust badge SVGs are colored (#6BA4E8)', function() {
    assertContains(css, ".ccd-trust svg { width: 18px !important; height: 18px !important; fill: #6BA4E8", 'Trust SVGs must be blue #6BA4E8');
  });

  test('SHIELD-024: Trust badge container is centered', function() {
    assertContains(css, '.ccd-trust-icons { display: flex !important; align-items: center !important; justify-content: center', 'Trust icons must be centered flex');
  });

  test('SHIELD-025: Liquid-rendered trust badges inside #CartDrawer are hidden', function() {
    assertContains(css, '#CartDrawer .ccd-trust', 'Must hide Liquid ccd-trust inside #CartDrawer');
    assertContains(code, "#CartDrawer .ccd-trust", 'CSS must suppress Liquid trust badges');
  });

  // ================================================================
  // SECTION 5: PROGRESS BAR / MILESTONES
  // ================================================================
  console.log('\n--- Progress Bar & Milestones ---');

  test('SHIELD-026: Progress bar has milestone icons (44x44 circles)', function() {
    assertContains(css, '.ccd-progress__icon { width: 44px !important; height: 44px !important; border-radius: 50%', 'Milestone icons must be 44px circles');
  });

  test('SHIELD-027: Reached milestones have dark background', function() {
    assertContains(css, '.ccd-progress__icon--reached { background: var(--ccd-progress-fill, #111)', 'Reached icons must default to dark #111 (overridable via --ccd-progress-fill)');
  });

  test('SHIELD-028: Progress line fills with animation', function() {
    assertContains(css, '.ccd-progress__line--filled::after { transform: scaleX(1)', 'Filled line must scaleX(1)');
    assertContains(css, 'transform-origin: left', 'Progress fill must animate from left');
  });

  test('SHIELD-029: Progress has instant mode (no animation on cart open)', function() {
    assertContains(css, '.ccd-progress--instant .ccd-progress__line::after { transition: none', 'Instant mode must disable line transition');
    assertContains(css, '.ccd-progress--instant .ccd-progress__icon { transition: none', 'Instant mode must disable icon transition');
  });

  test('SHIELD-030: Milestone pulse animation exists', function() {
    assertContains(css, '@keyframes ccdMilestonePulse', 'Must have milestone pulse animation');
    assertContains(css, '.ccd-progress__icon--reached { animation: ccdMilestonePulse', 'Reached icons must pulse');
  });

  test('SHIELD-031: Progress bar hidden by default (shown dynamically)', function() {
    assertContains(code, "data-ccd-progress style=\"display:none\"", 'Progress bar must start hidden');
  });

  test('SHIELD-032: Liquid progress bar and animations suppressed', function() {
    assertContains(css, '#CartDrawer .ccd-progress', 'Must hide Liquid progress inside #CartDrawer');
    assertContains(css, '#CartDrawer .appear-animation', 'Must suppress Liquid appear-animation inside #CartDrawer');
  });

  test('SHIELD-032b: updateProgress does NOT show progress bar on empty cart', function() {
    assertContains(code, 'currentValue === 0', 'updateProgress must check for zero items before showing bar');
    assertContains(code, 'currentValue > 0', 'updateProgress must only show progress bar when items exist');
  });

  // ================================================================
  // SECTION 6: CART ITEMS — Layout & Styling
  // ================================================================
  console.log('\n--- Cart Item Layout ---');

  test('SHIELD-033: Cart items are flex with 16px gap', function() {
    assertContains(css, '.ccd-item { display: flex !important; gap: 16px', 'Items must be flex with 16px gap');
  });

  test('SHIELD-034: Item images are 120px wide', function() {
    assertContains(css, '.ccd-item__image { width: 120px !important; min-width: 120px', 'Item images must be 120px');
  });

  test('SHIELD-035: Item images have rounded corners', function() {
    assertContains(css, '.ccd-item__image { width: 120px !important; min-width: 120px !important; border-radius: 8px', 'Item images must have 8px border-radius');
  });

  test('SHIELD-036: Item name is uppercase with letter-spacing', function() {
    assertContains(css, '.ccd-item__name { font-size: 14px !important; font-weight: 700 !important; color: #111 !important; text-transform: uppercase', 'Item name must be uppercase bold');
  });

  test('SHIELD-037: Item variant text is small and muted', function() {
    assertContains(css, '.ccd-item__variant { font-size: 11px !important; color: #888', 'Variant must be small and gray');
  });

  test('SHIELD-038: Item remove button is subtle (no background)', function() {
    assertContains(css, '.ccd-item__remove { background: none', 'Remove button must have no background');
    assertContains(css, '.ccd-item__remove:hover { color: #333', 'Remove hover must darken');
  });

  test('SHIELD-039: Items separated by bottom border', function() {
    assertContains(css, '.ccd-item { display: flex !important; gap: 16px !important; padding: 18px 0 !important; border-bottom: 1px solid #eee', 'Items must have bottom border');
  });

  test('SHIELD-040: Last item has no bottom border', function() {
    assertContains(css, '.ccd-item:last-child { border-bottom: none', 'Last item must have no border');
  });

  // ================================================================
  // SECTION 7: QUANTITY CONTROLS
  // ================================================================
  console.log('\n--- Quantity Controls ---');

  test('SHIELD-041: Qty buttons are 36x36', function() {
    assertContains(css, '.ccd-qty__btn { width: 36px !important; height: 36px', 'Qty buttons must be 36px');
  });

  test('SHIELD-042: Qty input hides spinner arrows', function() {
    assertContains(css, '-moz-appearance: textfield', 'Must hide Firefox spinner');
    assertContains(css, '-webkit-appearance: none', 'Must hide Webkit spinner');
  });

  test('SHIELD-043: Qty has bordered container', function() {
    assertContains(css, '.ccd-qty { display: flex !important; align-items: center !important; border: 1px solid #ddd', 'Qty container must have border');
  });

  test('SHIELD-044: Qty buttons have hover state', function() {
    assertContains(css, ".ccd-qty__btn:hover { background: #f5f5f5", 'Qty buttons must have hover state');
  });

  test('SHIELD-045: Qty has pulse animation on change', function() {
    assertContains(css, '.ccd-qty__input--pulse', 'Must have pulse class for qty change');
    assertContains(css, '@keyframes ccdPulse', 'Must have pulse keyframe');
  });

  test('SHIELD-046: Locked qty button (gift items) is dimmed', function() {
    assertContains(css, '.ccd-qty__btn--locked { opacity: 0.3', 'Locked qty must be dimmed');
    assertContains(css, 'pointer-events: none', 'Locked qty must be non-interactive');
  });

  // ================================================================
  // SECTION 8: CHECKOUT BUTTON & STICKY FOOTER
  // ================================================================
  console.log('\n--- Checkout Button & Footer ---');

  test('SHIELD-047: Footer is sticky (flex-shrink:0)', function() {
    assertContains(css, '.ccd-sticky-footer { flex-shrink: 0', 'Footer must not shrink');
  });

  test('SHIELD-048: Footer has top border', function() {
    assertContains(css, '.ccd-sticky-footer { flex-shrink: 0 !important; padding: 0 20px 10px !important; border-top: 1px solid #eee', 'Footer must have top border');
  });

  test('SHIELD-049: Checkout button is full width with dark background', function() {
    assertContains(css, '.ccd-checkout-btn { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; width: 100%', 'Checkout must be full width centered');
    assertContains(css, 'background: #111 !important; color: #fff', 'Checkout must be dark bg white text');
  });

  test('SHIELD-050: Checkout button is uppercase with letter-spacing', function() {
    assertContains(css, 'text-transform: uppercase !important; cursor: pointer', 'Checkout must be uppercase');
  });

  test('SHIELD-051: Checkout button has lock icon SVG', function() {
    assertContains(code, 'ccd-checkout-btn', 'Must have checkout button class');
    // The lock icon path
    assertContains(code, 'M18 8h-1V6c0-2.76', 'Checkout must have lock icon SVG path');
  });

  test('SHIELD-052: Checkout shows price in span.ccd-checkout-total', function() {
    assertContains(code, '<span class="ccd-checkout-total" data-subtotal>', 'Checkout must have price span');
  });

  test('SHIELD-053: Checkout text uses config', function() {
    assertContains(code, "CFG.checkoutText || 'SECURE CHECKOUT'", 'Checkout text must use config with fallback');
  });

  test('SHIELD-054: Footer hidden by default for empty cart', function() {
    assertContains(code, 'data-ccd-footer style="display:none"', 'Footer must start hidden');
  });

  // ================================================================
  // SECTION 9: OVERLAY / BACKDROP
  // ================================================================
  console.log('\n--- Overlay & Backdrop ---');

  test('SHIELD-055: Overlay z-index is 9998 (below drawer)', function() {
    assertContains(css, '.ccd-overlay { display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.4) !important; z-index: 9998', 'Overlay must be z-9998 with semi-transparent black');
  });

  test('SHIELD-056: Overlay starts invisible', function() {
    assertContains(css, '.ccd-overlay {', 'Must have overlay CSS');
    assertContains(css, 'opacity: 0 !important; transition: opacity 0.35s', 'Overlay must fade in');
  });

  test('SHIELD-057: Visible overlay enables pointer events', function() {
    assertContains(css, '.ccd-overlay--visible { opacity: 1 !important; pointer-events: auto', 'Visible overlay must be interactive');
  });

  test('SHIELD-058: Overlay click closes drawer', function() {
    assertContains(code, "overlay.addEventListener('click', function() { CCD.closeDrawer(); })", 'Overlay click must close drawer');
  });

  // ================================================================
  // SECTION 10: SCROLLABLE AREA
  // ================================================================
  console.log('\n--- Scrollable Area ---');

  test('SHIELD-059: Scrollable area has overflow-y:auto', function() {
    assertContains(css, '.ccd-scrollable { flex: 1 1 0% !important; overflow-y: auto', 'Scrollable must be overflow-y:auto');
  });

  test('SHIELD-060: Scrollable has custom scrollbar', function() {
    assertContains(css, '.ccd-scrollable::-webkit-scrollbar { width: 6px', 'Must have thin scrollbar');
    assertContains(css, '.ccd-scrollable::-webkit-scrollbar-thumb { background: #bbb', 'Must have gray scrollbar thumb');
  });

  test('SHIELD-061: Bottom fade gradient exists', function() {
    assertContains(css, '.ccd-inner::after { content: ""', 'Must have fade gradient pseudo-element');
    assertContains(css, 'linear-gradient(to top,', 'Must use linear gradient for fade');
    assertContains(css, 'pointer-events: none', 'Gradient must not block clicks');
  });

  test('SHIELD-062: Fade gradient hides when scrolled to bottom', function() {
    assertContains(css, '.ccd-inner.scrolled-bottom::after { opacity: 0', 'Gradient must hide at bottom');
  });

  // ================================================================
  // SECTION 11: SHIPPING PROTECTION TOGGLE
  // ================================================================
  console.log('\n--- Shipping Protection Toggle ---');

  test('SHIELD-063: Toggle is 40x22px', function() {
    assertContains(css, '.ccd-toggle { position: relative !important; width: 40px !important; height: 22px', 'Toggle must be 40x22');
  });

  test('SHIELD-064: Toggle slider has round knob', function() {
    assertContains(css, ".ccd-toggle__slider:before { position: absolute", 'Toggle must have knob');
    assertContains(css, 'border-radius: 50%', 'Knob must be circular');
  });

  test('SHIELD-065: Checked toggle is dark', function() {
    assertContains(css, '.ccd-toggle input:checked + .ccd-toggle__slider { background: #111', 'Checked toggle must be dark');
  });

  test('SHIELD-066: Instant class suppresses transition', function() {
    assertContains(css, '.ccd-toggle--instant { transition: none', 'Instant class must kill transition');
  });

  test('SHIELD-067: Protection section has shield icon', function() {
    assertContains(code, 'ccd-shipping-protection__icon', 'Must have protection icon wrapper');
    // Shield SVG path
    assertContains(code, 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12', 'Must have shield SVG path (half-filled shield from preview)');
  });

  test('SHIELD-068: Protection title and desc use config', function() {
    assertContains(code, "CFG.protectionTitle || 'Shipping Protection'", 'Protection title must use config');
    assertContains(code, "CFG.protectionDesc || 'Against loss, theft & damage'", 'Protection desc must use config');
  });

  // ================================================================
  // SECTION 12: GIFT ITEMS
  // ================================================================
  console.log('\n--- Gift Item Display ---');

  test('SHIELD-069: Gift items have dashed top border', function() {
    assertContains(css, '.ccd-gift-item { border-top: 1px dashed #ddd', 'Gift items must have dashed border');
  });

  test('SHIELD-070: Gift label is green (#1a7a1a)', function() {
    assertContains(css, '.ccd-gift-label { display: flex', 'Must have gift label');
    assertContains(css, 'color: #1a7a1a', 'Gift label must be green');
  });

  test('SHIELD-071: Gift badge exists for price display', function() {
    assertContains(css, '.ccd-gift-badge {', 'Must have gift badge class');
    assertContains(css, '.ccd-gift-badge { width: fit-content', 'Gift badge must be fit-content');
  });

  test('SHIELD-072: Gift items have smaller images (80px)', function() {
    assertContains(css, ".ccd-gift-item__body .ccd-item__image { width: 80px !important; min-width: 80px", 'Gift images must be 80px');
  });

  test('SHIELD-073: Gift entering animation exists', function() {
    assertContains(css, '.ccd-gift-item--entering { opacity: 0 !important; max-height: 0', 'Gift entering must be collapsed');
  });

  // ================================================================
  // SECTION 13: REMOVE ANIMATION
  // ================================================================
  console.log('\n--- Remove Animation ---');

  test('SHIELD-074: Remove slides right and fades', function() {
    assertContains(css, '.ccd-item--removing { opacity: 0 !important; transform: translateX(30px) scale(0.95)', 'Remove must slide right + fade + scale');
  });

  test('SHIELD-075: Add animation slides down', function() {
    assertContains(css, '.ccd-item--adding { animation: ccdSlideIn', 'Add must use slideIn animation');
    assertContains(css, '@keyframes ccdSlideIn', 'Must define slideIn keyframes');
  });

  // ================================================================
  // SECTION 14: MOBILE RESPONSIVENESS
  // ================================================================
  console.log('\n--- Mobile Responsiveness ---');

  test('SHIELD-076: Desktop max-width uses CSS variable', function() {
    assertContains(css, '@media (min-width: 769px) { #CCD-Drawer { max-width: var(--ccd-desktop-width, 480px)', 'Desktop must use --ccd-desktop-width (480px default)');
  });

  test('SHIELD-077: Mobile max-width uses CSS variable', function() {
    assertContains(css, '@media (max-width: 768px) { #CCD-Drawer { max-width: var(--ccd-mobile-width, 85%)', 'Mobile must use --ccd-mobile-width (100% default)');
  });

  test('SHIELD-078: Mobile items have smaller images (100px)', function() {
    assertContains(css, '.ccd-item__image { width: 100px !important; min-width: 100px', 'Mobile item images must be 100px');
  });

  test('SHIELD-079: Mobile progress icons are smaller (36px)', function() {
    assertContains(css, '.ccd-progress__icon { width: 36px !important; height: 36px', 'Mobile progress icons must be 36px');
  });

  test('SHIELD-080: Mobile gift images are even smaller (60px)', function() {
    assertContains(css, ".ccd-gift-item__body .ccd-item__image { width: 60px !important; min-width: 60px", 'Mobile gift images must be 60px');
  });

  // ================================================================
  // SECTION 15: DISCOUNT DISPLAY
  // ================================================================
  console.log('\n--- Discount Display ---');

  test('SHIELD-081: Discount row layout is space-between', function() {
    assertContains(css, '.ccd-discount-row { display: flex !important; justify-content: space-between', 'Discount row must be space-between');
  });

  test('SHIELD-082: Compare price has strikethrough', function() {
    assertContains(css, '.ccd-item__compare-price { font-size: 13px !important; color: #aaa !important; text-decoration: line-through', 'Compare price must be struck through');
  });

  test('SHIELD-083: Free price has special styling', function() {
    assertContains(css, ".ccd-item__price--free { font-weight: 700", 'Free price must be bold');
  });

  test('SHIELD-084: Discount badges are dark with white text', function() {
    assertContains(css, '.ccd-badge { display: inline-flex !important; align-items: center !important; gap: 5px !important; background: #111 !important; color: #fff', 'Badges must be dark bg white text');
  });

  // ================================================================
  // SECTION 16: SCARCITY SYSTEM
  // ================================================================
  console.log('\n--- Scarcity System ---');

  test('SHIELD-085: Scarcity toast is fixed and centered', function() {
    assertContains(css, '.ccd-scarcity-toast { position: fixed !important; top: 20px !important; left: 50% !important; transform: translateX(-50%)', 'Toast must be centered at top');
  });

  test('SHIELD-086: Scarcity toast has dark background', function() {
    assertContains(css, 'background: #1a1a1a', 'Toast must be dark');
  });

  test('SHIELD-087: Scarcity badge pulses', function() {
    assertContains(css, '@keyframes ccdScarcityPulse', 'Must have scarcity pulse animation');
    assertContains(css, 'animation: ccdScarcityPulse', 'Scarcity badge must use pulse');
  });

  test('SHIELD-088: Scarcity badge is red', function() {
    assertContains(css, 'color: var(--ccd-scarcity-color, #d32f2f)', 'Scarcity must default to red');
  });

  // ================================================================
  // SECTION 17: LOADING STATES
  // ================================================================
  console.log('\n--- Loading States ---');

  test('SHIELD-089: Spinner animation exists', function() {
    assertContains(css, '@keyframes ccdSpin', 'Must have spin animation');
    assertContains(css, '.ccd-spinner {', 'Must have spinner class');
  });

  test('SHIELD-090: Item loading state dims the item', function() {
    assertContains(css, '.ccd-item--loading { opacity: 0.5 !important; pointer-events: none', 'Loading items must be dimmed');
  });

  test('SHIELD-091: Qty button loading replaces SVG with spinner', function() {
    assertContains(css, '.ccd-qty__btn--loading svg { display: none', 'Loading btn hides SVG');
    assertContains(css, '.ccd-qty__btn--loading::after {', 'Loading btn has spinner pseudo-element');
  });

  test('SHIELD-092: Checkout button has loading state', function() {
    assertContains(css, '.ccd-checkout-btn--loading { pointer-events: none', 'Loading checkout is non-interactive');
    assertContains(css, '.ccd-checkout-btn--loading::before {', 'Loading checkout has spinner');
  });

  // ================================================================
  // SECTION 18: THEME SUPPRESSION
  // ================================================================
  console.log('\n--- Theme Suppression ---');

  test('SHIELD-093: Theme drawers hidden via CSS (comprehensive selector list)', function() {
    assertContains(css, '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer]', 'Must hide all theme drawer selectors');
    assertContains(css, '.js-cart-drawer, .drawer--cart', 'Must hide JS/fallback drawer selectors');
  });

  test('SHIELD-094: Theme elements inside CCD-Drawer are hidden', function() {
    assertContains(css, '#CCD-Drawer .drawer__nav', 'Must hide theme nav inside our drawer');
    assertContains(css, '#CCD-Drawer .drawer__cart-items-wrapper', 'Must hide theme items wrapper');
    assertContains(css, '#CCD-Drawer .cart__footer:not(.ccd-sticky-footer)', 'Must hide theme footer (but not ours)');
    assertContains(css, '#CCD-Drawer cart-drawer-items', 'Must hide Dawn cart-drawer-items');
  });

  test('SHIELD-095: Theme appear-animation forced to instant inside CCD-Drawer', function() {
    assertContains(css, '#CCD-Drawer .appear-animation { opacity: 1 !important; transform: none !important; animation: none', 'Appear animations must be neutralized');
  });

  test('SHIELD-096: Liquid-rendered empty cart hidden inside #CartDrawer', function() {
    assertContains(css, '#CartDrawer .drawer__cart-empty', 'Must hide Liquid empty cart state');
  });

  test('SHIELD-097: renderDrawerShell empties theme CartDrawer content', function() {
    assertContains(code, "themeDrawer.innerHTML = ''", 'Must empty theme drawer HTML');
    assertContains(code, "themeDrawer.style.setProperty('display', 'none', 'important')", 'Must hide theme drawer');
  });

  test('SHIELD-098: Dawn <cart-drawer> custom element neutralized', function() {
    assertContains(code, "dawnDrawer.renderContents = function() {}", 'Must neutralize Dawn renderContents');
    assertContains(code, "dawnDrawer.getSectionsToRender = function() { return []; }", 'Must neutralize Dawn getSectionsToRender');
  });

  // ================================================================
  // SECTION 19: SELF-RENDER ARCHITECTURE
  // ================================================================
  console.log('\n--- Self-Render Architecture ---');

  test('SHIELD-099: renderDrawerShell creates #CCD-Drawer on body', function() {
    assertContains(code, "drawer.id = 'CCD-Drawer'", 'Must create element with CCD-Drawer ID');
    assertContains(code, 'document.body.appendChild(drawer)', 'Must append drawer to body');
  });

  test('SHIELD-100: renderDrawerShell skips if CCD-Drawer already exists', function() {
    assertContains(code, "var existingDrawer = document.getElementById('CCD-Drawer')", 'Must check for existing drawer');
  });

  test('SHIELD-101: Drawer has full structure (header, inner, footer)', function() {
    assertContains(code, 'ccd-fixed-header', 'Must have fixed header');
    assertContains(code, 'ccd-inner', 'Must have inner container');
    assertContains(code, 'ccd-scrollable', 'Must have scrollable area');
    assertContains(code, 'ccd-sticky-footer', 'Must have sticky footer');
  });

  test('SHIELD-102: Body scroll lock on drawer open', function() {
    assertContains(code, "document.body.style.overflow = 'hidden'", 'Must lock body scroll when open');
  });

  test('SHIELD-103: Body scroll restored on drawer close', function() {
    assertContains(code, "document.body.style.overflow = ''", 'Must restore body scroll when closed');
  });

  // ================================================================
  // SECTION 20: VERSION & INITIALIZATION
  // ================================================================
  console.log('\n--- Version & Initialization ---');

  test('SHIELD-104: Version stamp logged to console', function() {
    assertRegex(code, /console\.log\('%c\[CCD v\d+\.\d+\]/, 'Must log version with styling');
  });

  test('SHIELD-105: __ccd_version window variable set', function() {
    assertContains(code, "window.__ccd_version", 'Must set window.__ccd_version');
  });

  test('SHIELD-106: __eliminai_cart_loaded flag set', function() {
    assertContains(code, "window.__eliminai_cart_loaded = true", 'Must set loaded flag');
  });

  test('SHIELD-107: init() calls all setup functions', function() {
    assertContains(code, 'this.renderDrawerShell()', 'init must call renderDrawerShell');
    assertContains(code, 'this.bindEvents()', 'init must call bindEvents');
    assertContains(code, 'this.interceptAddToCart()', 'init must call interceptAddToCart');
    assertContains(code, 'this.interceptCartOpens()', 'init must call interceptCartOpens');
    assertContains(code, 'this._suppressThemeDrawer()', 'init must call _suppressThemeDrawer');
  });

  test('SHIELD-108: Free price color from config', function() {
    assertContains(code, '--ccd-free-color', 'Must set --ccd-free-color CSS variable');
    assertContains(code, 'FREE_PRICE_COLOR', 'Must have FREE_PRICE_COLOR constant');
  });

  // ================================================================
  // SECTION 21: EARLY SUPPRESSION (before DOMContentLoaded)
  // ================================================================
  console.log('\n--- Early Theme Suppression ---');

  test('SHIELD-109: Early MutationObserver runs before init', function() {
    assertContains(code, '_earlySuppress', 'Must have early suppression function');
    assertContains(code, '_earlySelectors', 'Must have early selector list');
  });

  test('SHIELD-110: Early suppression hides display, visibility, pointer-events', function() {
    assertContains(code, "el.style.setProperty('display', 'none', 'important')", 'Early suppress must set display:none');
    assertContains(code, "el.style.setProperty('visibility', 'hidden', 'important')", 'Early suppress must set visibility:hidden');
    assertContains(code, "el.style.setProperty('pointer-events', 'none', 'important')", 'Early suppress must disable pointer-events');
  });

  test('SHIELD-111: aria-hidden set on suppressed elements', function() {
    assertContains(code, "el.setAttribute('aria-hidden', 'true')", 'Must set aria-hidden on suppressed elements');
  });

  // ================================================================
  // SECTION 22: CSS VARIABLE SYSTEM
  // ================================================================
  console.log('\n--- CSS Variables ---');

  test('SHIELD-112: Background uses CSS variable with fallback', function() {
    assertContains(css, 'var(--ccd-bg, #fff)', 'Must use --ccd-bg with #fff fallback');
  });

  test('SHIELD-113: Primary color uses CSS variable', function() {
    assertContains(css, 'var(--ccd-primary, #111)', 'Must use --ccd-primary with #111 fallback');
  });

  test('SHIELD-114: Success color uses CSS variable', function() {
    assertContains(css, 'var(--ccd-success, #1a7a1a)', 'Must use --ccd-success for gift labels');
  });

  test('SHIELD-115: Desktop width uses CSS variable', function() {
    assertContains(css, 'var(--ccd-desktop-width, 480px)', 'Must use --ccd-desktop-width');
  });

  test('SHIELD-116: Mobile width uses CSS variable', function() {
    assertContains(css, 'var(--ccd-mobile-width, 85%)', 'Must use --ccd-mobile-width');
  });

  // ================================================================
  // SECTION 23: NO FORBIDDEN PATTERNS
  // ================================================================
  console.log('\n--- Forbidden Patterns ---');

  test('SHIELD-117: drawer--is-open only in suppression (not our drawer)', function() {
    // OK in suppressNativeDrawers (we REMOVE it from theme drawers)
    // Must NEVER appear in openDrawer/closeDrawer (we use ccd-open)
    assertNotContains(code, "classList.add('drawer--is-open')", 'Must NOT ADD drawer--is-open');
    assertContains(code, "classList.contains('drawer--is-open')", 'Must detect theme drawer class');
    assertContains(code, "classList.remove('is-open', 'drawer--is-open'", 'Must remove theme drawer class');
  });

  test('SHIELD-118: No hardcoded Shopify CDN URLs', function() {
    var hasCdn = /cdn\.shopify\.com[^\s]*v14-complete\.js/.test(code);
    assert(!hasCdn, 'Must NOT hardcode CDN URL for v14-complete.js');
  });

  test('SHIELD-119: No classList.add for theme classes', function() {
    assertNotContains(code, "classList.add('drawer--is-open')", 'Must NOT add drawer--is-open');
    assertNotContains(code, "classList.add('is-open')", 'Must NOT add theme is-open class');
  });

  test('SHIELD-120: No cart.total_price mutation', function() {
    assertNotContains(code, 'cart.total_price =', 'Must NEVER assign to cart.total_price');
    assertNotContains(code, 'cart.total_price +=', 'Must NEVER += to cart.total_price');
  });

  // ================================================================
  // SECTION 24: FONT SYSTEM
  // ================================================================
  console.log('\n--- Font System ---');

  test('SHIELD-121: Drawer uses system font stack', function() {
    assertContains(css, "font-family: -apple-system, BlinkMacSystemFont", 'Must use system font stack');
  });

  test('SHIELD-122: All !important declarations (theme override protection)', function() {
    // Count !important in CSS — must be very high to override any theme
    var importantCount = countOccurrences(css, '!important');
    assert(importantCount >= 100, 'Must have 100+ !important declarations (found ' + importantCount + ') — themes override everything without them');
  });

  // ================================================================
  // RESULTS
  // ================================================================
  console.log('\n' + '='.repeat(60));
  console.log('Behavior Shield: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');

  if (failed > 0) {
    console.log('\nFAILED SHIELDS:');
    failures.forEach(function(f) {
      console.log('  \u2717 ' + f.name);
      console.log('    ' + f.error);
    });
    console.log('\n\u26a0\ufe0f  BEHAVIOR SHIELDS BROKEN \u2014 DO NOT UPLOAD!');
    console.log('Visual behaviors will break if you upload this code.');
    process.exit(1);
  } else {
    console.log('\n\u2713 All behavior shields pass \u2014 visual integrity confirmed');
    process.exit(0);
  }
}

run();
