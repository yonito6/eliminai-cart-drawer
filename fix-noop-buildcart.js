const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

function tryReplace(src, old, repl, label) {
  if (src.indexOf(old) !== -1) {
    console.log(label + ': found (LF)');
    return src.replace(old, repl);
  }
  const oldCR = old.replace(/\n/g, '\r\n');
  const replCR = repl.replace(/\n/g, '\r\n');
  if (src.indexOf(oldCR) !== -1) {
    console.log(label + ': found (CRLF)');
    return src.replace(oldCR, replCR);
  }
  console.log(label + ': NOT FOUND');
  return src;
}

// ============================================================
// STRATEGY CHANGE: Instead of intercepting fetch/XHR/events,
// just NOOP the theme's buildCart function directly.
// This is what Rebuy, Slide Cart, EliteCart all recommend.
// ============================================================

// 1. Replace the entire interceptor block (events + fetch + XHR)
//    with a simple buildCart override
const oldInterceptorStart = '  // === THEME REBUILD BLOCKER ===';
// Find the end — it's right before 'use strict'
const endMarker = "  'use strict';";

const startIdx = code.indexOf(oldInterceptorStart);
const endIdx = code.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const newInterceptor = `  // === THEME CART OVERRIDE ===
  // Neutralize the theme's cart rebuild to prevent flicker during our animations.
  // Every major cart app (Rebuy, Slide Cart, EliteCart) does this.
  // We override buildCart + block cart events during our animations.
  (function() {
    // 1. Override theme.cart.buildCart when it becomes available
    var _checkTheme = setInterval(function() {
      if (window.theme && window.theme.cart) {
        var _origBuildCart = window.theme.cart.buildCart;
        window.theme.cart.buildCart = function(cart, openDrawer) {
          if (window.__ccd_block_rebuild) return; // skip during our animation
          // Outside animation window, let theme rebuild normally
          if (_origBuildCart) return _origBuildCart.call(window.theme.cart, cart, openDrawer);
        };
        // Also override _updateCart to prevent theme's own /cart/change.js calls
        if (window.theme.cart._updateCart) {
          var _origUpdateCart = window.theme.cart._updateCart;
          window.theme.cart._updateCart = function(params) {
            if (window.__ccd_block_rebuild) return Promise.resolve(window.__ccd_last_cart || {});
            return _origUpdateCart.call(window.theme.cart, params);
          };
        }
        // Also override changeItem
        if (window.theme.cart.changeItem) {
          var _origChangeItem = window.theme.cart.changeItem;
          window.theme.cart.changeItem = function(key, qty) {
            if (window.__ccd_block_rebuild) return;
            return _origChangeItem.call(window.theme.cart, key, qty);
          };
        }
        clearInterval(_checkTheme);
      }
    }, 50);
    // Stop checking after 10s
    setTimeout(function() { clearInterval(_checkTheme); }, 10000);

    // 2. Swallow cart events during animation (backup)
    var _origDispatch = document.dispatchEvent.bind(document);
    document.dispatchEvent = function(evt) {
      if (window.__ccd_block_rebuild && evt.type &&
          (evt.type === 'cart:updated' || evt.type === 'cart:build' || evt.type === 'cart:quantity')) {
        return true;
      }
      return _origDispatch(evt);
    };
  })();
`;
  code = code.substring(0, startIdx) + newInterceptor + code.substring(endIdx);
  console.log('Replaced entire interceptor block with buildCart override');
} else {
  console.log('ERROR: Could not find interceptor block bounds. start:', startIdx, 'end:', endIdx);
  process.exit(1);
}

// 2. Remove the __ccd_own_fetch flag since we no longer intercept fetch
code = code.replace(/window\.__ccd_own_fetch\s*=\s*true;\s*\n?\r?/g, '');
code = code.replace(/window\.__ccd_own_fetch\s*=\s*false;\s*/g, '');
console.log('Removed __ccd_own_fetch flags');

// 3. Fix the block_rebuild timing: remove the fixed 800ms timeout in changeQty,
//    and instead unblock in the .then() and .catch() handlers
const oldChangeQtyBlock = `      // Block theme.js rebuild for ALL cart changes
      window.__ccd_block_rebuild = true;
      setTimeout(function() { window.__ccd_block_rebuild = false; }, 800);`;
const newChangeQtyBlock = `      // Block theme.js rebuild during our cart change
      window.__ccd_block_rebuild = true;`;

code = tryReplace(code, oldChangeQtyBlock, newChangeQtyBlock, 'Remove fixed timeout in changeQty');

// 4. Unblock in the .then() handler AFTER our refresh/update completes
const oldThenBusy = `        window.__ccd_last_cart = cart; // cache for fetch interceptor
        busy = false;`;
const newThenBusy = `        window.__ccd_last_cart = cart;
        busy = false;`;
code = tryReplace(code, oldThenBusy, newThenBusy, 'Clean up cache comment');

// Find where we stop blocking — it should be after our DOM updates complete
// In the remove path (lightweight update), unblock after totals update
const oldRemoveEnd = `          // Update progress with real cart data
          CCD.updateProgress(cart);
          // Check empty cart
          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) { setTimeout(function() { CCD.refresh(cart); }, 50); }`;
const newRemoveEnd = `          // Update progress with real cart data
          CCD.updateProgress(cart);
          // Unblock theme rebuild now that our update is done
          setTimeout(function() { window.__ccd_block_rebuild = false; }, 300);
          // Check empty cart
          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) { setTimeout(function() { CCD.refresh(cart); }, 50); }`;
code = tryReplace(code, oldRemoveEnd, newRemoveEnd, 'Unblock after remove update');

// In the non-remove path (full refresh), unblock after refresh
const oldElseRefresh = `        } else {
          CCD.refresh(cart);
        }`;
const newElseRefresh = `        } else {
          CCD.refresh(cart);
          setTimeout(function() { window.__ccd_block_rebuild = false; }, 300);
        }`;
code = tryReplace(code, oldElseRefresh, newElseRefresh, 'Unblock after full refresh');

// In catch handler, always unblock
const oldCatch = `      .catch(function() {
        busy = false;`;
const newCatch = `      .catch(function() {
        window.__ccd_block_rebuild = false;
        busy = false;`;
code = tryReplace(code, oldCatch, newCatch, 'Unblock in catch');

// 5. Also keep the block in the remove click handler
// Check current state of remove handler
const removeBlockCheck = code.indexOf('__ccd_block_rebuild = true;');
if (removeBlockCheck !== -1) {
  console.log('Block flag found in code at index:', removeBlockCheck);
} else {
  console.log('WARNING: No __ccd_block_rebuild = true found');
}

// Remove the 500ms timeout from the remove handler if it exists
const old500 = `            window.__ccd_block_rebuild = true;
            setTimeout(function() { window.__ccd_block_rebuild = false; }, 500);`;
const new500 = `            window.__ccd_block_rebuild = true;`;
code = tryReplace(code, old500, new500, 'Remove 500ms timeout in remove handler');

fs.writeFileSync(file, code, 'utf8');
console.log('\nDone. Size:', code.length);
