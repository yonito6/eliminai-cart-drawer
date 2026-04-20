const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// Find the exact broken pattern - look for the CartDrawer CSS hide rule that spans 2 lines
// The issue: line ends with } then literal newline, then next line starts with ' +
// Need to check both LF and CRLF

const search = ".drawer--cart { display: none !important; visibility: hidden !important; }";
let idx = 0;
let count = 0;
while ((idx = code.indexOf(search, idx)) !== -1) {
  count++;
  const after = code.substring(idx + search.length, idx + search.length + 20);
  console.log('Occurrence', count, 'at', idx, 'followed by:', JSON.stringify(after));
  
  // Check if this one is broken (no \n' before the newline)
  if (after.startsWith('\r\n') || after.startsWith('\n')) {
    console.log('  → THIS ONE IS BROKEN (literal newline in string)');
    // Replace: add \n' + before the line break, remove the orphaned ' + on next line
    const nlChar = after.startsWith('\r\n') ? '\r\n' : '\n';
    const restAfterNl = code.substring(idx + search.length + nlChar.length);
    // Next part should be "' +" possibly with leading whitespace
    const nextLineMatch = restAfterNl.match(/^' \+[ \t]*(?:\r?\n)/);
    if (nextLineMatch) {
      console.log('  → Next line orphan:', JSON.stringify(nextLineMatch[0]));
      // Replace everything from search end through orphan with proper ending
      const endOfBroken = idx + search.length + nlChar.length + nextLineMatch[0].length;
      code = code.substring(0, idx + search.length) + '\n\' +' + nlChar + code.substring(endOfBroken);
      console.log('  → FIXED!');
    }
  }
  idx += search.length;
}

fs.writeFileSync('v14-complete.js', code);
console.log('Done, found', count, 'occurrences');
