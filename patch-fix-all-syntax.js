const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let fixes = 0;

// Fix 1: Line 159 — CartDrawer hide rule has literal newline in string
// Replace the broken two-line pattern with single proper line
const broken1 = "      '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart { display: none !important; visibility: hidden !important; }\n' +";
const fixed1 = "      '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart { display: none !important; visibility: hidden !important; }\n' +";

if (code.includes(broken1)) {
  code = code.replace(broken1, fixed1);
  fixes++;
  console.log('Fix 1: CartDrawer hide rule string literal newline');
}

// Check for any other unterminated strings on lines ending with } followed by newline then ' +
// Pattern: a line ending with }  (no \n' +) followed by a line starting with ' +
const pattern = /}[\t ]*\n' \+/g;
let match;
while ((match = pattern.exec(code)) !== null) {
  const lineStart = code.lastIndexOf('\n', match.index) + 1;
  const line = code.substring(lineStart, match.index + match[0].length);
  if (line.includes("'") && !line.includes("\n'")) {
    console.log('Potential broken string at offset', match.index, ':', line.substring(0, 80));
  }
}

fs.writeFileSync('v14-complete.js', code);
console.log('Applied', fixes, 'fixes');
