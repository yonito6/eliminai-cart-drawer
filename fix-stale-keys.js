const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

function tryReplace(src, old, repl, label) {
  if (src.indexOf(old) !== -1) {
    console.log(label + ': found (LF)');
    return src.replace(old, repl);
  }
  const oldCR = old.replace(/\n/g, '\r\n');
  const replCR = repl.replace(/\n/g, '\r\n');
  if (src.indexOf(oldCR) !== -1) {
    console.log(label + ': found (CRLF)');
    return src.replace(oldCR, replCR);
  }
  console.log(label + ': NOT FOUND');
  return src;
}

// FIX: Match by variant_id (first part of key) instead of full key.
// After matching, UPDATE the DOM key to the new server key.
// This fixes the stale-key bug where + sends an old key after a remove.

const oldSync = `            // Sync line item keys/qtys in the DOM with server cart
            if (cart.items) {
              cart.items.forEach(function(ci) {
                // Find the matching DOM input by variant_id
                var inputs = document.querySelectorAll('.ccd-qty__input');
                inputs.forEach(function(inp) {
                  var inpKey = inp.dataset.id;
                  // Update qty display if it drifted
                  if (inpKey === ci.key) {
                    inp.value = ci.quantity;
                  }
                });
                // Also update line item prices
                var lineItem = document.querySelector('.ccd-item[data-key="' + ci.key + '"]');
                if (lineItem) {
                  var priceEl = lineItem.querySelector('.ccd-item__price');
                  if (priceEl) {
                    var newPrice = CCD.fmt(ci.final_line_price);
                    if (priceEl.textContent !== newPrice) priceEl.textContent = newPrice;
                  }
                }
              });
            }`;

const newSync = `            // Sync line item keys/qtys in the DOM with server cart
            // Match by variant_id (not key — keys change after remove!)
            if (cart.items) {
              cart.items.forEach(function(ci) {
                var ciVid = String(ci.variant_id);
                var inputs = document.querySelectorAll('.ccd-qty__input');
                inputs.forEach(function(inp) {
                  var inpVid = String(inp.dataset.id).split(':')[0];
                  if (inpVid === ciVid) {
                    // Update key to fresh server key
                    inp.dataset.id = ci.key;
                    inp.value = ci.quantity;
                  }
                });
                // Update line item wrapper key + prices
                var allItems = document.querySelectorAll('.ccd-item:not(.ccd-item--removing)');
                allItems.forEach(function(lineItem) {
                  var lInp = lineItem.querySelector('.ccd-qty__input');
                  var lVid = lInp ? String(lInp.dataset.id).split(':')[0] : '';
                  if (lVid === ciVid) {
                    // Update data-key on wrapper
                    lineItem.setAttribute('data-key', ci.key);
                    // Update remove button key
                    var rmBtn = lineItem.querySelector('.ccd-item__remove');
                    if (rmBtn) rmBtn.setAttribute('data-key', ci.key);
                    // Update price
                    var priceEl = lineItem.querySelector('.ccd-item__price');
                    if (priceEl) {
                      var newPrice = CCD.fmt(ci.final_line_price);
                      if (priceEl.textContent !== newPrice) priceEl.textContent = newPrice;
                    }
                  }
                });
              });
            }`;

code = tryReplace(code, oldSync, newSync, 'Fix stale key sync (match by variant_id)');

// Update version
code = code.replace("'14.14-debug'", "'14.15'");
code = code.replace("v14.14-debug", "v14.15");
console.log('Updated version to 14.15');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
