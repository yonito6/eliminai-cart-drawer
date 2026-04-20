const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/v14-complete.js';
let code = fs.readFileSync(path, 'utf8');

// Fix the stray comma at line 793: "CCD._isOpen = true;," → "CCD._isOpen = true;"
const before = code;
code = code.replace('CCD._isOpen = true;,', 'CCD._isOpen = true;');

if (code === before) {
  console.log('WARNING: Pattern not found');
} else {
  console.log('Fixed stray comma at CCD._isOpen = true;');
}

fs.writeFileSync(path, code);

// Verify syntax
try {
  new Function(code);
  console.log('SYNTAX CHECK: PASSED');
} catch(e) {
  console.log('SYNTAX CHECK: FAILED — ' + e.message);
  const lines = code.split('\n');
  const match = e.message.match(/position (\d+)/);
  if (match) {
    let pos = parseInt(match[1]), lineNum = 0;
    for (let i = 0; i < lines.length; i++) {
      if (pos <= lines[i].length) { lineNum = i + 1; break; }
      pos -= lines[i].length + 1;
    }
    console.log('Error near line ' + lineNum);
    for (let i = Math.max(0, lineNum - 3); i < Math.min(lines.length, lineNum + 2); i++) {
      console.log((i+1) + ': ' + lines[i].substring(0, 120));
    }
  }
}

console.log('File size: ' + (code.length / 1024).toFixed(1) + ' KB');
