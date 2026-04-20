const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Replace the initDrawer theme takeover section to also add ccd-* classes to theme elements
code = code.replace(
  `        // Wire theme's close button to our closeDrawer
        el.querySelectorAll('.js-drawer-close, [data-drawer-close]').forEach(function(btn) {
          btn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); CCD.closeDrawer(); });
        });
        console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');
      }`,
  `        // === ADD ccd-* classes to theme structural elements ===
        // Without these, our CSS hides them (e.g. drawer__contents:not(.ccd-contents) → hidden)
        var _map = {
          '.drawer__fixed-header': 'ccd-fixed-header',
          '.drawer__contents': 'ccd-contents',
          '.drawer__header': 'ccd-header',
          '.drawer__scrollable': 'ccd-scrollable',
          '.drawer__inner': 'ccd-inner',
          '.cart__items': 'ccd-items',
          '.drawer__cart-empty, .cart--empty, .drawer__empty': 'ccd-empty'
        };
        Object.keys(_map).forEach(function(sel) {
          el.querySelectorAll(sel).forEach(function(child) { child.classList.add(_map[sel]); });
        });
        // Wire theme's close button to our closeDrawer and add ccd-close-btn class
        el.querySelectorAll('.js-drawer-close, [data-drawer-close], .drawer__close-button').forEach(function(btn) {
          btn.classList.add('ccd-close-btn');
          btn.setAttribute('data-ccd-close', '');
          btn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); CCD.closeDrawer(); });
        });
        // Remove theme's own drawer classes that control visibility/position
        // (our CSS handles everything via #CCD-Drawer and ccd-open)
        el.classList.remove('drawer', 'drawer--right', 'drawer--left');
        console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');
      }`
);

fs.writeFileSync(file, code, 'utf8');

// Verify
const result = fs.readFileSync(file, 'utf8');
console.log('Class mapping:', result.includes('ccd-fixed-header'));
console.log('Close btn wired:', result.includes('ccd-close-btn'));
console.log('Drawer class removed:', result.includes("classList.remove('drawer'"));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
