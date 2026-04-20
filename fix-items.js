const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// FIX 1: refresh() must find .cart__items when .ccd-items doesn't exist in AJAX response
// The AJAX response from /cart?view=ajax has class="cart__items" not "ccd-items"
code = code.replace(
  `          var ni = doc.querySelector('.ccd-items');
          if (ni) {`,
  `          var ni = doc.querySelector('.ccd-items') || doc.querySelector('.cart__items');
          if (ni) {
            // Ensure the container has ccd-items class so CSS shows it
            ni.classList.add('ccd-items');`
);

// FIX 2: After morphDOM, also ensure the live container has ccd-items class
code = code.replace(
  `        var cie = document.querySelector('#CCD-Drawer .ccd-items');
        if (cie) {
          var whs = (cie.getAttribute('data-watch-handles') || '').split(',').filter(Boolean);`,
  `        var cie = document.querySelector('#CCD-Drawer .ccd-items') || document.querySelector('#CCD-Drawer .cart__items');
        if (cie) {
          cie.classList.add('ccd-items'); // Ensure class for CSS visibility
          var whs = (cie.getAttribute('data-watch-handles') || '').split(',').filter(Boolean);`
);

// FIX 3: refreshLight also needs the fallback
var refreshLightPattern = "var cie = document.querySelector('#CCD-Drawer .ccd-items');";
var rlIdx = code.lastIndexOf(refreshLightPattern);
if (rlIdx > 0 && rlIdx !== code.indexOf(refreshLightPattern)) {
  // There's a second occurrence in refreshLight — fix it too
  code = code.substring(0, rlIdx) +
    "var cie = document.querySelector('#CCD-Drawer .ccd-items') || document.querySelector('#CCD-Drawer .cart__items');" +
    code.substring(rlIdx + refreshLightPattern.length);
}

// FIX 4: Hide empty state and show items after refresh
// Find where refresh completes and add empty state toggle
code = code.replace(
  `        CCD.updateProgress(cart);
        CCD.applyScarcity(cart);
        CCD.lockScarcityQty();`,
  `        CCD.updateProgress(cart);
        CCD.applyScarcity(cart);
        CCD.lockScarcityQty();

        // Toggle empty state vs items visibility
        var _emptyEl = document.querySelector('#CCD-Drawer .ccd-empty');
        var _itemsEl = document.querySelector('#CCD-Drawer .ccd-items') || document.querySelector('#CCD-Drawer .cart__items');
        var _rc = CCD.getRealCount(cart);
        if (_emptyEl) _emptyEl.style.display = _rc === 0 ? '' : 'none';
        if (_itemsEl) { _itemsEl.style.display = _rc > 0 ? '' : 'none'; _itemsEl.classList.add('ccd-items'); }`
);

// FIX 5: Also in checkOverflow or after morphDOM — fix any remaining .cart__items
// Add to morphDOM so after every DOM update the class is correct
code = code.replace(
  `    /* Smart DOM morph — updates items in-place, preserves images (no blink) */
    morphDOM: function(container, newCartItems) {
      var existing = container.querySelector('.ccd-items');`,
  `    /* Smart DOM morph — updates items in-place, preserves images (no blink) */
    morphDOM: function(container, newCartItems) {
      var existing = container.querySelector('.ccd-items') || container.querySelector('.cart__items');
      if (existing) existing.classList.add('ccd-items'); // Ensure class`
);

fs.writeFileSync(file, code, 'utf8');

// Verify
const result = fs.readFileSync(file, 'utf8');
console.log('AJAX fallback:', result.includes("doc.querySelector('.cart__items')"));
console.log('Live fallback:', result.includes("document.querySelector('#CCD-Drawer .cart__items')"));
console.log('Empty state toggle:', result.includes('_emptyEl.style.display'));
console.log('morphDOM fallback:', result.includes("container.querySelector('.cart__items')"));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
