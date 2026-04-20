const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
const lines = code.split('\n');

// Show raw line 159 (0-indexed: 158)
console.log('L159 raw:', JSON.stringify(lines[158]));
console.log('L160 raw:', JSON.stringify(lines[159]));
console.log('L161 raw:', JSON.stringify(lines[160]));

// Fix: line 159 should end with \n' + but instead has a literal newline
// The line is: '...visibility: hidden !important; }
// Next line is: ' +
// We need to join them into: '...visibility: hidden !important; }\n' +
const line159 = lines[158];
const line160 = lines[159];

if (line159.includes('#CartDrawer') && line159.endsWith('}') || line159.endsWith('}\r')) {
  // Remove trailing \r if present
  const cleanLine = line159.replace(/\r$/, '');
  // This line should end with \n' + but the ' was split to the next line
  // line160 is probably "' +" 
  console.log('Fixing: merging line 159 and 160');
  lines[158] = cleanLine + "\n' +";
  // Remove the orphaned line 160 ("' +")
  const line160clean = lines[159].replace(/\r$/, '').trim();
  if (line160clean === "' +") {
    lines.splice(159, 1);
    console.log('Removed orphaned line 160');
  }
  
  code = lines.join('\n');
  fs.writeFileSync('v14-complete.js', code);
  console.log('Fixed!');
} else {
  console.log('Pattern not matched');
}
