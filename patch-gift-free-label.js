const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// Find and replace the price display block
const oldBlock = `      // Price display — show compare price if discounted
      var priceRowHtml = '';
      var unitPrice = item.final_price != null ? item.final_price : item.price;
      var linePrice = item.final_line_price != null ? item.final_line_price : (unitPrice * item.quantity);
      var origLinePrice = item.original_line_price || (item.original_price || item.price) * item.quantity;
      if (origLinePrice > linePrice) {
        var hasDiscount = item.discounts && item.discounts.length > 0;
        var priceLabel = (linePrice === 0 && hasDiscount) ? FREE_PRICE_LABEL : CCD.fmt(linePrice);
        var priceClass = (linePrice === 0 && hasDiscount) ? 'ccd-item__price ccd-item__price--free' : 'ccd-item__price';
        priceRowHtml = '<div class="ccd-item__price-row">' +
          '<span class="ccd-item__compare-price">' + CCD.fmt(origLinePrice) + '</span>' +
          '<span class="' + priceClass + '">' + priceLabel + '</span>' +
        '</div>';
      } else {
        priceRowHtml = '<div class="ccd-item__price-row">' +
          '<span class="ccd-item__price">' + CCD.fmt(linePrice) + '</span>' +
        '</div>';
      }`;

const newBlock = `      // Price display — show Free for gift items (code applied at checkout) or discounted items
      var priceRowHtml = '';
      var unitPrice = item.final_price != null ? item.final_price : item.price;
      var linePrice = item.final_line_price != null ? item.final_line_price : (unitPrice * item.quantity);
      var origLinePrice = item.original_line_price || (item.original_price || item.price) * item.quantity;
      var hasDiscount = item.discounts && item.discounts.length > 0;
      var isGiftItem = GIFT_HANDLES[item.handle] || item.handle === WATCH_CASE_HANDLE;
      var showFree = (linePrice === 0 && hasDiscount) || (isGiftItem && GIFT_DISCOUNT_CODES.length > 0);
      if (showFree) {
        priceRowHtml = '<div class="ccd-item__price-row">' +
          (origLinePrice > 0 ? '<span class="ccd-item__compare-price">' + CCD.fmt(origLinePrice) + '</span>' : '') +
          '<span class="ccd-item__price ccd-item__price--free">' + FREE_PRICE_LABEL + '</span>' +
        '</div>';
      } else if (origLinePrice > linePrice) {
        priceRowHtml = '<div class="ccd-item__price-row">' +
          '<span class="ccd-item__compare-price">' + CCD.fmt(origLinePrice) + '</span>' +
          '<span class="ccd-item__price">' + CCD.fmt(linePrice) + '</span>' +
        '</div>';
      } else {
        priceRowHtml = '<div class="ccd-item__price-row">' +
          '<span class="ccd-item__price">' + CCD.fmt(linePrice) + '</span>' +
        '</div>';
      }`;

if (!code.includes(oldBlock)) {
  console.log('ERROR: old block not found!');
  // Show surrounding context to debug
  const idx = code.indexOf('// Price display');
  if (idx >= 0) {
    console.log('Found "// Price display" at index', idx);
    console.log('Context:', code.substring(idx, idx + 500));
  }
  process.exit(1);
}

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('v14-complete.js', code);
console.log('Patched price display block successfully');
console.log('Has isGiftItem:', code.includes('isGiftItem'));
console.log('Has showFree:', code.includes('showFree'));
console.log('File size:', code.length);
