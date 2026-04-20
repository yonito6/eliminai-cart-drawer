const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Replace the theme takeover path: instead of mapping theme classes,
// replace the entire inner content with our self-rendered shell.
// This ensures ALL paths (Liquid, theme takeover, self-create) end up
// with the SAME DOM structure that refresh() expects.

code = code.replace(
  `        if (themeDrawer) {
          el = themeDrawer;
          // Rename to CCD-Drawer so all our code works
          el.id = 'CCD-Drawer';
          // Rename the form too
          var form = el.querySelector('#CartDrawerForm, form[action="/cart"]');
          if (form) form.id = 'CCD-Form';
          // Fix inline <style> that references old ID
          el.querySelectorAll('style').forEach(function(s) {
            s.textContent = s.textContent.replace(/#CartDrawer\\.custom-cart-drawer/g, '#CCD-Drawer')
                                         .replace(/#CartDrawer/g, '#CCD-Drawer');
          });
          // ADD ccd-* classes to theme structural elements
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
          // Wire theme close buttons
          el.querySelectorAll('.js-drawer-close, [data-drawer-close], .drawer__close-button').forEach(function(btn) {
            btn.classList.add('ccd-close-btn');
            btn.setAttribute('data-ccd-close', '');
            btn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); CCD.closeDrawer(); });
          });
          el.classList.remove('drawer', 'drawer--right', 'drawer--left');
          // Kill theme appear-animation
          el.querySelectorAll('.appear-animation').forEach(function(ae) {
            ae.style.setProperty('opacity', '1', 'important');
            ae.style.setProperty('transform', 'none', 'important');
            ae.style.setProperty('animation', 'none', 'important');
          });
          console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');`,
  `        if (themeDrawer) {
          el = themeDrawer;
          el.id = 'CCD-Drawer';
          // FULL SELF-RENDER: Replace theme's inner DOM with our own shell.
          // This ensures the same DOM structure as buildDrawerShell() —
          // [data-ccd-inner], [data-products], .ccd-items all present.
          el.innerHTML = CCD.buildDrawerShell();
          el.classList.remove('drawer', 'drawer--right', 'drawer--left');
          // Kill any theme styles that might interfere
          el.querySelectorAll('style').forEach(function(s) { s.remove(); });
          console.log('[CCD] Replaced theme drawer DOM with self-rendered shell → #CCD-Drawer');`
);

fs.writeFileSync(file, code, 'utf8');

const result = fs.readFileSync(file, 'utf8');
var opens = (result.match(/{/g) || []).length;
var closes = (result.match(/}/g) || []).length;
console.log('Brace balance: { = ' + opens + ', } = ' + closes + ' (diff: ' + (opens - closes) + ')');
console.log('Self-render theme takeover:', result.includes('Replaced theme drawer DOM with self-rendered shell'));
console.log('buildDrawerShell in takeover:', result.includes("el.innerHTML = CCD.buildDrawerShell()"));
console.log('data-products in shell:', result.includes('data-products'));
console.log('data-ccd-inner in shell:', result.includes('data-ccd-inner'));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
