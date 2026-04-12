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

// Remove debug console.log lines added in v14.14-debug

// 1. Remove debug + click log
const oldPlusDebug = `          console.log('[CCD+] key:', input.dataset.id, 'newQty:', newVal, 'busy:', busy);\n`;
code = tryReplace(code, oldPlusDebug, '', 'Remove + debug log');

// 2. Remove API response debug log
const oldApiDebug = `        console.log('[CCD] API returned. items:', cart.items ? cart.items.map(function(i){ return i.handle+':'+i.quantity+'('+i.key.substring(0,8)+')'; }) : 'none', 'isRemoving:', !!window.__ccd_is_removing, 'pendingOp:', !!_pendingOp);\n`;
code = tryReplace(code, oldApiDebug, '', 'Remove API response debug log');

// 3. Remove lightweight path debug log
const oldLightDebug = `          console.log('[CCD] LIGHTWEIGHT remove path');\n`;
code = tryReplace(code, oldLightDebug, '', 'Remove lightweight debug log');

// 4. Remove full refresh debug log
const oldFullDebug = `          console.log('[CCD] FULL REFRESH path');\n`;
code = tryReplace(code, oldFullDebug, '', 'Remove full refresh debug log');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
