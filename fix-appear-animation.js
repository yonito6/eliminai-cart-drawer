const fs = require('fs');

// Fix 1: CSS — override theme's appear-animation inside our drawer
const cssFile = require('path').join(__dirname, 'v14-css.css');
let css = fs.readFileSync(cssFile, 'utf8');

// Add rule to force-show all appear-animation elements in our drawer
const rule = `
/* Override theme appear-animation (opacity:0 + translateY) that never triggers after rename */
#CCD-Drawer .appear-animation { opacity: 1 !important; transform: none !important; animation: none !important; }
`;

// Add after the existing native element suppression rules (near the top)
if (!css.includes('#CCD-Drawer .appear-animation')) {
  // Insert after the first block of suppression rules
  css = css.replace(
    '/* ── Shell',
    rule + '/* ── Shell'
  );
}

fs.writeFileSync(cssFile, css, 'utf8');

console.log('CSS appear-animation fix:', css.includes('#CCD-Drawer .appear-animation { opacity: 1'));
console.log('File size:', (css.length / 1024).toFixed(1), 'KB');
