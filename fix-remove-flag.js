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

// FIX: Use a flag instead of DOM query to detect removes.
// The DOM element is gone by the time the fetch resolves (240ms < network time).

// 1. In changeQty, set flag when qty === 0
const oldChangeQty = `      // Block theme.js rebuild during our cart change
      window.__ccd_block_rebuild = true;`;
const newChangeQty = `      // Block theme.js rebuild during our cart change
      window.__ccd_block_rebuild = true;
      if (qty === 0) window.__ccd_is_removing = true;`;

code = tryReplace(code, oldChangeQty, newChangeQty, 'Set remove flag');

// 2. In .then(), check the flag instead of DOM
const oldCheck = `        var _removingItem = item && item.classList.contains('ccd-item--removing')
            ? item : document.querySelector('.ccd-item--removing');
        console.log('[CCD] changeQty resolved. removingItem:', !!_removingItem, 'item:', !!item);
        if (_removingItem) {
          console.log('[CCD] LIGHTWEIGHT path — no morphDOM');`;
const newCheck = `        var _isRemoving = window.__ccd_is_removing;
        window.__ccd_is_removing = false;
        if (_isRemoving) {`;

code = tryReplace(code, oldCheck, newCheck, 'Check remove flag');

// 3. Also remove the debug log from the else branch
const oldElseLog = `        } else {
          console.log('[CCD] FULL REFRESH path — calling CCD.refresh()');
          CCD.refresh(cart);`;
const newElseLog = `        } else {
          CCD.refresh(cart);`;

code = tryReplace(code, oldElseLog, newElseLog, 'Remove else debug log');

// 4. Remove debug logs from refresh and morphDOM
code = code.replace(/      console\.log\('\[CCD\] refresh\(\) called'.*\n/g, '');
code = code.replace(/            console\.log\('\[CCD\] morphDOM running.*\n/g, '');
console.log('Removed debug logs');

// 5. Keep version stamp but update version
code = code.replace("14.8-debug", "14.9");
code = code.replace("v14.8-debug", "v14.9");
console.log('Updated version to 14.9');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
