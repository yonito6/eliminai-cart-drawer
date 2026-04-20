const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Add FREE_PRICE_LABEL config variable after GIFT_HIDE_DISCOUNT_LABEL line
const anchor1 = "var GIFT_HIDE_DISCOUNT_LABEL = (_fsb.giftHideDiscountLabel !== undefined ? _fsb.giftHideDiscountLabel : CFG.giftHideDiscountLabel) !== false;";
if (code.includes(anchor1)) {
  code = code.replace(anchor1, anchor1 + "\n  var FREE_PRICE_LABEL = _fsb.freePriceLabel || CFG.freePriceLabel || 'Free';");
  console.log('OK: Added FREE_PRICE_LABEL config');
} else {
  console.log('WARN: anchor1 not found');
}

// 2. Change the price display logic — show Free for ANY $0 item with discounts
const anchor2 = "var isGiftHandle = GIFT_HANDLES[item.handle] || item.handle === WATCH_CASE_HANDLE;\n        var priceLabel = (linePrice === 0 && isGiftHandle) ? 'Free' : CCD.fmt(linePrice);\n        var priceClass = (linePrice === 0 && isGiftHandle) ? 'ccd-item__price ccd-item__price--free' : 'ccd-item__price';";
const replacement2 = "var hasDiscount = item.discounts && item.discounts.length > 0;\n        var priceLabel = (linePrice === 0 && hasDiscount) ? FREE_PRICE_LABEL : CCD.fmt(linePrice);\n        var priceClass = (linePrice === 0 && hasDiscount) ? 'ccd-item__price ccd-item__price--free' : 'ccd-item__price';";
if (code.includes(anchor2)) {
  code = code.replace(anchor2, replacement2);
  console.log('OK: Updated price display logic');
} else {
  console.log('WARN: anchor2 not found');
}

fs.writeFileSync('v14-complete.js', code);

// Verify
console.log('FREE_PRICE_LABEL present:', code.includes('FREE_PRICE_LABEL'));
console.log('hasDiscount present:', code.includes('hasDiscount'));
console.log('Old isGiftHandle removed:', code.indexOf('isGiftHandle') === -1 ? 'yes' : 'still present at index ' + code.indexOf('isGiftHandle'));
