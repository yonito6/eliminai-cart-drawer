const fs = require('fs');
let js = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Add a _lastRealCount tracker — updated every time refresh runs
// Find where getRealCount is first used in the render/refresh path
const rcTracker = "CCD.getRealCount = function";
if (!js.includes('_lastRealCount')) {
  // Add tracker property initialization near the top of CCD object
  js = js.replace(
    'openDrawer: function() {',
    '_lastRealCount: -1,\n    openDrawer: function() {'
  );
  console.log('OK: added _lastRealCount property');
} else {
  console.log('_lastRealCount already exists');
}

// 2. Update refresh paths to store _lastRealCount
// In both render() and refresh(), after getRealCount, store it
js = js.replace(
  /var rc = CCD\.getRealCount\(cart\);/g,
  'var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;'
);
console.log('OK: all getRealCount calls now update _lastRealCount');

// 3. Fix openDrawer to use _lastRealCount to decide what to show
const oldOpen = `// Show empty state immediately, hide cart content until fetch confirms items exist
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

const newOpen = `// Use last known cart state to show correct view instantly (no flash)
      var _pb = d.querySelector('[data-ccd-progress]');
      var _ft = d.querySelector('[data-ccd-footer]');
      var _id = d.querySelector('[data-ccd-inner]');
      var _es = d.querySelector('.ccd-cart-empty');
      if (CCD._lastRealCount === 0) {
        // Cart was empty last time — show empty state, hide content
        if (_pb) _pb.style.display = 'none';
        if (_ft) _ft.style.display = 'none';
        if (_id) _id.style.display = 'none';
        if (_es) _es.classList.add('ccd-show');
      } else if (CCD._lastRealCount > 0) {
        // Cart had items — show content, hide empty state
        if (_es) _es.classList.remove('ccd-show');
        if (_id) _id.style.display = 'flex';
        if (_pb) _pb.style.display = 'block';
        if (_ft) _ft.style.display = 'block';
      } else {
        // First open ever (_lastRealCount is -1) — hide everything, let fetch decide
        if (_pb) _pb.style.display = 'none';
        if (_ft) _ft.style.display = 'none';
        if (_id) _id.style.display = 'none';
      }
      d.classList.add('ccd--open');
      d.style.display = 'flex';`;

if (js.includes(oldOpen)) {
  js = js.replace(oldOpen, newOpen);
  console.log('OK: openDrawer now uses _lastRealCount');
} else {
  console.log('FAILED: openDrawer pattern not found');
}

js = js.replace('CCD v15.5', 'CCD v15.6');
fs.writeFileSync('v14-complete.js', js);
console.log('Done — v15.6');
