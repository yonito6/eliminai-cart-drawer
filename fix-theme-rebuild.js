// Fix: prevent Impulse theme from rebuilding cart during our animations
// 1. Intercept fetch to block theme's parallel /cart/change.js calls
// 2. Add e.stopImmediatePropagation() to all click handlers
// 3. Optimistic progress bar update on remove and qty change

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');
const origLen = code.length;

// ============================================================
// FIX 1: Replace the dispatchEvent interceptor with a FETCH interceptor
// This blocks the theme from making its own /cart/change.js calls
// ============================================================

const oldInterceptor = `  // Intercept theme.js cart rebuilds during our animations
  var _origDispatch = document.dispatchEvent.bind(document);
  document.dispatchEvent = function(evt) {
    if (window.__ccd_block_rebuild && evt.type && (evt.type === 'cart:updated' || evt.type === 'cart:build')) {
      return true; // swallow event
    }
    return _origDispatch(evt);
  };`;

const newInterceptor = `  // Intercept theme.js cart rebuilds: block its fetch + swallow its events
  var _origDispatch = document.dispatchEvent.bind(document);
  document.dispatchEvent = function(evt) {
    if (window.__ccd_block_rebuild && evt.type && (evt.type === 'cart:updated' || evt.type === 'cart:build')) {
      return true;
    }
    return _origDispatch(evt);
  };
  // Intercept fetch: when __ccd_block_rebuild is active, return cached cart for /cart/change.js
  var _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (window.__ccd_block_rebuild && typeof url === 'string' && url.indexOf('/cart/change.js') !== -1) {
      // Return the last known cart state so theme.js gets a response but doesn't trigger rebuild
      var cached = window.__ccd_last_cart;
      if (cached) {
        return Promise.resolve(new Response(JSON.stringify(cached), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        }));
      }
    }
    return _origFetch.apply(this, arguments);
  };`;

if (code.indexOf(oldInterceptor) === -1) {
  // Try with \r\n
  const oldCRLF = oldInterceptor.replace(/\n/g, '\r\n');
  if (code.indexOf(oldCRLF) !== -1) {
    code = code.replace(oldCRLF, newInterceptor.replace(/\n/g, '\r\n'));
    console.log('FIX 1: Replaced interceptor (CRLF)');
  } else {
    console.log('FIX 1: WARNING - old interceptor not found, searching by partial match...');
    // Try partial
    const partial = 'Intercept theme.js cart rebuilds during our animations';
    const idx = code.indexOf(partial);
    if (idx !== -1) {
      // Find the closing of the interceptor block (the };)
      const endMarker = "return _origDispatch(evt);\r\n  };";
      const endMarker2 = "return _origDispatch(evt);\n  };";
      let endIdx = code.indexOf(endMarker, idx);
      let eol = '\r\n';
      if (endIdx === -1) {
        endIdx = code.indexOf(endMarker2, idx);
        eol = '\n';
      }
      if (endIdx !== -1) {
        const blockEnd = endIdx + (eol === '\r\n' ? endMarker.length : endMarker2.length);
        const lineStart = code.lastIndexOf(eol, idx) + eol.length;
        code = code.substring(0, lineStart) + newInterceptor.replace(/\n/g, eol) + code.substring(blockEnd);
        console.log('FIX 1: Replaced interceptor (partial match)');
      } else {
        console.log('FIX 1: FAILED - could not find end of interceptor block');
      }
    } else {
      console.log('FIX 1: FAILED - interceptor not found at all');
    }
  }
} else {
  code = code.replace(oldInterceptor, newInterceptor);
  console.log('FIX 1: Replaced interceptor (LF)');
}


// ============================================================
// FIX 2: Add e.stopImmediatePropagation() to click handlers
// This prevents theme.js from seeing our button clicks at all
// ============================================================

// For minus button
const oldMinus = `        if (minusBtn) {
          e.preventDefault();`;
const newMinus = `        if (minusBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();`;

// For plus button
const oldPlus = `        if (plusBtn) {
          e.preventDefault();`;
const newPlus = `        if (plusBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();`;

// For remove button
const oldRemove = `        if (removeBtn) {
          e.preventDefault();`;
const newRemove = `        if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();`;

// For gift remove
const oldGiftRemove = `        if (giftRemoveBtn) {
          e.preventDefault();`;
const newGiftRemove = `        if (giftRemoveBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();`;

function replaceWithEol(src, old, replacement) {
  if (src.indexOf(old) !== -1) {
    return { code: src.replace(old, replacement), found: true };
  }
  const oldCR = old.replace(/\n/g, '\r\n');
  const newCR = replacement.replace(/\n/g, '\r\n');
  if (src.indexOf(oldCR) !== -1) {
    return { code: src.replace(oldCR, newCR), found: true };
  }
  return { code: src, found: false };
}

let r;
r = replaceWithEol(code, oldMinus, newMinus);
code = r.code;
console.log('FIX 2a (minus stopImmediatePropagation):', r.found ? 'OK' : 'NOT FOUND');

r = replaceWithEol(code, oldPlus, newPlus);
code = r.code;
console.log('FIX 2b (plus stopImmediatePropagation):', r.found ? 'OK' : 'NOT FOUND');

r = replaceWithEol(code, oldRemove, newRemove);
code = r.code;
console.log('FIX 2c (remove stopImmediatePropagation):', r.found ? 'OK' : 'NOT FOUND');

r = replaceWithEol(code, oldGiftRemove, newGiftRemove);
code = r.code;
console.log('FIX 2d (gift remove stopImmediatePropagation):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// FIX 3: Cache cart data for fetch interceptor + extend block window
// In changeQty, save cart response to __ccd_last_cart
// ============================================================

const oldChangeQtyThen = `.then(function(cart) {
        busy = false;`;
const newChangeQtyThen = `.then(function(cart) {
        window.__ccd_last_cart = cart; // cache for fetch interceptor
        busy = false;`;

r = replaceWithEol(code, oldChangeQtyThen, newChangeQtyThen);
code = r.code;
console.log('FIX 3 (cache cart in changeQty):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// FIX 4: Extend __ccd_block_rebuild window to 800ms (theme can be slow)
// and set it for ALL qty changes, not just removes
// ============================================================

// Move the block_rebuild flag to changeQty start (before fetch), not just remove click
const oldChangeQtyStart = `    changeQty: function(key, qty, btnEl) {
      if (busy) return;`;
const newChangeQtyStart = `    changeQty: function(key, qty, btnEl) {
      if (busy) return;
      // Block theme.js rebuild for ALL cart changes
      window.__ccd_block_rebuild = true;
      setTimeout(function() { window.__ccd_block_rebuild = false; }, 800);`;

r = replaceWithEol(code, oldChangeQtyStart, newChangeQtyStart);
code = r.code;
console.log('FIX 4 (block rebuild for all qty changes):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// FIX 5: Optimistic progress bar update on remove
// In the remove click handler, update progress immediately
// ============================================================

// After the remove animation starts and before CCD.changeQty, add optimistic progress update
const oldRemoveChangeQty = `          CCD.changeQty(rmKey, 0);`;
const newRemoveChangeQty = `          // Optimistic progress update: count will decrease
          CCD.updateProgressOptimistic(-1);
          CCD.changeQty(rmKey, 0);`;

r = replaceWithEol(code, oldRemoveChangeQty, newRemoveChangeQty);
code = r.code;
console.log('FIX 5 (optimistic progress on remove):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// FIX 6: Optimistic progress bar update on qty+
// ============================================================

const oldPlusChangeQty = `          input.value = newVal; // optimistic: show new qty instantly
          CCD.changeQty(input.dataset.id, newVal, plusBtn);`;
const newPlusChangeQty = `          input.value = newVal; // optimistic: show new qty instantly
          CCD.updateProgressOptimistic(+1);
          CCD.changeQty(input.dataset.id, newVal, plusBtn);`;

r = replaceWithEol(code, oldPlusChangeQty, newPlusChangeQty);
code = r.code;
console.log('FIX 6 (optimistic progress on qty+):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// FIX 7: Optimistic progress bar update on qty-
// ============================================================

const oldMinusChangeQty = `          if (newVal > 0) input.value = newVal; // optimistic
          CCD.changeQty(input.dataset.id, newVal, minusBtn);`;
const newMinusChangeQty = `          if (newVal > 0) input.value = newVal; // optimistic
          CCD.updateProgressOptimistic(-1);
          CCD.changeQty(input.dataset.id, newVal, minusBtn);`;

r = replaceWithEol(code, oldMinusChangeQty, newMinusChangeQty);
code = r.code;
console.log('FIX 7 (optimistic progress on qty-):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// FIX 8: Add updateProgressOptimistic() method
// This updates the progress bar UI immediately based on a delta
// ============================================================

const progressMethodEnd = `      // Sync all milestone pulse animations to same cycle
      var reached = document.querySelectorAll('.ccd-progress__icon--reached');
      if (reached.length > 0) {
        reached.forEach(function(el) { el.style.animation = 'none'; });
        // Force reflow then restart all at same instant
        void document.body.offsetHeight;
        reached.forEach(function(el) { el.style.animation = ''; });
      }
    },`;

const newProgressMethod = `      // Sync all milestone pulse animations to same cycle
      var reached = document.querySelectorAll('.ccd-progress__icon--reached');
      if (reached.length > 0) {
        reached.forEach(function(el) { el.style.animation = 'none'; });
        // Force reflow then restart all at same instant
        void document.body.offsetHeight;
        reached.forEach(function(el) { el.style.animation = ''; });
      }
    },

    // Optimistic progress update: adjust count by delta without waiting for API
    updateProgressOptimistic: function(delta) {
      var a = document.querySelector('[data-real-count]');
      if (!a) return;
      var rc = parseInt(a.getAttribute('data-real-count') || '0') + delta;
      if (rc < 0) rc = 0;
      a.setAttribute('data-real-count', rc);
      // Build a minimal fake cart object for updateProgress
      CCD.updateProgress({ items: [], _optimisticCount: rc });
    },`;

// Override updateProgress to handle _optimisticCount
// We need to patch the top of updateProgress to check for _optimisticCount
const oldProgressTop = `    updateProgress: function(cart) {
      var rc, uv;
      if (cart) {
        rc = CCD.getRealCount(cart);
        uv = CCD.getUniqueVariants(cart);
      } else {`;
const newProgressTop = `    updateProgress: function(cart) {
      var rc, uv;
      if (cart && cart._optimisticCount !== undefined) {
        rc = cart._optimisticCount;
        uv = rc; // approximate
      } else if (cart) {
        rc = CCD.getRealCount(cart);
        uv = CCD.getUniqueVariants(cart);
      } else {`;

r = replaceWithEol(code, progressMethodEnd, newProgressMethod);
code = r.code;
console.log('FIX 8a (add updateProgressOptimistic):', r.found ? 'OK' : 'NOT FOUND');

r = replaceWithEol(code, oldProgressTop, newProgressTop);
code = r.code;
console.log('FIX 8b (updateProgress optimistic support):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// FIX 9: In remove path, also update totals immediately from DOM
// and update subtotal optimistically
// ============================================================

// In the remove lightweight path, also call updateProgress with real cart
const oldRemoveLightweight = `          // Check empty cart
          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) { setTimeout(function() { CCD.refresh(cart); }, 50); }`;
const newRemoveLightweight = `          // Update progress with real cart data
          CCD.updateProgress(cart);
          // Check empty cart
          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) { setTimeout(function() { CCD.refresh(cart); }, 50); }`;

r = replaceWithEol(code, oldRemoveLightweight, newRemoveLightweight);
code = r.code;
console.log('FIX 9 (progress update in remove path):', r.found ? 'OK' : 'NOT FOUND');


// ============================================================
// Write out
// ============================================================
fs.writeFileSync(file, code, 'utf8');
console.log('\nDone. File size: ' + origLen + ' -> ' + code.length + ' bytes');
