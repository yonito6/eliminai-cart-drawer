const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Add injectCSS method between initDrawer and openDrawer
code = code.replace(
  `      this.interceptAllCartTriggers();
    },

    openDrawer: function() {`,
  `      this.interceptAllCartTriggers();
    },

    injectCSS: function() {
      if (document.querySelector('link[href*="v14-css"]')) return; // already loaded
      // Derive CSS URL from our JS URL (same asset directory)
      var jsEl = document.querySelector('script[src*="v14-complete"]');
      if (jsEl) {
        var cssUrl = jsEl.src.replace(/v14-complete\\.js.*/, 'v14-css.css');
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        document.head.appendChild(link);
        console.log('[CCD] Injected CSS:', cssUrl);
      }
    },

    openDrawer: function() {`
);

// Also need to make sure the CSS targets #CCD-Drawer (it already does from the v15 refactor)
// But theme's inline style uses #CartDrawer.custom-cart-drawer — we handle that in initDrawer rename

// Update version
code = code.replace('[CCD v15.1]', '[CCD v15.2]');
code = code.replace("window.__ccd_version = '15.1'", "window.__ccd_version = '15.2'");

fs.writeFileSync(file, code, 'utf8');

// Verify
const result = fs.readFileSync(file, 'utf8');
console.log('injectCSS added:', result.includes('injectCSS: function()'));
console.log('CSS derivation:', result.includes('v14-complete\\.js.*'));
console.log('Theme takeover:', result.includes('Took over theme cart drawer'));
console.log('Version:', result.includes('v15.2'));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
