var fs = require('fs');
var f = 'v14-complete.js';
var c = fs.readFileSync(f, 'utf8');
var le = c.includes('\r\n') ? '\r\n' : '\n';

// Add a global flag to suppress theme cart rebuilds during our animations
// Insert at the top of the IIFE, after the first var declarations

// Find the remove click handler and add event suppression
var oldRemoveBlock = "          if (item) {" + le + "            item.classList.add('ccd-item--removing');";

var newRemoveBlock = "          if (item) {" + le + "            item.classList.add('ccd-item--removing');" + le + "            // Block theme.js from rebuilding cart during animation" + le + "            window.__ccd_block_rebuild = true;" + le + "            setTimeout(function() { window.__ccd_block_rebuild = false; }, 500);";

if (c.includes(oldRemoveBlock)) {
  c = c.replace(oldRemoveBlock, newRemoveBlock);
  console.log('Added rebuild block flag to remove click');
} else {
  console.log('NOT FOUND: remove click block');
}

// Now we need to intercept the theme's buildCart. The theme listens on 'cart:build'
// and dispatches 'cart:updated'. We need to block these during animation.
// Best approach: patch document.dispatchEvent to swallow cart events when blocked.

// Find the very beginning of our script (the IIFE)
var iifeStart = "(function() {";
if (c.includes(iifeStart)) {
  var patchCode = [
    "(function() {",
    "  // Intercept theme.js cart rebuilds during our animations",
    "  var _origDispatch = document.dispatchEvent.bind(document);",
    "  document.dispatchEvent = function(evt) {",
    "    if (window.__ccd_block_rebuild && evt.type && (evt.type === 'cart:updated' || evt.type === 'cart:build')) {",
    "      return true; // swallow event",
    "    }",
    "    return _origDispatch(evt);",
    "  };"
  ].join(le);
  
  c = c.replace(iifeStart, patchCode);
  console.log('Added dispatchEvent interceptor');
} else {
  console.log('NOT FOUND: IIFE start');
}

fs.writeFileSync(f, c);
console.log('Done');
