const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let fixCount = 0;

// Fix 1: line 105 — ''.ccd-gift-item → '.ccd-gift-item
const bug1 = "''.ccd-gift-item {";
while (code.includes(bug1)) {
  code = code.replace(bug1, "'.ccd-gift-item {");
  fixCount++;
  console.log('Fix ' + fixCount + ': removed extra quote before .ccd-gift-item');
}

// Fix 2: Check for any string literal containing a real newline between ' and '
// Look for lines in CSS block that don't end with \n' + or ';
// Scan all lines for potential broken strings
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].replace(/\r$/, '');
  const nextLine = (i + 1 < lines.length) ? lines[i + 1].replace(/\r$/, '') : '';
  
  // Pattern: line starts with whitespace + ' (string start), ends with } (no \n' + closure)
  // AND next line is exactly "' +" 
  if (/^\s+'/.test(line) && /}\s*$/.test(line) && !line.includes("\n'") && nextLine.trim() === "' +") {
    console.log('Fix: broken string at line ' + (i+1) + ': ' + line.substring(0, 60) + '...');
    // Merge: append \n' + to this line and remove next line
    lines[i] = line + "\n' +";
    lines.splice(i + 1, 1);
    fixCount++;
    i--; // re-check same index
  }
}

code = lines.join('\n');
fs.writeFileSync('v14-complete.js', code);
console.log('Total fixes: ' + fixCount);
