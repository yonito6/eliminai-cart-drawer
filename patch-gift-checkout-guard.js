const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');

// Replace the checkout click handler to validate gifts before redirecting
const oldCheckout = `      // Checkout button — apply gift discount code if gift is in cart
      document.addEventListener('click', function(e) {
        var checkoutBtn = e.target.closest('.ccd-checkout-btn');
        if (checkoutBtn && !checkoutBtn.classList.contains('ccd-checkout-btn--loading')) {
          checkoutBtn.classList.add('ccd-checkout-btn--loading');
          e.preventDefault();
          e.stopPropagation();

          // Check if any gift product is in the cart
          window.location.href = '/checkout';
        }
      });`;

const newCheckout = `      // Checkout button — validate gift eligibility, then redirect
      document.addEventListener('click', function(e) {
        var checkoutBtn = e.target.closest('.ccd-checkout-btn');
        if (checkoutBtn && !checkoutBtn.classList.contains('ccd-checkout-btn--loading')) {
          checkoutBtn.classList.add('ccd-checkout-btn--loading');
          e.preventDefault();
          e.stopPropagation();

          // GUARD: Remove unearned gift items before checkout
          var lastCart = CCD._lastCart;
          if (lastCart && lastCart.items && GIFT_TIERS.length > 0) {
            var score = THRESHOLD_MODE === 'dollars'
              ? (CCD.getAdjustedTotal(lastCart) / 100)
              : CCD.getRealCount(lastCart);
            // Determine which gift handles are earned
            var earned = {};
            var eligibleGifts = [];
            GIFT_TIERS.forEach(function(t) {
              if (tierGifts(t).length > 0 && score >= t.goal) eligibleGifts.push(t);
            });
            if (HIGHEST_TIER_ONLY && eligibleGifts.length > 0) {
              tierGifts(eligibleGifts[eligibleGifts.length - 1]).forEach(function(g) { if (g.handle) earned[g.handle] = true; });
            } else {
              eligibleGifts.forEach(function(t) {
                tierGifts(t).forEach(function(g) { if (g.handle) earned[g.handle] = true; });
              });
            }
            // Find unearned gift items in cart
            var unearnedKeys = [];
            lastCart.items.forEach(function(i) {
              if ((GIFT_HANDLES[i.handle] || i.handle === WATCH_CASE_HANDLE) && !earned[i.handle]) {
                unearnedKeys.push(i.key);
              }
            });
            if (unearnedKeys.length > 0) {
              console.warn('[CCD] Removing ' + unearnedKeys.length + ' unearned gift items before checkout');
              var _oF = CCD._origFetch || fetch;
              var removeChain = Promise.resolve();
              unearnedKeys.forEach(function(key) {
                removeChain = removeChain.then(function() {
                  return _oF('/cart/change.js', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: key, quantity: 0 })
                  });
                });
              });
              removeChain.then(function() {
                window.location.href = '/checkout';
              }).catch(function() {
                window.location.href = '/checkout';
              });
              return;
            }
          }
          window.location.href = '/checkout';
        }
      });`;

if (code.includes(oldCheckout)) {
  code = code.replace(oldCheckout, newCheckout);
  fs.writeFileSync(file, code);
  console.log('PATCHED: Added gift checkout guard');
} else {
  console.log('SKIP: Could not find checkout handler');
  // Debug
  const idx = code.indexOf('Checkout button');
  if (idx >= 0) console.log('Found "Checkout button" at index', idx);
}
