const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// THE BUG: changeQty uses `btnEl` to find the item, but the remove handler
// doesn't pass btnEl. So `item` is null and the lightweight path is never taken.
//
// FIX: Instead of relying on btnEl, check if ANY item in the cart has
// the 'ccd-item--removing' class. If so, use the lightweight path.

const oldCheck = `        if (item && item.classList.contains('ccd-item--removing')) {`;
const newCheck = `        var _removingItem = item && item.classList.contains('ccd-item--removing')
            ? item : document.querySelector('.ccd-item--removing');
        if (_removingItem) {`;

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

code = tryReplace(code, oldCheck, newCheck, 'Fix remove detection');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
