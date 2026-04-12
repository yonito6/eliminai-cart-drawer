const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Add console.log traces to every code path that could cause a visual refresh

// 1. Log when lightweight path is taken
const oldLightweight = `        var _removingItem = item && item.classList.contains('ccd-item--removing')
            ? item : document.querySelector('.ccd-item--removing');
        if (_removingItem) {`;
const newLightweight = `        var _removingItem = item && item.classList.contains('ccd-item--removing')
            ? item : document.querySelector('.ccd-item--removing');
        console.log('[CCD] changeQty resolved. removingItem:', !!_removingItem, 'item:', !!item);
        if (_removingItem) {
          console.log('[CCD] LIGHTWEIGHT path — no morphDOM');`;

// 2. Log when full refresh is called
const oldElseRefresh = `        } else {
          CCD.refresh(cart);`;
const newElseRefresh = `        } else {
          console.log('[CCD] FULL REFRESH path — calling CCD.refresh()');
          CCD.refresh(cart);`;

// 3. Log when refresh function starts
const oldRefreshStart = `    refresh: function(cart) {`;
const newRefreshStart = `    refresh: function(cart) {
      console.log('[CCD] refresh() called', new Error().stack.split('\\n')[2]);`;

// 4. Log when morphDOM runs
const oldMorphDOM = `            CCD.morphDOM(pc, ni);`;
const newMorphDOM = `            console.log('[CCD] morphDOM running — this causes visual refresh');
            CCD.morphDOM(pc, ni);`;

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

code = tryReplace(code, oldLightweight, newLightweight, 'Log lightweight path');
code = tryReplace(code, oldElseRefresh, newElseRefresh, 'Log full refresh path');
code = tryReplace(code, oldRefreshStart, newRefreshStart, 'Log refresh() entry');
code = tryReplace(code, oldMorphDOM, newMorphDOM, 'Log morphDOM');

// 5. Also bump version
code = code.replace("'14.7'", "'14.8-debug'");
code = code.replace("v14.7", "v14.8-debug");
console.log('Bumped version to 14.8-debug');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
