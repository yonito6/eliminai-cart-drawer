const fs = require('fs');
let js = fs.readFileSync('v14-complete.js', 'utf8');

// Remove the inline onclick from the checkout button — the event listener handles checkout redirect
const old = `'<button class="ccd-checkout-btn" onclick="window.location.href=\\'/checkout\\'">'`;
const fixed = `'<button class="ccd-checkout-btn">'`;

if (js.includes(old)) {
  js = js.replace(old, fixed);
  console.log('OK: removed inline onclick from checkout button');
} else {
  console.log('FAILED: checkout button pattern not found');
  // Debug
  const idx = js.indexOf('ccd-checkout-btn');
  console.log('Context:', js.substring(idx - 10, idx + 120));
}

js = js.replace('CCD v15.6', 'CCD v15.7');
fs.writeFileSync('v14-complete.js', js);
console.log('Done — v15.7');
