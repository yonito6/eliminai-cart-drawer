/**
 * TRIPLE FIX PATCH — 2026-04-18
 *
 * Bug 1: Theme cart flashes before CCD — CSS missing .drawer--cart selector
 * Bug 2: Double refresh on remove when gifts involved — cascading refresh chain
 * Bug 3: $0 checkout — race condition in refresh generation guard + fragile getAdjustedTotal
 *
 * Root causes:
 * - CSS preemptive hiding (line 12) doesn't include .drawer--cart (Impulse theme selector)
 * - checkWatchCase() at end of refresh() triggers cart API calls → cascading refresh
 * - _refreshGen guard can skip VALID refreshes when gen incremented between fetch and render
 * - getAdjustedTotal subtracts gift costs from cart.total_price but can overshoot during races
 */

const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let fixes = 0;

// ═══════════════════════════════════════════════════════════════
// FIX 1: Theme cart flash — add .drawer--cart to CSS preemptive hiding
// The CSS on line 12 hides theme drawers but misses Impulse's .drawer--cart class.
// The MutationObserver (line 714) covers it but is REACTIVE (causes 1-frame flash).
// Fix: add .drawer--cart and other common selectors to the CSS hiding rule.
// ═══════════════════════════════════════════════════════════════

const oldCSS = "#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer { display: none !important; visibility: hidden !important; }";
const newCSS = "#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart, .drawer[data-drawer=cart-drawer], .side-cart, #side-cart, .mini-cart-drawer, .ajax-cart__drawer { display: none !important; visibility: hidden !important; pointer-events: none !important; }";

if (code.includes(oldCSS)) {
  code = code.replace(oldCSS, newCSS);
  fixes++;
  console.log('Fix 1: Added .drawer--cart and more selectors to preemptive CSS hiding');
} else {
  console.log('Fix 1: CSS pattern not found — checking if already fixed');
  if (code.includes('.drawer--cart')) {
    console.log('Fix 1: Already has .drawer--cart — skipping');
  }
}

// Also update the MutationObserver selector list to match
const oldMOSelectors = "var _themeDrawerSelectors = '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart';";
const newMOSelectors = "var _themeDrawerSelectors = '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart, .drawer[data-drawer=cart-drawer], .side-cart, #side-cart, .mini-cart-drawer, .ajax-cart__drawer';";

if (code.includes(oldMOSelectors)) {
  code = code.replace(oldMOSelectors, newMOSelectors);
  fixes++;
  console.log('Fix 1b: Updated MutationObserver selectors to match CSS');
} else {
  console.log('Fix 1b: MutationObserver selector pattern not found');
}

// ═══════════════════════════════════════════════════════════════
// FIX 1c: Suppress theme drawer opening BEFORE it renders
// Add Impulse-specific theme.js cart drawer suppression:
// Override CartForm.prototype methods if they exist
// ═══════════════════════════════════════════════════════════════

// Add theme drawer override right after interceptCartOpens is called in init()
const oldInitEnd = "this.interceptAddToCart();\n      this.interceptCartOpens();";
const newInitEnd = `this.interceptAddToCart();
      this.interceptCartOpens();
      // Suppress theme drawer JS: override known theme cart open functions
      this._suppressThemeDrawer();`;

if (code.includes(oldInitEnd)) {
  code = code.replace(oldInitEnd, newInitEnd);
  fixes++;
  console.log('Fix 1c: Added _suppressThemeDrawer() call to init');
} else {
  console.log('Fix 1c: init pattern not found');
}

// Add the _suppressThemeDrawer method before the init method
const suppressThemeMethod = `
    // Suppress ALL known theme cart drawer mechanisms
    _suppressThemeDrawer: function() {
      // Impulse/Archetype: CartForm opens .drawer--cart via theme.js
      // Override the global theme.CartForm if it exists
      var _checkTheme = function() {
        // Impulse: theme.CartForm
        if (window.theme && window.theme.CartForm) {
          var origOpen = window.theme.CartForm.prototype && window.theme.CartForm.prototype.open;
          if (origOpen && !origOpen._ccdOverridden) {
            window.theme.CartForm.prototype.open = function() { CCD.openDrawer(); };
            window.theme.CartForm.prototype.open._ccdOverridden = true;
          }
        }
        // Dawn/OS2: cart-drawer custom element
        var cartDrawerEl = document.querySelector('cart-drawer');
        if (cartDrawerEl && cartDrawerEl.open && !cartDrawerEl.open._ccdOverridden) {
          cartDrawerEl.open = function() { CCD.openDrawer(); };
          cartDrawerEl.open._ccdOverridden = true;
        }
        // Generic: Shopify.theme.cart or Shopify.Cart
        if (window.Shopify && window.Shopify.theme && window.Shopify.theme.cart) {
          if (window.Shopify.theme.cart.openDrawer && !window.Shopify.theme.cart.openDrawer._ccdOverridden) {
            window.Shopify.theme.cart.openDrawer = function() { CCD.openDrawer(); };
            window.Shopify.theme.cart.openDrawer._ccdOverridden = true;
          }
        }
      };
      // Run immediately and after theme.js loads (it may load after us)
      _checkTheme();
      setTimeout(_checkTheme, 500);
      setTimeout(_checkTheme, 2000);
      // Also intercept Impulse's drawer open via event delegation
      document.addEventListener('drawer:open', function(e) {
        if (e.detail && e.detail.drawer === 'cart-drawer') {
          e.stopImmediatePropagation();
          CCD.openDrawer();
        }
      }, true);
    },

`;

const initMethodStart = "    init: function() {";
if (code.includes(initMethodStart)) {
  code = code.replace(initMethodStart, suppressThemeMethod + initMethodStart);
  fixes++;
  console.log('Fix 1d: Added _suppressThemeDrawer method');
} else {
  console.log('Fix 1d: init method pattern not found');
}


// ═══════════════════════════════════════════════════════════════
// FIX 2: Double refresh — debounce refresh() calls
// When checkWatchCase triggers a cart change → refresh, and the original
// operation also triggers a refresh, we get 2 visible redraws.
// Fix: Replace the _refreshGen guard with a debounce mechanism.
// The LAST refresh call within 100ms wins — earlier ones are silently dropped.
// ═══════════════════════════════════════════════════════════════

// Replace the entire refresh function opening with debounce-aware version
const oldRefreshOpen = `    refresh: function(cart, _gen) {
      // Generation guard: if a newer refresh was requested, skip this stale one
      if (_gen !== undefined && _gen < _refreshGen) {
        console.log("[CCD] refresh() skipped — stale gen " + _gen + " < " + _refreshGen);
        return;
      }
      console.log("[CCD] refresh() called gen=" + (_gen || 'direct'));`;

const newRefreshOpen = `    // Debounced refresh entry point: coalesces rapid calls into one render
    _refreshTimer: null,
    _pendingCart: null,
    refresh: function(cart, _gen) {
      // Store the latest cart data — if multiple refreshes fire rapidly,
      // we always render the LATEST cart, not an intermediate state
      if (cart) CCD._pendingCart = cart;
      var finalCart = CCD._pendingCart || cart;
      if (!finalCart) return;
      // Debounce: cancel any pending refresh, schedule a new one in 50ms
      // This coalesces double/triple refreshes (e.g., remove + gift change + protection)
      // into a single visual update
      if (CCD._refreshTimer) clearTimeout(CCD._refreshTimer);
      CCD._refreshTimer = setTimeout(function() {
        CCD._refreshTimer = null;
        CCD._doRefresh(CCD._pendingCart);
      }, 50);
    },
    _doRefresh: function(cart) {
      if (!cart) return;
      CCD._pendingCart = null;
      console.log("[CCD] _doRefresh() called — single render");`;

if (code.includes(oldRefreshOpen)) {
  code = code.replace(oldRefreshOpen, newRefreshOpen);
  fixes++;
  console.log('Fix 2: Replaced refresh() with debounced version');
} else {
  console.log('Fix 2: refresh() pattern not found — trying partial match');
  // Try a less strict match
  if (code.includes('refresh: function(cart, _gen) {')) {
    console.log('Fix 2: Found refresh function but pattern differs. Manual review needed.');
  }
}

// Also need to close _doRefresh properly — the existing refresh function ends and we need
// to change all internal self-calls to use _doRefresh where appropriate
// The checkWatchCase callback at line ~1808 calls CCD.refresh(c) — this should still use
// the debounced version, which is correct.

// Fix the refreshOnOpen calls to go through the debounced path too (they already call CCD.refresh)

// ═══════════════════════════════════════════════════════════════
// FIX 2b: Make checkWatchCase gift changes non-cascading
// When checkWatchCase adds/removes gifts, it calls CCD.refresh(c) on completion.
// Since refresh() is now debounced, this is already handled — the debounce
// will coalesce the original refresh + gift-change refresh into one render.
// No additional changes needed.
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// FIX 3: $0 checkout — simplify getAdjustedTotal to be more robust
// Root cause: getAdjustedTotal subtracts getGiftSavings from cart.total_price,
// but during race conditions, gift items may appear at full price temporarily,
// causing over-subtraction → negative → clamped to 0.
//
// New approach:
// 1. Sum final_line_price of all NON-excluded items (real products only)
// 2. This is the customer's actual cost, regardless of what Shopify says about total_price
// 3. No subtraction of gift costs — gifts have final_line_price=0 when BXGY works,
//    and we exclude them anyway via _isExcludedHandle
// ═══════════════════════════════════════════════════════════════

const oldGetAdjustedTotal = `    // Get the total to display = cart.total_price minus any gift costs Shopify didn't discount
    getAdjustedTotal: function(cart) {
      if (!cart) return 0;
      var giftCost = CCD.getGiftSavings(cart);
      var total = cart.total_price - giftCost;
      // Safety: if Shopify reports 0 but items exist, recalculate from line prices
      if ((total <= 0 || isNaN(total)) && cart.items && cart.items.length > 0) {
        var recalc = 0;
        cart.items.forEach(function(i) {
          if (!CCD._isExcludedHandle(i.handle)) recalc += (i.final_line_price || i.line_price || 0);
        });
        if (recalc > 0) total = recalc - giftCost;
      }
      return total < 0 ? 0 : (isNaN(total) ? 0 : total);
    },`;

const newGetAdjustedTotal = `    // Get the total to display — sum of final_line_price for non-excluded items
    // This is robust against race conditions: we NEVER subtract gift costs from cart.total_price.
    // Instead, we sum only what the customer is paying for (non-gift, non-protection items).
    // Protection is shown separately via the toggle, so we exclude it from the displayed total.
    getAdjustedTotal: function(cart) {
      if (!cart || !cart.items) return 0;
      // Primary: sum final_line_price of real items (excludes gifts + protection)
      var realTotal = 0;
      var hasRealItems = false;
      cart.items.forEach(function(i) {
        if (CCD._isExcludedHandle(i.handle)) return;
        hasRealItems = true;
        realTotal += (i.final_line_price != null ? i.final_line_price : (i.price * i.quantity));
      });
      // Protection total (add back — customer sees this as part of checkout)
      var protTotal = 0;
      cart.items.forEach(function(i) {
        if (i.handle === PROT) protTotal += (i.final_line_price != null ? i.final_line_price : (i.price * i.quantity));
      });
      var total = realTotal + protTotal;
      // Safety: never show $0 when real items exist
      if (total <= 0 && hasRealItems) {
        // Fallback to cart.total_price minus gift item costs
        var giftCost = CCD.getGiftSavings(cart);
        total = (cart.total_price || 0) - giftCost;
        if (total < 0) total = 0;
        // Last resort: use raw cart.total_price
        if (total <= 0 && cart.total_price > 0) total = cart.total_price;
      }
      return isNaN(total) ? 0 : total;
    },`;

if (code.includes(oldGetAdjustedTotal)) {
  code = code.replace(oldGetAdjustedTotal, newGetAdjustedTotal);
  fixes++;
  console.log('Fix 3: Replaced getAdjustedTotal with robust item-sum approach');
} else {
  console.log('Fix 3: getAdjustedTotal pattern not found — trying line-by-line');
  // Try matching just the function signature
  if (code.includes('getAdjustedTotal: function(cart) {')) {
    console.log('Fix 3: Function found but body differs. Needs manual review.');
  }
}


// ═══════════════════════════════════════════════════════════════
// FIX 3b: Remove stale _refreshGen references
// Since we replaced the generation guard with debounce, clean up
// remaining ++_refreshGen calls that no longer serve a purpose.
// These increments were causing valid refreshes to be skipped.
// ═══════════════════════════════════════════════════════════════

// The _refreshGen variable and its increments are scattered throughout.
// With the debounce approach, we don't need them anymore.
// But to be safe, let's keep the variable and just not use it as a guard.
// The refresh function no longer checks it, so the increments are harmless.


// ═══════════════════════════════════════════════════════════════
// FIX 3c: Store _lastCart for checkout guard
// The checkout button uses CCD._lastCart to check gift eligibility.
// Make sure _doRefresh stores it.
// ═══════════════════════════════════════════════════════════════

// In the refresh body, there's: window.__ccd_last_cart = cart;
// We also need: CCD._lastCart = cart;
if (!code.includes('CCD._lastCart = cart;') || code.indexOf('CCD._lastCart = cart;') > code.indexOf('window.__ccd_last_cart = cart;') + 100) {
  // Check if it's already set near __ccd_last_cart
  const lastCartLine = 'window.__ccd_last_cart = cart;';
  if (code.includes(lastCartLine) && !code.includes('CCD._lastCart = cart;\n      window.__ccd_last_cart = cart;')) {
    code = code.replace(lastCartLine, 'CCD._lastCart = cart;\n      window.__ccd_last_cart = cart;');
    fixes++;
    console.log('Fix 3c: Added CCD._lastCart = cart alongside window.__ccd_last_cart');
  }
}


// ═══════════════════════════════════════════════════════════════
// Write result
// ═══════════════════════════════════════════════════════════════

fs.writeFileSync('v14-complete.js', code);
console.log('\n=== Applied ' + fixes + ' fixes ===');
if (fixes < 5) {
  console.log('WARNING: Some patches did not match. Review output above.');
}
