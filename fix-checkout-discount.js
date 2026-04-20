const fs = require('fs');
let js = fs.readFileSync('v14-complete.js', 'utf8');

// Change from /discount/CODE?redirect=/checkout to /checkout?discount=CODE
// The /discount/ URL doesn't work reliably on password-protected stores
// and may not stack with automatic BXGY discounts.
// /checkout?discount=CODE passes the code directly to checkout.
const old = `            var codes = GIFT_DISCOUNT_CODES.length > 0 ? GIFT_DISCOUNT_CODES.join(',') : '';
            window.location.href = codes ? '/discount/' + codes + '?redirect=/checkout' : '/checkout';`;

const fixed = `            var codes = GIFT_DISCOUNT_CODES.length > 0 ? GIFT_DISCOUNT_CODES.join(',') : '';
            window.location.href = codes ? '/checkout?discount=' + codes : '/checkout';`;

if (js.includes(old)) {
  js = js.replace(old, fixed);
  console.log('OK: changed to /checkout?discount=CODE');
} else {
  console.log('FAILED: pattern not found');
  // Debug
  const idx = js.indexOf('GIFT_DISCOUNT_CODES.join');
  if (idx > -1) console.log('Context:', js.substring(idx - 50, idx + 150));
}

js = js.replace('CCD v15.7', 'CCD v15.8');
fs.writeFileSync('v14-complete.js', js);
console.log('Done — v15.8');
