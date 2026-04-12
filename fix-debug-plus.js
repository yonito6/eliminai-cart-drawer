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

// Debug: log what + sends and what the API returns
const oldPlusHandler = `          input.value = newVal; // optimistic: show new qty instantly
          CCD.updateProgressOptimistic(+1);
          CCD.changeQty(input.dataset.id, newVal, plusBtn);`;
const newPlusHandler = `          input.value = newVal; // optimistic: show new qty instantly
          CCD.updateProgressOptimistic(+1);
          console.log('[CCD+] key:', input.dataset.id, 'newQty:', newVal, 'busy:', busy);
          CCD.changeQty(input.dataset.id, newVal, plusBtn);`;

code = tryReplace(code, oldPlusHandler, newPlusHandler, 'Debug + click');

// Debug: log cart response in changeQty .then
const oldThen = `        window.__ccd_last_cart = cart;
        busy = false;`;
const newThen = `        window.__ccd_last_cart = cart;
        console.log('[CCD] API returned. items:', cart.items ? cart.items.map(function(i){ return i.handle+':'+i.quantity+'('+i.key.substring(0,8)+')'; }) : 'none', 'isRemoving:', !!window.__ccd_is_removing, 'pendingOp:', !!_pendingOp);
        busy = false;`;

code = tryReplace(code, oldThen, newThen, 'Debug API response');

// Also log when remove lightweight path is taken
const oldLightweight = `        if (_isRemoving) {`;
const newLightweight = `        if (_isRemoving) {
          console.log('[CCD] LIGHTWEIGHT remove path');`;

code = tryReplace(code, oldLightweight, newLightweight, 'Debug lightweight');

// And log when full refresh path is taken
const oldFullRefresh = `          CCD.refresh(cart);
        }`;
const newFullRefresh = `          console.log('[CCD] FULL REFRESH path');
          CCD.refresh(cart);
        }`;

code = tryReplace(code, oldFullRefresh, newFullRefresh, 'Debug full refresh');

// Version bump
code = code.replace("'14.13'", "'14.14-debug'");
code = code.replace("v14.13", "v14.14-debug");

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
