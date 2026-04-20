const fs = require('fs');

let js = fs.readFileSync('v14-complete.js', 'utf8');

// 1. In openDrawer: show empty state immediately, hide items/progress/footer
// The empty state will be visible instantly. If cart has items, refresh() will flip visibility.
const oldOpen = `// Hide progress/footer before drawer visible to prevent flash on empty cart
      var _pb = d.querySelector('[data-ccd-progress]');
      var _ft = d.querySelector('[data-ccd-footer]');
      var _id = d.querySelector('[data-ccd-inner]');
      if (_pb) _pb.style.display = 'none';
      if (_ft) _ft.style.display = 'none';
      if (_id) _id.style.display = 'none';
      d.classList.add('ccd--open');
      d.style.display = 'flex';`;

const newOpen = `// Show empty state immediately, hide cart content until fetch confirms items exist
      var _pb = d.querySelector('[data-ccd-progress]');
      var _ft = d.querySelector('[data-ccd-footer]');
      var _id = d.querySelector('[data-ccd-inner]');
      var _es = d.querySelector('.ccd-cart-empty');
      if (_pb) _pb.style.display = 'none';
      if (_ft) _ft.style.display = 'none';
      if (_id) _id.style.display = 'none';
      if (_es) _es.classList.add('ccd-show');
      d.classList.add('ccd--open');
      d.style.display = 'flex';`;

if (js.includes(oldOpen)) {
  js = js.replace(oldOpen, newOpen);
  console.log('OK: openDrawer now shows empty state instantly');
} else {
  console.log('FAILED: openDrawer pattern not found');
}

// 2. Bump version
js = js.replace('CCD v15.4', 'CCD v15.5');

fs.writeFileSync('v14-complete.js', js);

// 3. CSS: remove padding-top, use margin-top instead for tighter positioning
let css = fs.readFileSync('extensions/cart-drawer/assets/v14-css.css', 'utf8');
css = css.replace('padding-top: 40px !important;', 'padding-top: 20px !important;');
fs.writeFileSync('extensions/cart-drawer/assets/v14-css.css', css);

console.log('Done — v15.5');
