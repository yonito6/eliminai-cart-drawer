const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');
let changes = 0;

// ═══════════════════════════════════════════════
// BUG 1: Gap at top after removing gifts
// The progress bar has padding even when no tiers have gifts
// Fix: when updateProgress runs with 0 tiers, hide the progress bar
// ═══════════════════════════════════════════════

// In updateProgress, after checking tiers, hide if no tiers configured
const progressHideOld = "      // Legacy fallback when no dynamic tiers configured\n      if (!tiers || tiers.length === 0) {";
const progressHideNew = "      // Hide progress bar if no tiers\n      if (!tiers || tiers.length === 0) {\n        if (progressWrap) progressWrap.style.display = 'none';\n        return;\n      }\n      // Show progress bar when tiers exist\n      if (progressWrap) progressWrap.style.display = '';\n      // Legacy fallback when no dynamic tiers configured (dead code after above)\n      if (false) {";
if (code.includes(progressHideOld)) {
  code = code.replace(progressHideOld, progressHideNew);
  changes++;
  console.log('BUG 1: Added progress bar auto-hide when no tiers');
} else {
  console.log('BUG 1: SKIP');
}

// ═══════════════════════════════════════════════
// BUG 2: Theme cart drawer flashes before ours
// MutationObserver reacts AFTER the flash. Fix: inject CSS to
// preemptively hide ALL theme cart drawers so they never render.
// ═══════════════════════════════════════════════

const cssInjectPoint = "      '.ccd-checkout-btn--loading::before { content: \"\" !important;";
const themeHideCSS = "      '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart { display: none !important; visibility: hidden !important; }\n' +\n      '.ccd-checkout-btn--loading::before { content: \"\" !important;";
if (code.includes(cssInjectPoint)) {
  code = code.replace(cssInjectPoint, themeHideCSS);
  changes++;
  console.log('BUG 2: Added CSS to preemptively hide theme cart drawers');
} else {
  console.log('BUG 2: SKIP');
}

// ═══════════════════════════════════════════════
// BUG 3: Shipping protection shows double
// The fetch intercept adds protection inline AND refresh() adds it
// again when it detects protection missing. Fix: set protectionDone
// flag BEFORE refresh fires so it doesn't double-add.
// Also the refreshLight path does the same double-add.
// ═══════════════════════════════════════════════

// In the fetch intercept's post-add handler, skip adding protection
// if protectionDone is already true (inline add already happened)
const doubleProtOld = "                  var _hasProt = cart.items.some(function(i) { return i.handle === PROT; });\n                  var _shouldAdd = PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;\n                  if (!_hasProt && !_userToggledOff && _shouldAdd && CCD.getRealCount(cart) > 0) {";
const doubleProtNew = "                  var _hasProt = cart.items.some(function(i) { return i.handle === PROT; });\n                  var _shouldAdd = PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;\n                  if (!_hasProt && !_userToggledOff && _shouldAdd && !protectionDone && CCD.getRealCount(cart) > 0) {";
if (code.includes(doubleProtOld)) {
  code = code.replace(doubleProtOld, doubleProtNew);
  changes++;
  console.log('BUG 3: Added protectionDone guard to post-add protection check');
} else {
  console.log('BUG 3: SKIP - could not find double-prot pattern');
}

// ═══════════════════════════════════════════════
// BUG 4: Checkout button shows $0 with items
// After rapid add/remove, the checkout total can show stale value.
// Fix: in refresh(), update total AFTER morphDOM and enforceGiftItem
// (already the case), but also update in refreshLight.
// Main fix: ensure _lastCart is set so getAdjustedTotal uses fresh data.
// Also, getAdjustedTotal uses cart.total_price which Shopify always provides.
// The real issue is likely that fmt() returns $0.00 when total is 0 or undefined.
// Add a safety check: if cart has items but total is 0, recalculate from line_prices.
// ═══════════════════════════════════════════════

const fmtFuncOld = "    getAdjustedTotal: function(cart) {\n      if (!cart) return 0;\n      var giftCost = CCD.getGiftSavings(cart);\n      var total = cart.total_price - giftCost;\n      return total < 0 ? 0 : total;\n    },";
const fmtFuncNew = "    getAdjustedTotal: function(cart) {\n      if (!cart) return 0;\n      var giftCost = CCD.getGiftSavings(cart);\n      var total = cart.total_price - giftCost;\n      // Safety: if Shopify reports 0 but items exist, recalculate from line prices\n      if ((total <= 0 || isNaN(total)) && cart.items && cart.items.length > 0) {\n        var recalc = 0;\n        cart.items.forEach(function(i) {\n          if (!CCD._isExcludedHandle(i.handle)) recalc += (i.final_line_price || i.line_price || 0);\n        });\n        if (recalc > 0) total = recalc - giftCost;\n      }\n      return total < 0 ? 0 : (isNaN(total) ? 0 : total);\n    },";
if (code.includes(fmtFuncOld)) {
  code = code.replace(fmtFuncOld, fmtFuncNew);
  changes++;
  console.log('BUG 4: Added safety recalculation for $0 checkout total');
} else {
  console.log('BUG 4: SKIP');
}

fs.writeFileSync(file, code);
console.log('\n' + changes + ' bug fixes applied. File size:', code.length);
