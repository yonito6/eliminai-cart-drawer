const fs = require('fs');

// Restore from snapshot first
fs.copyFileSync('snapshots/v14-pre-fix-20260418-0117.js', 'v14-complete.js');
console.log('Restored from snapshot');

let code = fs.readFileSync('v14-complete.js', 'utf8');

// FIX 1: ''.ccd-gift-item → '.ccd-gift-item (extra quote)
const fix1count = (code.match(/''.ccd-gift-item \{/g) || []).length;
code = code.replace(/''.ccd-gift-item \{/g, "'.ccd-gift-item {");
console.log('Fix 1: removed', fix1count, "extra quotes before .ccd-gift-item");

// FIX 2: CartDrawer hide CSS rule has literal newline inside string
// The broken sequence at line 159 is:
//   '...visibility: hidden !important; }<LF>
//   ' +
// Should be:
//   '...visibility: hidden !important; }\n' +
//
// We need to insert the two characters \ and n before the literal newline
// to make it a proper \n escape inside the JS string

// Build the broken string precisely using char codes
const broken2 = "visibility: hidden !important; }" + String.fromCharCode(10) + "' +";
const fixed2 = "visibility: hidden !important; }" + "\\n' +";

// Find how many exist
let tempCode = code;
let fix2count = 0;
let lastPos = 0;
while (true) {
  const idx = tempCode.indexOf(broken2, lastPos);
  if (idx === -1) break;
  fix2count++;
  lastPos = idx + 1;
}
console.log('Fix 2: found', fix2count, 'broken CartDrawer string(s)');

code = code.replace(broken2, fixed2);

// Also check for CRLF variant
const broken2crlf = "visibility: hidden !important; }" + String.fromCharCode(13) + String.fromCharCode(10) + "' +";
if (code.includes(broken2crlf)) {
  code = code.replace(broken2crlf, fixed2);
  console.log('Fix 2b: fixed CRLF variant too');
}

fs.writeFileSync('v14-complete.js', code);
console.log('Saved');

// Verify the fix by checking that area
const verifyIdx = code.indexOf('#CartDrawer, cart-drawer');
let pos = verifyIdx;
while (true) {
  pos = code.indexOf('#CartDrawer', pos + 1);
  if (pos === -1) break;
  const lineNum = code.substring(0, pos).split('\n').length;
  if (lineNum > 100) {
    const afterHide = code.indexOf('visibility: hidden !important; }', pos);
    if (afterHide !== -1) {
      const afterBytes = [];
      const end = afterHide + 'visibility: hidden !important; }'.length;
      for (let i = end; i < end + 10; i++) {
        afterBytes.push(code.charCodeAt(i));
      }
      console.log('Line', lineNum, '- bytes after closing brace:', afterBytes.map(b => b + '(' + String.fromCharCode(b) + ')').join(' '));
    }
    break;
  }
}
