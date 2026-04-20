const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Fix line 632 — curWatchCount selector
code = code.replace(
  'var curWatchCount = parseInt((document.querySelector(".ccd-items") || {}).dataset && document.querySelector(".ccd-items").dataset.watchCount || "0");',
  'var _cwcEl = document.querySelector(".ccd-items") || document.querySelector(".cart__items"); var curWatchCount = parseInt((_cwcEl || {}).dataset && _cwcEl.dataset.watchCount || "0");'
);

// Fix line 1537 — container selector in enforceGiftItem or similar
code = code.replace(
  'var container = document.querySelector("#CCD-Drawer .ccd-items");',
  'var container = document.querySelector("#CCD-Drawer .ccd-items") || document.querySelector("#CCD-Drawer .cart__items");'
);

// Fix line 1632 — cie in refreshLight
code = code.replace(
  `      var cie = document.querySelector('#CCD-Drawer .ccd-items');
        if (cie) {
          cie.classList.add('ccd-items');`,
  `      var cie = document.querySelector('#CCD-Drawer .ccd-items') || document.querySelector('#CCD-Drawer .cart__items');
        if (cie) {
          cie.classList.add('ccd-items');`
);

fs.writeFileSync(file, code, 'utf8');

const result = fs.readFileSync(file, 'utf8');
// Count remaining .ccd-items without .cart__items fallback
var lines = result.split('\n');
var unfixed = [];
lines.forEach(function(line, i) {
  if (line.includes("querySelector") && line.includes("ccd-items") && !line.includes("cart__items") && !line.includes('doc.querySelector')) {
    unfixed.push((i+1) + ': ' + line.trim().substring(0, 80));
  }
});
console.log('Remaining without fallback:', unfixed.length);
unfixed.forEach(function(u) { console.log('  ' + u); });
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
