const fs = require('fs');
const path = require('path');

// Fix 1: JS — use setProperty with !important
const jsFile = path.join(__dirname, 'v14-complete.js');
let js = fs.readFileSync(jsFile, 'utf8');

js = js.replace(
  "if (_emptyEl) _emptyEl.style.display = _rc === 0 ? '' : 'none';",
  "if (_emptyEl) _emptyEl.style.setProperty('display', _rc === 0 ? 'flex' : 'none', 'important');"
);

// Also fix the hidden-on-add-to-cart (search for ccd-empty in fetch interceptor)
js = js.replace(
  "if (_es) _es.style.display = 'none';",
  "if (_es) _es.style.setProperty('display', 'none', 'important');"
);

fs.writeFileSync(jsFile, js, 'utf8');

// Fix 2: CSS — change .ccd-empty to not force display:flex, let JS control it
const cssFile = path.join(__dirname, 'v14-css.css');
let css = fs.readFileSync(cssFile, 'utf8');

// Find the .ccd-empty rule and change display from flex to none (JS will show it when needed)
// The rule looks like: #CCD-Drawer .ccd-empty { display: flex !important; ... }
css = css.replace(
  /(\#CCD-Drawer \.ccd-empty\s*\{[^}]*?)display:\s*flex\s*!important/,
  '$1display: none !important'
);

fs.writeFileSync(cssFile, css, 'utf8');

console.log('JS fix:', fs.readFileSync(jsFile, 'utf8').includes("setProperty('display', _rc === 0 ? 'flex' : 'none', 'important')"));
console.log('CSS fix:', fs.readFileSync(cssFile, 'utf8').includes('#CCD-Drawer .ccd-empty') && !fs.readFileSync(cssFile, 'utf8').match(/#CCD-Drawer \.ccd-empty\s*\{[^}]*display:\s*flex/));
