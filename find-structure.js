const fs = require('fs');
const c = fs.readFileSync('v14-complete.js', 'utf8');

// Find the HTML template where drawer structure is built
// Look for where ccd-inner and ccd-scrollable divs are created
const lines = c.split('\n');
for (let i = 520; i < 560; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
