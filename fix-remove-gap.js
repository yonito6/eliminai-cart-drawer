const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let fixes = 0;

// FIX 1: The CSS .ccd-item--removing has !important transitions that override inline styles
// and have a 0.1s delay making total animation 0.45s, but DOM removal happens at 240ms.
// Fix: make CSS transition faster and remove the delay, also collapse border-bottom-width
const oldRemovingCSS = ".ccd-item--removing { opacity: 0 !important; transform: translateX(30px) scale(0.95) !important; pointer-events: none !important; transition: opacity 0.3s ease, transform 0.3s ease, max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, padding 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, margin 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, border-width 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s !important; }";
const newRemovingCSS = ".ccd-item--removing { opacity: 0 !important; transform: translateX(30px) scale(0.95) !important; pointer-events: none !important; max-height: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; border-bottom-width: 0 !important; transition: opacity 0.15s ease, transform 0.15s ease, max-height 0.2s cubic-bezier(0.4,0,0.2,1), padding 0.2s cubic-bezier(0.4,0,0.2,1), margin 0.2s cubic-bezier(0.4,0,0.2,1), border-bottom-width 0.2s cubic-bezier(0.4,0,0.2,1) !important; overflow: hidden !important; }";

if (code.includes(oldRemovingCSS)) {
  code = code.replace(oldRemovingCSS, newRemovingCSS);
  fixes++;
  console.log('FIX 1: Updated .ccd-item--removing CSS — faster transitions, no delay, border-bottom-width collapse');
} else {
  console.log('FIX 1 SKIP: old removing CSS not found');
}

// FIX 2: In the inline JS remove handler, also set border-bottom-width to 0
// and increase DOM removal timeout to match CSS animation
const oldRemoveInline = [
  "item.style.borderWidth = '0';",
  "setTimeout(function() { if (item.parentNode) item.remove(); }, 240);"
].join('\n            ');
const newRemoveInline = [
  "item.style.borderWidth = '0';",
  "item.style.borderBottomWidth = '0';",
  "setTimeout(function() { if (item.parentNode) item.remove(); }, 280);"
].join('\n            ');

if (code.includes(oldRemoveInline)) {
  code = code.replace(oldRemoveInline, newRemoveInline);
  fixes++;
  console.log('FIX 2: Added border-bottom-width collapse + extended removal timeout');
} else {
  console.log('FIX 2 SKIP: inline remove block not found, trying relaxed match');
  // Try just fixing the borderWidth line
  if (code.includes("item.style.borderWidth = '0';")) {
    code = code.replace(
      "item.style.borderWidth = '0';",
      "item.style.borderWidth = '0';\n            item.style.borderBottomWidth = '0';"
    );
    fixes++;
    console.log('FIX 2a: Added border-bottom-width');
  }
  // Fix timeout
  if (code.includes("setTimeout(function() { if (item.parentNode) item.remove(); }, 240);")) {
    code = code.replace(
      "setTimeout(function() { if (item.parentNode) item.remove(); }, 240);",
      "setTimeout(function() { if (item.parentNode) item.remove(); }, 280);"
    );
    fixes++;
    console.log('FIX 2b: Extended removal timeout to 280ms');
  }
}

// FIX 3: In morphDOM, same fix for items removed during refresh
const oldMorphTimeout = "setTimeout(function() { el.remove(); }, 180);";
const newMorphTimeout = "setTimeout(function() { el.remove(); }, 280);";
if (code.includes(oldMorphTimeout)) {
  code = code.replace(oldMorphTimeout, newMorphTimeout);
  fixes++;
  console.log('FIX 3: Extended morphDOM removal timeout');
}

// FIX 4: In morphDOM remove animation, also set border-bottom-width
const oldMorphBorder = "el.style.borderWidth = '0';";
// Only replace the one in the morphDOM section (not the click handler one)
// Find the morphDOM function
const morphIdx = code.indexOf('morphDOM: function(');
if (morphIdx > -1) {
  const morphBorderIdx = code.indexOf("el.style.borderWidth = '0';", morphIdx);
  if (morphBorderIdx > -1) {
    code = code.substring(0, morphBorderIdx + "el.style.borderWidth = '0';".length) +
      "\n          el.style.borderBottomWidth = '0';" +
      code.substring(morphBorderIdx + "el.style.borderWidth = '0';".length);
    fixes++;
    console.log('FIX 4: Added border-bottom-width in morphDOM');
  }
}

// FIX 5: In queued remove animation, also fix border and timeout
const queuedMorphTimeout = "setTimeout(function() { if (qItem.parentNode) qItem.remove(); }, 240);";
if (code.includes(queuedMorphTimeout)) {
  code = code.replace(queuedMorphTimeout, "setTimeout(function() { if (qItem.parentNode) qItem.remove(); }, 280);");
  fixes++;
  console.log('FIX 5: Extended queued remove timeout');
}
// Add border-bottom-width for queued removes
const queuedBorder = "qItem.style.borderWidth = '0';";
if (code.includes(queuedBorder)) {
  code = code.replace(queuedBorder, "qItem.style.borderWidth = '0';\n              qItem.style.borderBottomWidth = '0';");
  fixes++;
  console.log('FIX 5b: Added border-bottom-width in queued remove');
}

// FIX 6: The .ccd-item CSS has a competing transition property that fights with the removing one
// Current: .ccd-item { ... transition: opacity 0.2s ease,transform 0.2s ease }  (added by skeleton script)
// This can interfere. Let's make sure the removing class wins.
// Already handled by FIX 1 putting all collapse properties directly in the CSS class with !important

fs.writeFileSync('v14-complete.js', code);
console.log('\n' + fixes + ' fixes applied.');
