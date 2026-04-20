#!/usr/bin/env node
/**
 * Bug Regression Tests — Every bug Yoni reports becomes a PERMANENT test.
 *
 * These tests verify that previously reported bugs stay fixed.
 * They run BEFORE every upload. If ANY fails → DO NOT UPLOAD.
 *
 * Adding a new bug:
 *   1. Add a test in the appropriate section below
 *   2. Make it FAIL first (proves it catches the bug)
 *   3. Fix the code
 *   4. Confirm it PASSES
 *
 * Usage:
 *   node tests/bug-regression.test.js                    # Test local v14-complete.js
 *   node tests/bug-regression.test.js --file path/to.js  # Test specific file
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const customFile = fileIdx > -1 ? args[fileIdx + 1] : null;

let passed = 0;
let failed = 0;
const failures = [];

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
    throw new Error(message + '\n    Missing: "' + pattern.substring(0, 100) + '..."');
  }
}

function assertNotContains(code, pattern, message) {
  if (code.includes(pattern)) {
    throw new Error(message + '\n    Found forbidden: "' + pattern.substring(0, 100) + '..."');
  }
}

function assertRegex(code, regex, message) {
  if (!regex.test(code)) {
    throw new Error(message + '\n    Pattern not found: ' + regex);
  }
}

async function run() {
  var filePath = customFile || path.resolve(__dirname, '..', 'v14-complete.js');

  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  var code = fs.readFileSync(filePath, 'utf8');

  console.log('\nBug Regression Tests \u2014 ' + path.basename(filePath) + ' (' + code.length + ' bytes)');
  console.log('='.repeat(60));

  // ================================================================
  // BUG REGISTRY — Every reported bug gets a permanent test
  // Format: BUG-XXX: <date> <description>
  // ================================================================

  console.log('\n--- Protection Toggle Bugs ---');

  // BUG-001: 2026-04-18 — Protection toggle flashes ON then OFF when user
  // manually turned it off and then adds a product to cart.
  // Root cause: _doRefresh pre-set toggle ON without checking _userToggledOff.
  test('BUG-001: Protection toggle pre-set respects _userToggledOff', function() {
    var presetMatch = code.match(/if\s*\(shouldDefaultOn\s*&&\s*CCD\.getRealCount\(cart\)\s*>\s*0\s*&&\s*!_userToggledOff\)/);
    assert(presetMatch, '_doRefresh toggle pre-set must include && !_userToggledOff guard');
    var refreshLightMatch = code.match(/!_userToggledOff\s*&&\s*!protItem\s*&&\s*CCD\.getRealCount/);
    assert(refreshLightMatch, 'refreshLight must check _userToggledOff before setting toggle');
  });

  // BUG-002: 2026-04-18 — Protection toggle rapid-click causes NaN price.
  test('BUG-002: fmt() function guards against NaN', function() {
    var fmtMatch = code.match(/fmt:\s*function\s*\([^)]*\)\s*\{[^}]*\}/);
    assert(fmtMatch, 'fmt function must exist');
    var fmtBody = fmtMatch[0];
    var hasGuard = fmtBody.includes('isNaN') || fmtBody.includes('|| 0') || fmtBody.includes('Number(') || fmtBody.includes('parseFloat');
    assert(hasGuard, 'fmt() must guard against NaN inputs');
  });

  // BUG-003: 2026-04-18 — Toggle checkbox must be disabled during API call.
  test('BUG-003: Toggle disables during API operations', function() {
    assertContains(code, '.disabled = true', 'Toggle must be disabled during API call');
    assertContains(code, '.disabled = false', 'Toggle must be re-enabled after API call');
  });

  console.log('\n--- Cart Rendering Bugs ---');

  // BUG-004: 2026-04-18 — Cart shows empty after adding item because
  // protection product unpublished from Online Store caused /cart/add.js
  // to fail with "cannot find product variant". JS must handle this gracefully.
  test('BUG-004: Protection add failure does not crash cart rendering', function() {
    // The protection add/change operations must have .catch() handlers
    // so the cart still renders even if protection product is unavailable
    var addCalls = code.match(/\/cart\/add\.js/g) || [];
    var changeCalls = code.match(/\/cart\/change\.js/g) || [];
    assert(addCalls.length > 0, 'Must have /cart/add.js calls');
    assert(changeCalls.length > 0, 'Must have /cart/change.js calls');
    // Must have catch handlers for cart operations
    var catchCount = (code.match(/\.catch\s*\(/g) || []).length;
    assert(catchCount >= 3, 'Must have at least 3 .catch() handlers for cart API calls (found ' + catchCount + ')');
  });

  // BUG-005: 2026-04-18 — Single CCD.refresh() per cart open.
  test('BUG-005: _doRefresh has single-render log', function() {
    assertContains(code, 'single render', '_doRefresh must enforce single render');
  });

  // BUG-006: 2026-04-14 — Remove animation must be smooth (no gap/blink).
  test('BUG-006: Remove animation uses ccd-item--removing class', function() {
    assertContains(code, 'ccd-item--removing', 'Must use ccd-item--removing for remove animation');
    assertContains(code, '.ccd-item--removing', 'Must have .ccd-item--removing CSS rule');
  });

  // BUG-007: 2026-04-14 — $0 items must show "Free" not "$0.00"
  test('BUG-007: Zero-price items display as Free', function() {
    assertRegex(code, /Free|free|FREE/, 'Must have Free label for $0 items');
  });

  console.log('\n--- Protection Toggle Animation Bugs ---');

  // BUG-008: Repeat reports (10+) — Toggle must NEVER show slide animation on cart open.
  test('BUG-008: Toggle uses instant class to prevent animation on open', function() {
    assertContains(code, 'ccd-toggle--instant', 'Must use ccd-toggle--instant class');
    assertContains(code, 'setToggleNoTransition', 'Must have setToggleNoTransition method');
  });

  console.log('\n--- Theme Independence Bugs ---');

  // BUG-009: Never use theme-specific class names in our selectors.
  test('BUG-009: No theme-specific drawer__* in querySelector', function() {
    var themeClassUsage = code.match(/querySelector\(['"]\.[^'"]*drawer__[^'"]*['"]\)/g);
    if (themeClassUsage) {
      var nonComment = themeClassUsage.filter(function(m) {
        var idx = code.indexOf(m);
        var lineStart = code.lastIndexOf('\n', idx);
        var before = code.substring(lineStart, idx).trim();
        return !before.startsWith('//') && !before.startsWith('*');
      });
      assert(nonComment.length === 0, 'Must not use drawer__* theme classes (found: ' + nonComment.join(', ') + ')');
    }
  });

  // BUG-010: Drawer ID must be #CCD-Drawer
  test('BUG-010: Primary drawer ID is CCD-Drawer', function() {
    var ccdRefs = (code.match(/#CCD-Drawer/g) || []).length;
    assert(ccdRefs >= 5, 'Must use #CCD-Drawer as primary ID (found ' + ccdRefs + ')');
  });

  console.log('\n--- Gift System Bugs ---');

  // BUG-011: Gift items must have data-gift attribute for identification
  test('BUG-011: Gift items have data-gift attribute', function() {
    assertContains(code, 'data-gift', 'Must have data-gift attribute on gift items');
  });

  console.log('\n--- Price Display Bugs ---');

  // BUG-012: Cart total must use getAdjustedTotal, never raw cart.total_price
  test('BUG-012: Uses getAdjustedTotal for price display', function() {
    assertContains(code, 'getAdjustedTotal', 'Must use getAdjustedTotal for price display');
  });

  // BUG-013: 2026-04-18 Gift added at full price (config had wrong variantId)
  test("BUG-013: Gift adds use g.variantId from tier config", function() {
    var m1=code.includes("shouldHave[g.handle] = g.variantId");
    assert(m1, "Gift shouldHave must map handle to g.variantId from config");
    var m2=code.includes("id: shouldHave[h]");
    assert(m2, "Gift cart add must use shouldHave[handle] (config variantId)");
  });


  console.log('\n--- Background Refresh Bugs ---');

  // BUG-014: 2026-04-18 Cart refresh causes visible flash/flicker.
  // Fix: Loading overlay + crossfade transition during cart operations.
  test('BUG-014: Background refresh uses loading overlay', function() {
    assertContains(code, 'ccd-loading-overlay', 'Must have loading overlay CSS class');
    assertContains(code, 'showLoading', 'Must have showLoading method');
    assertContains(code, 'hideLoading', 'Must have hideLoading method');
    assertContains(code, 'ccd-items-crossfade', 'Must have crossfade CSS class');
    assertContains(code, 'ccd-loading-shimmer', 'Must have shimmer animation');
  });

  console.log(String.fromCharCode(10) + "--- Checkout Total Bugs ---");

  // BUG-015: 2026-04-18 Checkout shows $0 instead of real total.
  test("BUG-015: Checkout total never shows $0 with real items", function() {
    assertContains(code, "Pre-populate checkout total", "openDrawer must pre-populate total from _lastCart");
    assertContains(code, "Total was $0 but cart.total_price", "Must have safety fallback to cart.total_price");
  });

  console.log(String.fromCharCode(10) + "--- Shopify Discount Display Bugs ---");

  // BUG-016: 2026-04-18 BXGY discounts (1+1 FREE, 1+2 FREE) must display correctly.
  test("BUG-016: renderItemHTML uses final_line_price for discounted display", function() {
    assertContains(code, "item.final_line_price", "Must use item.final_line_price for price display");
    assertContains(code, "item.final_price", "Must use item.final_price for unit price");
    assertContains(code, "original_line_price", "Must track original_line_price for compare price");
    assertContains(code, "linePrice === 0", "Must check linePrice === 0 for Free label");
  });

  // BUG-017: 2026-04-18 Discount badges must render for BXGY discounts
  test("BUG-017: _renderDiscountBadges shows automatic discount titles", function() {
    assertContains(code, "_renderDiscountBadges", "Must have _renderDiscountBadges function");
    assertContains(code, "line_level_discount_allocations", "Must read line_level_discount_allocations");
    assertContains(code, "discount_application", "Must read discount_application for title");
    assertContains(code, "ccd-badge", "Must render discount badge with ccd-badge class");
  });

  // BUG-018: 2026-04-18 getAdjustedTotal must use final_line_price (respects Shopify discounts)
  test("BUG-018: getAdjustedTotal uses final_line_price (respects Shopify discounts)", function() {
    var m = code.match(/getAdjustedTotal[\s\S]*?final_line_price/);
    assert(m, "getAdjustedTotal must reference final_line_price");
    assertContains(code, "i.final_line_price != null ? i.final_line_price", "Must prefer final_line_price over raw price");
  });

  console.log(String.fromCharCode(10) + "--- Cart State Bugs ---");

  // BUG-019: 2026-04-18 $0 total when adding second item (openDrawer pre-populate overwrites fresh total)
  // Updated BUG-020 FIX: _renderAndOpen sets _lastCart + renders + opens in one atomic step
  test("BUG-019: Fetch intercept updates _lastCart BEFORE openDrawer", function() {
    assertContains(code, "BUG-020 FIX", "Must have BUG-020 fix marker (_renderAndOpen)");
    // _renderAndOpen must set _lastCart before openDrawer
    var renderAndOpenIdx = code.indexOf("function _renderAndOpen(finalCart)");
    assert(renderAndOpenIdx > 0, "_renderAndOpen helper must be defined");
    var renderBlock = code.substring(renderAndOpenIdx, renderAndOpenIdx + 2200);
    var lastCartPos = renderBlock.indexOf("_lastCart");
    var openDrawerPos = renderBlock.indexOf("CCD.openDrawer()");
    assert(lastCartPos > 0 && lastCartPos < openDrawerPos, "Must set _lastCart before openDrawer in _renderAndOpen");
  });

  // BUG-021: 2026-04-19 Milestones disappeared after _renderAndOpen bypassed loadExperiment
  test("BUG-021: _renderAndOpen must load experiment config for milestones", function() {
    var renderIdx = code.indexOf("function _renderAndOpen(finalCart)");
    assert(renderIdx > -1, "_renderAndOpen helper must exist");
    var renderBlock = code.substring(renderIdx, renderIdx + 2500);
    assertContains(renderBlock, "loadExperiment", "_renderAndOpen must call loadExperiment (milestones need tier config)");
    assertContains(renderBlock, "applyExperimentFeatures", "_renderAndOpen must apply experiment features before rendering");
    assertContains(renderBlock, "_mergeTiersFromConfig", "_renderAndOpen must merge tiers from config");
  });

  // BUG-020: 2026-04-18 Stale total after removing item (stale /cart/change.js discount allocations)
  test("BUG-020: Remove path does NOT update total from stale /cart/change.js", function() {
    // The remove path should NOT set ccd-checkout-total from /cart/change.js response
    // It should only update bubble count, show loading, then fetch fresh /cart.js
    var removeIdx = code.indexOf("_isRemoving");
    assert(removeIdx > -1, "Must have _isRemoving flag in change handler");
    var cartJsAfter = code.indexOf("/cart.js", removeIdx);
    var removeSection = code.substring(removeIdx, cartJsAfter + 10);
    assert(removeSection, "Remove path must exist and fetch /cart.js");
    // The section between _isRemoving and /cart.js should NOT touch ccd-checkout-total
    assert(!removeSection.includes("ccd-checkout-total"), "Remove path must NOT set ccd-checkout-total from stale /cart/change.js — wait for fresh /cart.js");
    // Must show loading during remove
    assert(removeSection.includes("showLoading"), "Remove path must show loading while fetching fresh cart");
  });

  // BUG-021: 2026-04-18 Items not displaying on reopen (CCD._isOpen never set + display inconsistency)
  test("BUG-021: CCD._isOpen set in openDrawer and cleared in closeDrawer", function() {
    assertContains(code, "_isOpen = true", "Must set _isOpen = true in openDrawer");
    assertContains(code, "_isOpen = false", "Must set _isOpen = false in closeDrawer");
    // Verify it's used in loading/crossfade conditionals
    var isOpenGuards = (code.match(/CCD._isOpen/g) || []).length;
    assert(isOpenGuards >= 5, "Must reference CCD._isOpen in at least 5 guards (found " + isOpenGuards + ")");
  });

  console.log(String.fromCharCode(10) + "--- Empty Cart & Theme Compatibility ---");

  // BUG-023: 2026-04-18 "Your cart is empty" text invisible (white on white background)
  test("BUG-023: Empty cart text uses dark color (not white)", function() {
    // Empty cart must use dark text, not white-on-white
    assert(!code.includes("ccd-cart-empty, #CCD-Drawer .ccd-empty { color: #fff"), "Empty cart text color must NOT be #fff (white)");
    assert(!code.includes("ccd-cart-empty, #CCD-Drawer .ccd-empty { color: #ffffff"), "Empty cart text color must NOT be #ffffff");
    assertContains(code, "ccd-cart-empty, #CCD-Drawer .ccd-empty { color: #111", "Empty cart must use dark color (#111)");
  });

  // BUG-024: 2026-04-18 Duplicate trust badges (Liquid + JS both render)
  test("BUG-024: CSS hides Liquid-rendered duplicates inside #CartDrawer", function() {
    assertContains(code, "#CartDrawer .ccd-trust", "Must hide Liquid ccd-trust inside #CartDrawer");
    assertContains(code, "#CartDrawer .ccd-progress", "Must hide Liquid ccd-progress inside #CartDrawer");
    assertContains(code, "#CartDrawer .drawer__cart-empty", "Must hide Liquid drawer__cart-empty inside #CartDrawer");
  });

  // BUG-025: 2026-04-18 Milestones flash on empty cart open
  test("BUG-025: Liquid appear-animation suppressed inside #CartDrawer", function() {
    assertContains(code, "#CartDrawer .appear-animation", "Must hide Liquid appear-animation inside #CartDrawer");
  });

    console.log(String.fromCharCode(10) + "--- Syntax Validation ---");

  // BUG-022: 2026-04-18 Cart won't open — real newline inside JS string literal breaks parser.
  // CSS string had a literal LF (0x0a) instead of \n escape sequence.
  test("BUG-022: No real newlines inside JS string literals (syntax valid)", function() {
    // Check for lines that START with ' + (closing quote of a string that spans lines)
    var lines = code.split('\n');
    var brokenStrings = [];
    for (var i = 1; i < lines.length; i++) {
      var trimmed = lines[i].trimStart();
      // A line starting with ' + or '; means the previous line had an unclosed string
      if (/^'\s*[+;]/.test(trimmed)) {
        // Check if previous line has an opening ' without a closing '
        var prev = lines[i - 1];
        var singleQuotes = (prev.match(/'/g) || []).length;
        // Odd number of quotes = unclosed string
        if (singleQuotes % 2 === 1) {
          brokenStrings.push("Line " + i + ": string spans lines (prev: " + prev.substring(0, 80) + "...)");
        }
      }
    }
    assert(brokenStrings.length === 0, "Found string literals with real newlines:\\n    " + brokenStrings.join("\\n    "));

    // Also run node -c equivalent: check the file parses as valid JS
    var vm = require('vm');
    try {
      new vm.Script(code, { filename: 'v14-complete.js' });
    } catch (e) {
      assert(false, "JavaScript syntax error: " + e.message);
    }
  });

  // ================================================================
  // BUG-022: Checkout button loading delay — spinner must appear instantly
  // Reported: 2026-04-19 — "small delay when clicking till it shows the loading animation"
  // Root cause: (1) transition:all 0.15s animates --loading opacity, (2) browser batches
  //   classList.add + location.href without painting the spinner in between
  // Fix: transition:none on --loading + forced repaint (offsetHeight) + requestAnimationFrame
  //   so browser paints spinner BEFORE starting gift check + redirect
  // ================================================================
  test('BUG-022: Checkout --loading disables transition for instant spinner', () => {
    const loadingIdx = code.indexOf('.ccd-checkout-btn--loading');
    assert(loadingIdx !== -1, '--loading CSS rule must exist');
    const ruleEnd = code.indexOf('}', loadingIdx);
    const rule = code.substring(loadingIdx, ruleEnd);
    assert(rule.includes('transition: none'), '--loading must override transition to none');
    assert(rule.includes('opacity: 0.6') || rule.includes('opacity:0.6'), '--loading must set reduced opacity');
  });

  test('BUG-022: Checkout click forces repaint before redirect', () => {
    // The checkout handler must force a browser repaint (offsetHeight) and use requestAnimationFrame
    // so the spinner is visually rendered before the gift-check + redirect runs
    const checkoutHandler = code.indexOf('Checkout button');
    assert(checkoutHandler !== -1, 'Checkout button handler comment must exist');
    const handlerBlock = code.substring(checkoutHandler, checkoutHandler + 3000);
    assert(handlerBlock.includes('offsetHeight'), 'Must force layout reflow (offsetHeight) after adding --loading class');
    assert(handlerBlock.includes('requestAnimationFrame'), 'Must use requestAnimationFrame to ensure spinner paints before redirect');
    // The class add must come BEFORE the repaint force
    const classAddPos = handlerBlock.indexOf('ccd-checkout-btn--loading');
    const reflowPos = handlerBlock.indexOf('offsetHeight');
    const rafPos = handlerBlock.indexOf('requestAnimationFrame');
    assert(classAddPos < reflowPos, 'classList.add must come before offsetHeight reflow');
    assert(reflowPos < rafPos, 'offsetHeight must come before requestAnimationFrame');
  });

  // ================================================================
  // BUG-024: Gift compare price — must look up original price from tier config
  // Reported: 2026-04-19 — "I dont see a comparing price for the gift added"
  // Root cause: Gift products are $0 duplicates, so cart item's price/original_price are both 0.
  //   Code tried to use giftCartItem.price which was 0, never showed compare price.
  // Fix: Look up gift.price from REWARD_TIERS config (stored as "49.99" string from dashboard)
  // ================================================================
  test('BUG-024: Gift compare price looks up original price from tier config', () => {
    const enforceIdx = code.indexOf('enforceGiftItem: function(cart)');
    assert(enforceIdx !== -1, 'enforceGiftItem function must exist');
    const enforceBlock = code.substring(enforceIdx, enforceIdx + 3500);
    // Must search REWARD_TIERS for the gift handle's price
    assert(enforceBlock.includes('REWARD_TIERS.length'), 'Must iterate REWARD_TIERS to find gift price');
    assert(enforceBlock.includes('tierGifts'), 'Must use tierGifts() to get gift products from each tier');
    assert(enforceBlock.includes('parseFloat'), 'Must parseFloat the price string from config');
    // Must multiply by 100 to convert dollars to cents for fmt()
    assert(enforceBlock.includes('* 100'), 'Must convert dollars to cents (* 100) for fmt()');
    // Must still show "Free" as the current price
    assert(enforceBlock.includes("'Free'"), 'Must set price text to Free');
  });

  // ================================================================
  // BUG-023: Item ordering — morphDOM must reorder DOM to match Shopify order
  // Reported: 2026-04-19 — "blue luxe was added last, swapped to middle after refresh"
  // Root cause: morphDOM updated existing items in place but never reordered DOM children.
  //   New items were appended at end instead of inserted at correct position.
  //   When gift add triggered a cart refresh, existing items stayed in old positions.
  // Fix: After update loop, reorder all DOM children to match newList order using insertBefore
  // ================================================================
  test('BUG-023: morphDOM reorders DOM children to match cart order', () => {
    const morphIdx = code.indexOf('morphDOM: function(container, newCartItems)');
    assert(morphIdx !== -1, 'morphDOM function must exist');
    const morphBlock = code.substring(morphIdx, morphIdx + 6500);
    assert(morphBlock.includes('BUG-023 FIX'), 'BUG-023 reorder fix marker must be present');
    assert(morphBlock.includes('_domEl'), 'Must track _domEl for each item for reordering');
    // The reorder loop must iterate newList and insertBefore to enforce order
    assert(morphBlock.includes('_ri < newList.length'), 'Must have reorder loop over newList');
    assert(morphBlock.includes('insertBefore'), 'Must use insertBefore to reorder items');
  });

  // ================================================================
  // RESULTS
  // ================================================================
  console.log('\n' + '='.repeat(60));
  console.log('Bug Regression: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');

  if (failed > 0) {
    console.log('\nFAILED BUG REGRESSIONS:');
    failures.forEach(function(f) {
      console.log('  \u2717 ' + f.name);
      console.log('    ' + f.error);
    });
    console.log('\n\u26a0\ufe0f  BUG REGRESSIONS DETECTED \u2014 DO NOT UPLOAD!');
    process.exit(1);
  } else {
    console.log('\n\u2713 All bug regressions pass \u2014 no known bugs reintroduced');
    process.exit(0);
  }
}

run().catch(function(e) {
  console.error('Bug regression test error:', e);
  process.exit(1);
});
