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

// FIX: Only set __ccd_block_rebuild for removes (qty === 0), not all changes.
// And fix the scarcity early return that leaks the flag.

const oldChangeQtyTop = `    changeQty: function(key, qty, btnEl) {
      if (busy) return;
      // Block theme.js rebuild during our cart change
      window.__ccd_block_rebuild = true;
      if (qty === 0) window.__ccd_is_removing = true;
      // Block increasing scarcity item above 1
      if (scarcityVariantId && qty > 1) {
        var keyVid = String(key).split(':')[0];
        if (keyVid === scarcityVariantId) {
          CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || 'Only 1 left!');
          return;
        }
      }`;

const newChangeQtyTop = `    changeQty: function(key, qty, btnEl) {
      if (busy) return;
      // Only block theme rebuild for removes
      if (qty === 0) {
        window.__ccd_block_rebuild = true;
        window.__ccd_is_removing = true;
      }
      // Block increasing scarcity item above 1
      if (scarcityVariantId && qty > 1) {
        var keyVid = String(key).split(':')[0];
        if (keyVid === scarcityVariantId) {
          CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || 'Only 1 left!');
          return;
        }
      }`;

code = tryReplace(code, oldChangeQtyTop, newChangeQtyTop, 'Fix changeQty flags');

// Remove the setTimeout block_rebuild=false in the else (non-remove) path
// since we never set it to true for non-removes
const oldElseBlock = `          CCD.refresh(cart);
          setTimeout(function() { window.__ccd_block_rebuild = false; }, 300);`;
const newElseBlock = `          CCD.refresh(cart);`;

code = tryReplace(code, oldElseBlock, newElseBlock, 'Remove unnecessary unblock in else');

// Update version
code = code.replace("'14.9'", "'14.10'");
code = code.replace("v14.9", "v14.10");
console.log('Updated version to 14.10');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
