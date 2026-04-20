// Patch v14-complete.js: add error logging to catch handlers + retry limit + response logging
const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Add a failed-gifts tracker variable near the top (after watchCaseBusy declaration)
code = code.replace(
  'var watchCaseBusy = false;',
  'var watchCaseBusy = false;\n    var _giftAddFails = {}; // handle → fail count, prevents infinite retry'
);

// 2. In the toAdd loop, skip gifts that have failed 3+ times
code = code.replace(
  `Object.keys(shouldHave).forEach(function(h) {
        if (!giftInCart[h] && !caseDismissed) {
          toAdd.push({ id: shouldHave[h], quantity: 1, properties: { _eliminai_gift: 'true' } });
        }
      });`,
  `Object.keys(shouldHave).forEach(function(h) {
        if (!giftInCart[h] && !caseDismissed) {
          if ((_giftAddFails[h] || 0) >= 3) {
            console.warn('[CCD GIFT] Skipping ' + h + ' — failed ' + _giftAddFails[h] + ' times');
            return;
          }
          toAdd.push({ id: shouldHave[h], quantity: 1, properties: { _eliminai_gift: 'true' } });
        }
      });`
);

// 3. Replace the add-only path (else if toAdd.length > 0) with error logging + response parsing
code = code.replace(
  `} else if (toAdd.length > 0) {
        watchCaseBusy = true;
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: toAdd })
        })
        .then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
      }`,
  `} else if (toAdd.length > 0) {
        watchCaseBusy = true;
        console.log('[CCD GIFT] Adding items:', JSON.stringify(toAdd));
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: toAdd })
        })
        .then(function(r) {
          console.log('[CCD GIFT] /cart/add.js status=' + r.status);
          return r.json().then(function(body) {
            if (r.status !== 200) {
              console.error('[CCD GIFT] /cart/add.js error response:', JSON.stringify(body));
              // Track failures per handle
              toAdd.forEach(function(item) {
                var h = Object.keys(shouldHave).find(function(k) { return shouldHave[k] == item.id; });
                if (h) _giftAddFails[h] = (_giftAddFails[h] || 0) + 1;
              });
              watchCaseBusy = false;
              return null;
            }
            console.log('[CCD GIFT] /cart/add.js success:', JSON.stringify(body).substring(0, 200));
            return fetch('/cart.js');
          });
        })
        .then(function(r) { if (r) return r.json(); return null; })
        .then(function(c) { watchCaseBusy = false; if (c) CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] add catch:', err); watchCaseBusy = false; });
      }`
);

// 4. Also add error logging to the remove+add path catch
code = code.replace(
  `.then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
      } else if (toAdd.length > 0) {`,
  `.then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] remove+add catch:', err); watchCaseBusy = false; });
      } else if (toAdd.length > 0) {`
);

// 5. Reset fail counts when gifts are successfully found in cart
code = code.replace(
  `if (GIFT_HANDLES[i.handle]) {
          giftInCart[i.handle] = { key: i.key, qty: i.quantity };
        }`,
  `if (GIFT_HANDLES[i.handle]) {
          giftInCart[i.handle] = { key: i.key, qty: i.quantity };
          _giftAddFails[i.handle] = 0; // reset fail count on success
        }`
);

fs.writeFileSync('v14-complete.js', code, 'utf8');
console.log('Patched v14-complete.js with error logging + retry limit');
