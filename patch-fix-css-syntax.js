const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');

// Fix the broken CSS string concatenation at the gift-item line
const broken = "'.ccd-gift-item--entering { opacity: 0 !important; max-height: 0 !important; overflow: hidden !important; }\\n' +\n      ''.ccd-gift-item {";
const fixed = "'.ccd-gift-item--entering { opacity: 0 !important; max-height: 0 !important; overflow: hidden !important; }\\n' +\n      '.ccd-gift-item {";

if (code.includes(broken)) {
  code = code.replace(broken, fixed);
  fs.writeFileSync(file, code);
  console.log('Fixed broken CSS string concatenation');
} else {
  // Try with \r\n
  const broken2 = broken.replace(/\n/g, '\r\n');
  if (code.includes(broken2)) {
    code = code.replace(broken2, fixed.replace(/\n/g, '\r\n'));
    fs.writeFileSync(file, code);
    console.log('Fixed broken CSS string (CRLF)');
  } else {
    console.log('Pattern not found, searching manually...');
    const idx = code.indexOf("''.ccd-gift-item {");
    if (idx >= 0) {
      code = code.substring(0, idx) + "'.ccd-gift-item {" + code.substring(idx + "''.ccd-gift-item {".length);
      fs.writeFileSync(file, code);
      console.log('Fixed at index ' + idx);
    } else {
      console.log('No broken pattern found');
    }
  }
}
