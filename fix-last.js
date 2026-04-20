const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// This is line 1632 — the second occurrence in refresh()
// Need to do targeted replacement using surrounding context
code = code.replace(
  `      CCD.setToggleNoTransition(!!protItem || defaultOnPending);
      var cie = document.querySelector('#CCD-Drawer .ccd-items');
      if (cie) {
        cie.setAttribute('data-real-count', CCD.getRealCount(cart));`,
  `      CCD.setToggleNoTransition(!!protItem || defaultOnPending);
      var cie = document.querySelector('#CCD-Drawer .ccd-items') || document.querySelector('#CCD-Drawer .cart__items');
      if (cie) {
        cie.classList.add('ccd-items');
        cie.setAttribute('data-real-count', CCD.getRealCount(cart));`
);

fs.writeFileSync(file, code, 'utf8');

// Verify no unfixed selectors remain
const result = fs.readFileSync(file, 'utf8');
var lines = result.split('\n');
var unfixed = [];
lines.forEach(function(line, i) {
  if (line.includes("querySelector") && line.includes("ccd-items") && !line.includes("cart__items") && !line.includes('doc.querySelector')) {
    unfixed.push((i+1) + ': ' + line.trim().substring(0, 80));
  }
});
console.log('Remaining without fallback:', unfixed.length);
if (unfixed.length > 0) unfixed.forEach(function(u) { console.log('  ' + u); });
else console.log('All selectors have fallback!');
