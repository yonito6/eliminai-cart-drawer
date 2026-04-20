const fs = require('fs');

// Fix 1: CSS — move empty state higher, hide progress/footer by default
let css = fs.readFileSync('extensions/cart-drawer/assets/v14-css.css', 'utf8');
css = css.replace('padding-top: 5% !important;', 'padding-top: 40px !important;');
fs.writeFileSync('extensions/cart-drawer/assets/v14-css.css', css);
console.log('CSS: padding-top changed to 40px');

// Fix 2: JS — hide progress bar and footer BEFORE drawer becomes visible
let js = fs.readFileSync('v14-complete.js', 'utf8');

// In openDrawer, hide progress/footer immediately before showing drawer
const oldOpen = `d.classList.add('ccd--open');
      d.style.display = 'flex';`;
const newOpen = `// Hide progress/footer before drawer visible to prevent flash on empty cart
      var _pb = d.querySelector('[data-ccd-progress]');
      var _ft = d.querySelector('[data-ccd-footer]');
      var _id = d.querySelector('[data-ccd-inner]');
      if (_pb) _pb.style.display = 'none';
      if (_ft) _ft.style.display = 'none';
      if (_id) _id.style.display = 'none';
      d.classList.add('ccd--open');
      d.style.display = 'flex';`;

if (js.includes(oldOpen)) {
  js = js.replace(oldOpen, newOpen);
  console.log('JS: Added pre-hide in openDrawer');
} else {
  console.log('FAILED: openDrawer pattern not found');
}

// bump version
js = js.replace('CCD v15.3', 'CCD v15.4');

fs.writeFileSync('v14-complete.js', js);
console.log('Done — v15.4');
