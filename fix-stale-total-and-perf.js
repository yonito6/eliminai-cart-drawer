/**
 * Fix: Stale total after remove + slow cart performance
 *
 * ROOT CAUSE (stale total):
 * checkWatchCase() uses the intercepted `fetch` for gift adds via _addOneGift.
 * The add-to-cart interceptor catches these, creates PARALLEL refresh chains
 * (each: /cart.js → CCD.refresh → protection tier swap). A tier swap chain
 * started from an intermediate cart state can finish AFTER the final correct
 * refresh, overwriting the correct total with stale data.
 *
 * ROOT CAUSE (slow perf):
 * Same interceptor issue — every gift add triggers an extra /cart.js fetch +
 * CCD.refresh() + possibly more API calls. With 3 gifts, that's 3 extra
 * refresh chains running in parallel. Plus the 350ms delay for the post-remove
 * refresh adds perceived lag.
 *
 * FIX:
 * 1. Make _addOneGift and all checkWatchCase API calls use CCD._origFetch
 *    to bypass the interceptor entirely (gift management handles its own refresh)
 * 2. Add a refresh generation counter — stale refreshes silently no-op
 * 3. Add .catch() to the delayed /cart.js fetch
 * 4. Reduce the post-remove delay from 350ms to 150ms (enough for Shopify BXGY)
 * 5. Make gift removes also use _origFetch
 */

const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
const origLen = code.length;

// ── FIX 1: Add refresh generation counter (after busy/pendingOp declarations) ──
const afterBusy = `  var busy = false;
  var _pendingOp = null; // queued operation when busy`;

const withGenCounter = `  var busy = false;
  var _pendingOp = null; // queued operation when busy
  var _refreshGen = 0; // generation counter — stale refreshes silently no-op`;

if (!code.includes(afterBusy)) {
  console.error('ERROR: Could not find busy/pendingOp declarations');
  process.exit(1);
}
code = code.replace(afterBusy, withGenCounter);
console.log('✓ Added _refreshGen counter');

// ── FIX 2: Guard CCD.refresh() with generation counter ──
const oldRefreshStart = `    refresh: function(cart) {
      console.log("[CCD] refresh() called");
      CCD.updateCartBubble(cart);`;

const newRefreshStart = `    refresh: function(cart, _gen) {
      // Generation guard: if a newer refresh was requested, skip this stale one
      if (_gen !== undefined && _gen < _refreshGen) {
        console.log("[CCD] refresh() skipped — stale gen " + _gen + " < " + _refreshGen);
        return;
      }
      console.log("[CCD] refresh() called gen=" + (_gen || 'direct'));
      CCD.updateCartBubble(cart);`;

if (!code.includes(oldRefreshStart)) {
  console.error('ERROR: Could not find refresh() start');
  process.exit(1);
}
code = code.replace(oldRefreshStart, newRefreshStart);
console.log('✓ Added generation guard to refresh()');

// ── FIX 3: Make the delayed /cart.js fetch use generation counter + error handling ──
const oldDelayedFetch = `            window.__ccd_block_rebuild = false;
            setTimeout(function() {
              fetch("/cart.js").then(function(r) { return r.json(); }).then(function(freshCart) {
                CCD.refresh(freshCart);
              });
            }, 350);`;

const newDelayedFetch = `            window.__ccd_block_rebuild = false;
            var _rmGen = ++_refreshGen; // claim a generation for this refresh
            setTimeout(function() {
              var _oF = CCD._origFetch || fetch;
              _oF("/cart.js").then(function(r) { return r.json(); }).then(function(freshCart) {
                CCD.refresh(freshCart, _rmGen);
              }).catch(function(err) {
                console.warn("[CCD] post-remove /cart.js fetch failed:", err);
              });
            }, 150);`;

if (!code.includes(oldDelayedFetch)) {
  console.error('ERROR: Could not find delayed /cart.js fetch in remove path');
  // Try to show context
  const idx = code.indexOf('window.__ccd_block_rebuild = false;\n            setTimeout');
  if (idx >= 0) {
    console.log('Found partial match at index', idx);
    console.log('Context:', code.substring(idx, idx + 400));
  }
  process.exit(1);
}
code = code.replace(oldDelayedFetch, newDelayedFetch);
console.log('✓ Fixed delayed fetch: _origFetch, generation counter, .catch(), 150ms');

// ── FIX 4: Make checkWatchCase use _origFetch for ALL API calls ──

// Fix gift qty > 1 guard
const oldFixQty = `        watchCaseBusy = true;
        fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: fixKey, quantity: 1 })
        })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
        return;`;

const newFixQty = `        watchCaseBusy = true;
        var _oF = CCD._origFetch || fetch;
        _oF('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: fixKey, quantity: 1 })
        })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
        return;`;

if (code.includes(oldFixQty)) {
  code = code.replace(oldFixQty, newFixQty);
  console.log('✓ Fixed gift qty guard to use _origFetch');
} else {
  console.log('⚠ Gift qty guard patch skipped (not found exactly)');
}

// Fix _addOneGift to use _origFetch
const oldAddOneGift = `      function _addOneGift(item) {
        var body = 'id=' + item.id + '&quantity=1&properties%5B_eliminai_gift%5D=true';
        return fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body
        })`;

const newAddOneGift = `      function _addOneGift(item) {
        var body = 'id=' + item.id + '&quantity=1&properties%5B_eliminai_gift%5D=true';
        var _oF = CCD._origFetch || fetch;
        return _oF('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body
        })`;

if (!code.includes(oldAddOneGift)) {
  console.error('ERROR: Could not find _addOneGift');
  process.exit(1);
}
code = code.replace(oldAddOneGift, newAddOneGift);
console.log('✓ Fixed _addOneGift to use _origFetch (bypasses interceptor)');

// Fix gift remove chain to use _origFetch
const oldRemoveChain = `        var removeChain = Promise.resolve();
        toRemove.forEach(function(key) {
          removeChain = removeChain.then(function() {
            return fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: key, quantity: 0 })
            });
          });
        });`;

const newRemoveChain = `        var _oF2 = CCD._origFetch || fetch;
        var removeChain = Promise.resolve();
        toRemove.forEach(function(key) {
          removeChain = removeChain.then(function() {
            return _oF2('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: key, quantity: 0 })
            });
          });
        });`;

if (code.includes(oldRemoveChain)) {
  code = code.replace(oldRemoveChain, newRemoveChain);
  console.log('✓ Fixed gift remove chain to use _origFetch');
} else {
  console.log('⚠ Gift remove chain patch skipped (not found exactly)');
}

// Fix the final /cart.js fetch after gift management (remove+add path)
const oldGiftFinalFetch1 = `.then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] remove+add catch:', err); watchCaseBusy = false; });`;

const newGiftFinalFetch1 = `.then(function() { var _oF3 = CCD._origFetch || fetch; return _oF3('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; ++_refreshGen; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] remove+add catch:', err); watchCaseBusy = false; });`;

if (code.includes(oldGiftFinalFetch1)) {
  code = code.replace(oldGiftFinalFetch1, newGiftFinalFetch1);
  console.log('✓ Fixed gift remove+add final fetch to use _origFetch + bump gen');
} else {
  console.log('⚠ Gift remove+add final fetch patch skipped');
}

// Fix the add-only path final /cart.js fetch
const oldGiftFinalFetch2 = `        addChain
        .then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] add catch:', err); watchCaseBusy = false; });`;

const newGiftFinalFetch2 = `        addChain
        .then(function() { var _oF4 = CCD._origFetch || fetch; return _oF4('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; ++_refreshGen; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] add catch:', err); watchCaseBusy = false; });`;

if (code.includes(oldGiftFinalFetch2)) {
  code = code.replace(oldGiftFinalFetch2, newGiftFinalFetch2);
  console.log('✓ Fixed gift add-only final fetch to use _origFetch + bump gen');
} else {
  console.log('⚠ Gift add-only final fetch patch skipped');
}

// ── FIX 5: Make protection tier swap bumps generation so gift management refresh wins ──
// In refresh(), the tier swap chain should bump generation before its final refresh
const oldTierSwapRefresh = `.then(function(swappedCart) { CCD.refresh(swappedCart); });
          return; // Skip rest of refresh — will re-enter with correct cart`;

const newTierSwapRefresh = `.then(function(swappedCart) { ++_refreshGen; CCD.refresh(swappedCart); });
          return; // Skip rest of refresh — will re-enter with correct cart`;

// There are TWO tier swap blocks (refresh and refreshLight)
let swapCount = 0;
while (code.includes(oldTierSwapRefresh)) {
  code = code.replace(oldTierSwapRefresh, newTierSwapRefresh);
  swapCount++;
}
console.log('✓ Fixed ' + swapCount + ' tier swap chains to bump _refreshGen');

// ── FIX 6: Make the interceptor's CCD.refresh() use generation guard ──
// The interceptor at lines ~1439/1453/1456/1483 calls CCD.refresh(cart)
// These should use a generation so they don't overwrite gift management's final refresh
// We need to make these claim a generation BEFORE starting their chain

// Find the interceptor's post-add refresh section
const oldInterceptorRefresh = `              origFetch('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
                  // After add completes: if protection missing and should be on, add it now`;

const newInterceptorRefresh = `              var _interceptGen = ++_refreshGen;
                origFetch('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
                  // After add completes: if protection missing and should be on, add it now`;

if (code.includes(oldInterceptorRefresh)) {
  code = code.replace(oldInterceptorRefresh, newInterceptorRefresh);
  console.log('✓ Made interceptor claim a generation');

  // Now make the interceptor's CCD.refresh calls use _interceptGen
  // There are 3: fullCart, fixedCart, cart (fallback)
  // These are all inside the same closure, so _interceptGen is accessible

  // CCD.refresh(fullCart) after protection add
  const oldIntRef1 = `.then(function(fullCart) { CCD.refresh(fullCart); })
                    .catch(function() { CCD.refresh(cart); });`;
  const newIntRef1 = `.then(function(fullCart) { CCD.refresh(fullCart, _interceptGen); })
                    .catch(function() { CCD.refresh(cart, _interceptGen); });`;
  if (code.includes(oldIntRef1)) {
    code = code.replace(oldIntRef1, newIntRef1);
    console.log('✓ Interceptor protection-add refresh uses gen');
  }

  // CCD.refresh(fixedCart) after qty fix
  const oldIntRef2 = `.then(function(fixedCart) { CCD.refresh(fixedCart); })
                      .catch(function() { CCD.refresh(cart); });`;
  const newIntRef2 = `.then(function(fixedCart) { CCD.refresh(fixedCart, _interceptGen); })
                      .catch(function() { CCD.refresh(cart, _interceptGen); });`;
  if (code.includes(oldIntRef2)) {
    code = code.replace(oldIntRef2, newIntRef2);
    console.log('✓ Interceptor qty-fix refresh uses gen');
  }

  // CCD.refresh(cart) fallback
  const oldIntRef3 = `                    } else {
                      CCD.refresh(cart);
                    }`;
  const newIntRef3 = `                    } else {
                      CCD.refresh(cart, _interceptGen);
                    }`;
  if (code.includes(oldIntRef3)) {
    code = code.replace(oldIntRef3, newIntRef3);
    console.log('✓ Interceptor fallback refresh uses gen');
  }
} else {
  console.log('⚠ Interceptor refresh section not found exactly');
}

// Write result
fs.writeFileSync('v14-complete.js', code);
console.log('\n✅ All patches applied');
console.log('File size: ' + origLen + ' → ' + code.length + ' bytes');
console.log('\nSummary:');
console.log('  1. _refreshGen counter prevents stale refreshes from overwriting fresh ones');
console.log('  2. _addOneGift bypasses interceptor (no parallel refresh chains from gift adds)');
console.log('  3. Gift remove chain uses _origFetch');
console.log('  4. Post-remove delay reduced from 350ms to 150ms');
console.log('  5. Missing .catch() added to post-remove fetch');
console.log('  6. Interceptor refresh calls use generation guard');
console.log('  7. Tier swap and gift management bump generation to claim priority');
