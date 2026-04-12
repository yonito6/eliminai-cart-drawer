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

// After the remove lightweight path, add a delayed CCD.refresh()
// to sync the DOM. By the time it runs (500ms), the collapse animation
// is done and the removed item is gone from DOM, so morphDOM should
// be a visual no-op on remaining items (they haven't changed).

const oldEmptyCheck = `          // Check empty cart
          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) { setTimeout(function() { CCD.refresh(cart); }, 50); }`;

const newEmptyCheck = `          // Delayed refresh to sync DOM data (animation is done by now)
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

code = tryReplace(code, oldEmptyCheck, newEmptyCheck, 'Add delayed refresh after remove');

// Remove the separate setTimeout for __ccd_block_rebuild since we handle it above
const oldUnblock = `          // Unblock theme rebuild now that our update is done
          setTimeout(function() { window.__ccd_block_rebuild = false; }, 300);`;

code = tryReplace(code, oldUnblock, '', 'Remove separate unblock (handled in delayed refresh)');

// Update version
code = code.replace("'14.11'", "'14.12'");
code = code.replace("v14.11", "v14.12");
console.log('Updated version to 14.12');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
