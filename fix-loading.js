const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Replace showLoading: add ccd-refreshing class + spinner instead of shimmer
const oldShow = `showLoading: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      var scrollable = d.querySelector('.ccd-scrollable');
      if (!scrollable) return;
      var ov = scrollable.querySelector('.ccd-loading-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'ccd-loading-overlay';
        ov.innerHTML = '<div class="ccd-loading-shimmer"></div>';
        scrollable.style.position = 'relative';
        scrollable.appendChild(ov);
      }
      CCD._loadingOverlay = ov;
      // Fade items to 30% opacity for subtle loading indicator
      var items = d.querySelector('[data-products]');
      if (items) { items.classList.add('ccd-items-crossfade'); items.classList.add('ccd-items-crossfade--out'); }
      requestAnimationFrame(function() { ov.classList.add('ccd-loading-overlay--visible'); });
    },`;

const newShow = `showLoading: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      d.classList.add('ccd-refreshing');
      var scrollable = d.querySelector('.ccd-scrollable');
      if (!scrollable) return;
      var ov = scrollable.querySelector('.ccd-loading-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'ccd-loading-overlay';
        scrollable.style.position = 'relative';
        scrollable.appendChild(ov);
      }
      if (!ov.querySelector('.ccd-spinner')) {
        var sp = document.createElement('div');
        sp.className = 'ccd-spinner';
        ov.appendChild(sp);
      }
      CCD._loadingOverlay = ov;
      var items = d.querySelector('[data-products]');
      if (items) { items.classList.add('ccd-items-crossfade'); items.classList.add('ccd-items-crossfade--out'); }
      requestAnimationFrame(function() { ov.classList.add('ccd-loading-overlay--visible'); });
    },`;

if (c.includes(oldShow)) {
  c = c.replace(oldShow, newShow);
  console.log('OK: showLoading replaced (spinner + ccd-refreshing class)');
} else {
  console.log('FAIL: showLoading not found');
  process.exit(1);
}

// 2. Replace hideLoading: remove ccd-refreshing class
const oldHide = `hideLoading: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      var ov = CCD._loadingOverlay || (d.querySelector && d.querySelector('.ccd-loading-overlay'));
      if (ov) { ov.classList.remove('ccd-loading-overlay--visible'); }
      var items = d.querySelector('[data-products]');
      if (items) { items.classList.remove('ccd-items-crossfade--out'); }
    },`;

const newHide = `hideLoading: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      d.classList.remove('ccd-refreshing');
      var ov = CCD._loadingOverlay || (d.querySelector && d.querySelector('.ccd-loading-overlay'));
      if (ov) { ov.classList.remove('ccd-loading-overlay--visible'); }
      var items = d.querySelector('[data-products]');
      if (items) { items.classList.remove('ccd-items-crossfade--out'); }
    },`;

if (c.includes(oldHide)) {
  c = c.replace(oldHide, newHide);
  console.log('OK: hideLoading replaced (removes ccd-refreshing)');
} else {
  console.log('FAIL: hideLoading not found');
  process.exit(1);
}

fs.writeFileSync('v14-complete.js', c);
console.log('File saved');
