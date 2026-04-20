const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Fix the initDrawer structure — the theme mapping should ONLY run when themeDrawer exists
code = code.replace(
  `      if (!el) {
        // Try theme takeover first (for themes that render their own cart drawer)
        var themeDrawer = document.getElementById('CartDrawer') ||
             document.querySelector('cart-drawer') ||
             document.querySelector('.cart-drawer') ||
             document.querySelector('.drawer--cart') ||
             document.querySelector('[data-cart-drawer]');
        if (themeDrawer) {
          el = themeDrawer;
        } else {
          // NO theme drawer found — create our OWN from scratch
          el = document.createElement('div');
          el.id = 'CCD-Drawer';
          el.style.display = 'none';
          el.innerHTML = CCD.buildDrawerShell();
          document.body.appendChild(el);
          console.log('[CCD] Created self-rendered drawer (no theme dependency)');
          // Skip the theme mapping below — we have our own DOM
        }
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
        // === ADD ccd-* classes to theme structural elements ===
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
        // Kill theme appear-animation (opacity:0 + translateY:60) that won't trigger after ID rename
        el.querySelectorAll('.appear-animation').forEach(function(ae) {
          ae.style.setProperty('opacity', '1', 'important');
          ae.style.setProperty('transform', 'none', 'important');
          ae.style.setProperty('animation', 'none', 'important');
        });
        console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');
        }
      }`,
  `      if (!el) {
        // Try theme takeover first (for themes that render their own cart drawer)
        var themeDrawer = document.getElementById('CartDrawer') ||
             document.querySelector('cart-drawer') ||
             document.querySelector('.cart-drawer') ||
             document.querySelector('.drawer--cart') ||
             document.querySelector('[data-cart-drawer]');
        if (themeDrawer) {
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
          console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');
        } else {
          // NO theme drawer found — create our OWN from scratch
          el = document.createElement('div');
          el.id = 'CCD-Drawer';
          el.style.display = 'none';
          el.innerHTML = CCD.buildDrawerShell();
          document.body.appendChild(el);
          console.log('[CCD] Created self-rendered drawer (no theme dependency)');
        }
      }`
);

fs.writeFileSync(file, code, 'utf8');

const result = fs.readFileSync(file, 'utf8');
var opens = (result.match(/{/g) || []).length;
var closes = (result.match(/}/g) || []).length;
console.log('Brace balance: { = ' + opens + ', } = ' + closes + ' (diff: ' + (opens - closes) + ')');
console.log('initDrawer structure OK:', result.includes("console.log('[CCD] Created self-rendered drawer"));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
