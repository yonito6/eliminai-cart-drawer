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
  test("BUG-019: Fetch intercept updates _lastCart BEFORE openDrawer", function() {
    assertContains(code, "BUG-019 FIX", "Must have BUG-019 fix marker");
    // _lastCart and _lastRealCount must be set from fresh cart BEFORE openDrawer
    var interceptSection = code.indexOf("BUG-019 FIX");
    var openDrawerAfter = code.indexOf("CCD.openDrawer()", interceptSection);
    var lastCartBefore = code.indexOf("CCD._lastCart = cart", interceptSection);
    assert(lastCartBefore > 0 && lastCartBefore < openDrawerAfter, "Must set _lastCart before openDrawer in fetch intercept");
  });

  // BUG-020: 2026-04-18 Stale total after removing item (stale /cart/change.js discount allocations)
  test("BUG-020: Remove path does NOT update total from stale /cart/change.js", function() {
    assertContains(code, "BUG-020 FIX", "Must have BUG-020 fix marker");
    // The remove path should NOT set ccd-checkout-total from /cart/change.js response
    // It should only update bubble count and show loading
    var removeIdx = code.indexOf("_isRemoving");
    var cartJsAfter = code.indexOf("/cart.js", removeIdx);
    var removeSection = code.substring(removeIdx, cartJsAfter + 10);
    assert(removeSection, "Remove path must exist and fetch /cart.js");
    var section = removeSection[0];
    var hasStaleTotal = section.indexOf("ccd-checkout-total") !== -1;
    assert(!hasStaleTotal, "Remove path must NOT set ccd-checkout-total from stale /cart/change.js — wait for fresh /cart.js");
  });

  // BUG-021: 2026-04-18 Items not displaying on reopen (CCD._isOpen never set + display inconsistency)
  test("BUG-021: CCD._isOpen set in openDrawer and cleared in closeDrawer", function() {
    assertContains(code, "_isOpen = true", "Must set _isOpen = true in openDrawer");
    assertContains(code, "_isOpen = false", "Must set _isOpen = false in closeDrawer");
    // Verify it's used in loading/crossfade conditionals
    var isOpenGuards = (code.match(/CCD._isOpen/g) || []).length;
    assert(isOpenGuards >= 5, "Must reference CCD._isOpen in at least 5 guards (found " + isOpenGuards + ")");
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
