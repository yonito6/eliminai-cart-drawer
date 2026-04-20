const fs = require('fs');
let js = fs.readFileSync('v14-complete.js', 'utf8');

// Since ALL gift discounts are now automatic BXGY (no codes needed),
// the checkout button can just go straight to /checkout.
// No more /discount/CODE redirect needed.
const old = `          var lastCart = window.__ccd_last_cart;
          var hasGift = lastCart && lastCart.items && lastCart.items.some(function(i) { return GIFT_HANDLES[i.handle] || i.handle === WATCH_CASE_HANDLE; });
          if (hasGift) {
            e.preventDefault();
            e.stopPropagation();
            var codes = GIFT_DISCOUNT_CODES.length > 0 ? GIFT_DISCOUNT_CODES.join(',') : '';
            window.location.href = codes ? '/checkout?discount=' + codes : '/checkout';
            return;
          }
          // No gift — go straight to checkout
          window.location.href = '/checkout';`;

const fixed = `          // All gift discounts are automatic BXGY — no codes needed.
          // Just go straight to checkout.
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/checkout';`;

if (js.includes(old)) {
  js = js.replace(old, fixed);
  console.log('OK: simplified checkout to always /checkout (no discount codes)');
} else {
  console.log('FAILED: pattern not found');
  const idx = js.indexOf('GIFT_DISCOUNT_CODES');
  if (idx > -1) console.log('Context:', js.substring(idx - 100, idx + 200));
}

js = js.replace('CCD v15.8', 'CCD v15.9');
fs.writeFileSync('v14-complete.js', js);
console.log('Done — v15.9');
