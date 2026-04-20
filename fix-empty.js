const fs = require('fs');
let js = fs.readFileSync('v14-complete.js', 'utf8');

// Replace the empty cart div to include a Continue Shopping button
const oldEmpty = "'<div class=\"ccd-cart-empty\">' +\n          '<p>' + (CFG.emptyCartText || 'Your cart is empty') + '</p>' +\n        '</div>'";
const newEmpty = "'<div class=\"ccd-cart-empty\">' +\n          '<p>' + (CFG.emptyCartText || 'Your cart is empty') + '</p>' +\n          '<button class=\"ccd-continue-btn\" onclick=\"CCD.close()\">' + (CFG.continueShoppingText || 'Continue Shopping') + '</button>' +\n        '</div>'";

if (js.includes(oldEmpty)) {
  js = js.replace(oldEmpty, newEmpty);
  js = js.replace('CCD v15.2', 'CCD v15.3');
  fs.writeFileSync('v14-complete.js', js);
  console.log('OK: added Continue Shopping button + bumped to v15.3');
} else {
  console.log('FAILED: pattern not found');
  const idx = js.indexOf('ccd-cart-empty');
  if (idx >= 0) {
    console.log('Context around ccd-cart-empty:');
    console.log(js.substring(idx - 10, idx + 300));
  }
}
