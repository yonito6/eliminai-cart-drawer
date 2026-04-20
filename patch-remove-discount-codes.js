const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');
let changes = 0;

// 1. Update showFree logic — no longer depends on GIFT_DISCOUNT_CODES
// Gift items are $0, so linePrice === 0 is enough. Also check isGiftItem for compare_at_price display.
const old1 = 'var showFree = (linePrice === 0 && hasDiscount) || (isGiftItem && GIFT_DISCOUNT_CODES.length > 0);';
const new1 = 'var showFree = linePrice === 0 && (isGiftItem || hasDiscount);';
if (code.includes(old1)) {
  code = code.replace(old1, new1);
  changes++;
  console.log('1. Updated showFree logic');
} else {
  console.log('1. SKIP showFree');
}

// 2. Remove discount code redirect at checkout — just go directly to /checkout
// Find the block that redirects via /discount/CODE
const old2 = `          // If gift in cart AND we have discount codes, chain them via /discount/CODE
          if (hasGiftInCart && GIFT_DISCOUNT_CODES.length > 0) {
            var codes = GIFT_DISCOUNT_CODES.join(',');
            window.location.href = '/discount/' + codes + '?redirect=/checkout';
          } else {
            window.location.href = '/checkout';
          }`;
const new2 = `          window.location.href = '/checkout';`;
if (code.includes(old2)) {
  code = code.replace(old2, new2);
  changes++;
  console.log('2. Removed discount redirect — direct checkout');
} else {
  console.log('2. SKIP discount redirect');
  // Try to find the hasGiftInCart block
  const idx = code.indexOf('hasGiftInCart && GIFT_DISCOUNT_CODES');
  if (idx >= 0) console.log('   Found at index', idx, '- manual check needed');
}

// 3. Remove hasGiftInCart detection block (no longer needed)
const old3 = `          var hasGiftInCart = false;
          if (CCD._lastCart && CCD._lastCart.items) {
            CCD._lastCart.items.forEach(function(item) {
              if (GIFT_HANDLES[item.handle] || item.handle === WATCH_CASE_HANDLE) hasGiftInCart = true;
            });
          }

          window.location.href = '/checkout';`;
const new3 = `          window.location.href = '/checkout';`;
if (code.includes(old3)) {
  code = code.replace(old3, new3);
  changes++;
  console.log('3. Removed hasGiftInCart block');
} else {
  console.log('3. SKIP hasGiftInCart cleanup (may already be simplified)');
}

fs.writeFileSync(file, code);
console.log('\n' + changes + ' changes applied. File size:', code.length);
