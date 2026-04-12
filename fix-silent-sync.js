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

// Replace the delayed CCD.refresh() with a silent data-only sync.
// No morphDOM, no visual change — just update data attributes so
// subsequent + operations read correct keys and values.

const oldDelayedRefresh = `          // Delayed refresh to sync DOM data (animation is done by now)
          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) {
            setTimeout(function() { CCD.refresh(cart); }, 50);
          } else {
            // Sync DOM after animation completes — morphDOM will be invisible
            // since the removed item is already gone from DOM
            setTimeout(function() {
              window.__ccd_block_rebuild = false;
              CCD.refresh(cart);
            }, 500);
          }`;

const newDelayedRefresh = `          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) {
            setTimeout(function() { window.__ccd_block_rebuild = false; CCD.refresh(cart); }, 50);
          } else {
            // Silent data sync — update attributes only, no morphDOM, no visual change
            window.__ccd_block_rebuild = false;
            var cie = document.querySelector('#CartDrawer .cart__items');
            if (cie) {
              cie.setAttribute('data-real-count', CCD.getRealCount(cart));
              cie.setAttribute('data-unique-count', CCD.getUniqueVariants(cart));
              cie.setAttribute('data-cart-subtotal', cart.total_price);
            }
            // Sync line item keys/qtys in the DOM with server cart
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
            }
            // Handle discount row and other non-item elements
            CCD.rebuildDiscountRow(cart);
            // Sync protection toggle
            var protItem = cart.items.find(function(i) { return i.handle === PROT; });
            CCD._protKey = protItem ? protItem.key : null;
            CCD.setToggleNoTransition(!!protItem);
            // Check watch case
            CCD.checkWatchCase(cart);
          }`;

code = tryReplace(code, oldDelayedRefresh, newDelayedRefresh, 'Replace delayed refresh with silent sync');

// Update version
code = code.replace("'14.12'", "'14.13'");
code = code.replace("v14.12", "v14.13");
console.log('Updated version to 14.13');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
