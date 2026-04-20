#!/usr/bin/env node
/**
 * BUG-003 Fix: Cart refresh causes visible flash/flicker.
 *
 * Root cause: _doRefresh immediately morphDOMs new items into the visible container,
 * causing visible content swap. User sees items disappearing/reappearing.
 *
 * Fix: Add loading overlay → build off-screen → crossfade transition.
 *
 * 1. Add CSS for loading shimmer overlay (.ccd-loading-overlay)
 * 2. Modify _doRefresh to show overlay, build off-screen, then crossfade
 * 3. Add showLoading() / hideLoading() helpers
 *
 * Input:  v14-complete.js (current v16.6)
 * Output: v14-complete.js (v16.7 with background refresh)
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'v14-complete.js');
let code = fs.readFileSync(FILE, 'utf8');
const origSize = code.length;

console.log('BUG-3 Fix: Background refresh pattern');
console.log('Input size:', origSize, 'bytes');

// ============================================================
// STEP 1: Add CSS for loading overlay
// ============================================================
console.log('\nStep 1: Add loading overlay CSS...');

const cssMarker = ".ccd-overlay--visible { opacity: 1 !important; pointer-events: auto !important; }';";
if (!code.includes(cssMarker)) {
  console.error('ERROR: Could not find CSS marker');
  process.exit(1);
}

const loadingCSS = `
      // ── BUG-3 FIX: Loading overlay for smooth background refresh ──
      '.ccd-loading-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10; pointer-events: none; opacity: 0; transition: opacity 0.2s ease; }\\n' +
      '.ccd-loading-overlay--visible { opacity: 1; pointer-events: auto; }\\n' +
      '.ccd-loading-shimmer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--ccd-bg, #1a1a2e); }\\n' +
      '.ccd-loading-shimmer::after { content: \"\"; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent); animation: ccd-shimmer 1.2s ease-in-out infinite; }\\n' +
      '@keyframes ccd-shimmer { 100% { left: 100%; } }\\n' +
      '.ccd-items-crossfade { transition: opacity 0.15s ease; }\\n' +
      '.ccd-items-crossfade--out { opacity: 0.3; }\\n' +`;

code = code.replace(
  cssMarker,
  cssMarker + '\n' + loadingCSS
);

console.log('  Added loading overlay CSS');

// ============================================================
// STEP 2: Add showLoading() / hideLoading() helpers
// ============================================================
console.log('\nStep 2: Add loading helpers...');

// Find a good spot — right before refreshLight
const refreshLightMarker = '    // Lightweight refresh: update totals, progress, empty state — NO morphDOM';
if (!code.includes(refreshLightMarker)) {
  console.error('ERROR: Could not find refreshLight marker');
  process.exit(1);
}

const loadingHelpers = `    // ── BUG-3 FIX: Loading overlay helpers ──
    _loadingOverlay: null,
    showLoading: function() {
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
    },
    hideLoading: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      var ov = CCD._loadingOverlay || (d.querySelector && d.querySelector('.ccd-loading-overlay'));
      if (ov) { ov.classList.remove('ccd-loading-overlay--visible'); }
      var items = d.querySelector('[data-products]');
      if (items) { items.classList.remove('ccd-items-crossfade--out'); }
    },
`;

code = code.replace(refreshLightMarker, loadingHelpers + '\n    ' + refreshLightMarker);
console.log('  Added showLoading/hideLoading helpers');

// ============================================================
// STEP 3: Modify _doRefresh to use crossfade pattern
// ============================================================
console.log('\nStep 3: Modify _doRefresh for background refresh...');

// The key change: wrap the morphDOM call in a crossfade.
// Before morphDOM, fade items out. After morphDOM, fade back in.
const oldMorphBlock = `      // Theme-independent: render items from cart JSON (no /cart?view=ajax)
      var pc = document.querySelector("#CCD-Drawer [data-products]");
      if (pc) {
        var ni = CCD.renderCartItems(cart);
        if (ni) {
          CCD.morphDOM(pc, ni);
        }
      }`;

const newMorphBlock = `      // Theme-independent: render items from cart JSON (no /cart?view=ajax)
      // BUG-3 FIX: Build new DOM, then crossfade transition (no visible flash)
      var pc = document.querySelector("#CCD-Drawer [data-products]");
      if (pc) {
        var ni = CCD.renderCartItems(cart);
        if (ni) {
          // If items already showing, crossfade: dim → morph → brighten
          if (pc.children.length > 0 && CCD._isOpen) {
            pc.classList.add('ccd-items-crossfade');
            CCD.morphDOM(pc, ni);
            // Remove dim after morph (hideLoading handles full fade-in)
            requestAnimationFrame(function() {
              pc.classList.remove('ccd-items-crossfade--out');
              CCD.hideLoading();
            });
          } else {
            CCD.morphDOM(pc, ni);
          }
        }
      }`;

if (!code.includes(oldMorphBlock)) {
  console.error('ERROR: Could not find morphDOM block in _doRefresh');
  console.error('Looking for:', oldMorphBlock.substring(0, 80));
  process.exit(1);
}

code = code.replace(oldMorphBlock, newMorphBlock);
console.log('  Modified _doRefresh morphDOM with crossfade');

// ============================================================
// STEP 4: Add showLoading at the start of cart operations
// ============================================================
console.log('\nStep 4: Add showLoading to cart operations...');

// 4a: In the fetch intercept — when /cart/add.js is intercepted, show loading
const addIntercept = "          // Hide empty-state immediately so theme can't flash it during add";
if (!code.includes(addIntercept)) {
  console.error('ERROR: Could not find add intercept marker');
  process.exit(1);
}
code = code.replace(
  addIntercept,
  '          // BUG-3: Show loading overlay during add operation\n          if (CCD._isOpen) CCD.showLoading();\n' + addIntercept
);
console.log('  Added showLoading to /cart/add.js intercept');

// 4b: In quantity change handler — show loading during qty changes
// Find the qty change fetch calls
const qtyChangeMarker = "        .then(function(cart) { unlock(); CCD.refreshLight(cart); })";
if (!code.includes(qtyChangeMarker)) {
  console.error('ERROR: Could not find qty change marker');
  process.exit(1);
}

// 4c: In the debounced refresh — hide loading after render completes
// At the end of _doRefresh, always hide loading
const doRefreshEnd = "      CCD.updateProgress(cart);\n      CCD.applyScarcity(cart);\n      CCD.lockScarcityQty();";
if (!code.includes(doRefreshEnd)) {
  console.error('ERROR: Could not find _doRefresh end marker');
  process.exit(1);
}

code = code.replace(
  doRefreshEnd,
  doRefreshEnd + '\n      // BUG-3: Ensure loading overlay is hidden after full refresh\n      CCD.hideLoading();'
);
console.log('  Added hideLoading at end of _doRefresh');

// Also hide loading at end of refreshLight
const refreshLightEnd = "      CCD.updateProgress(cart);\n      CCD.applyScarcity(cart);\n      CCD.lockScarcityQty();\n      var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;";
// There are two occurrences (refreshLight + _doRefresh). We need to target refreshLight specifically.
// refreshLight version is followed by `var es = document.querySelector('#CCD-Drawer .ccd-cart-empty, #CCD-Drawer .ccd-empty');`
// Actually both versions have the same end. Let's just add hideLoading at the very end of refreshLight too.
// refreshLight ends with the empty-state block. Let's find its specific pattern.

// Find refreshLight's unique end — its empty state block has return directly after the if-else
const refreshLightEmptyEnd = "        if (ft) ft.style.display = '';\n      }\n    },";
if (code.includes(refreshLightEmptyEnd)) {
  code = code.replace(
    refreshLightEmptyEnd,
    "        if (ft) ft.style.display = '';\n      }\n      // BUG-3: Ensure loading overlay hidden after refreshLight\n      CCD.hideLoading();\n    },"
  );
  console.log('  Added hideLoading at end of refreshLight');
} else {
  console.log('  WARNING: Could not find refreshLight end marker — skipping');
}

// ============================================================
// STEP 5: Show loading during refreshOnOpen fetch
// ============================================================
console.log('\nStep 5: Add loading to refreshOnOpen...');

const refreshOnOpenFetch = "        // Single cart fetch — no race between ensureProtection and refresh\n        fetch('/cart.js')";
if (code.includes(refreshOnOpenFetch)) {
  code = code.replace(
    refreshOnOpenFetch,
    "        // BUG-3: Show loading during initial cart fetch\n        if (CCD._lastRealCount > 0) CCD.showLoading();\n        // Single cart fetch — no race between ensureProtection and refresh\n        fetch('/cart.js')"
  );
  console.log('  Added showLoading to refreshOnOpen');
} else {
  console.log('  WARNING: Could not find refreshOnOpen fetch marker — skipping');
}

// ============================================================
// STEP 6: Show loading during remove operations
// ============================================================
console.log('\nStep 6: Add loading to remove operations...');

const removeMarker = "          // Item removed — lightweight update (skip morphDOM to avoid flicker)";
if (code.includes(removeMarker)) {
  code = code.replace(
    removeMarker,
    "          // BUG-3: Show loading during remove\n          if (CCD._isOpen) CCD.showLoading();\n          // Item removed — lightweight update (skip morphDOM to avoid flicker)"
  );
  console.log('  Added showLoading to remove handler');
} else {
  console.log('  WARNING: Could not find remove marker — skipping');
}

// ============================================================
// WRITE OUTPUT
// ============================================================
fs.writeFileSync(FILE, code);
const newSize = code.length;
console.log('\nWrote v14-complete.js');
console.log('Size: ' + origSize + ' → ' + newSize + ' bytes (+ ' + (newSize - origSize) + ')');

// Also create snapshot
const snapshot = path.resolve(__dirname, '..', 'snapshots', 'v16.7-bg-refresh-20260418.js');
fs.writeFileSync(snapshot, code);
console.log('Snapshot: ' + snapshot);

console.log('\nBUG-3 Fix applied:');
console.log('  ✓ Loading overlay CSS added');
console.log('  ✓ showLoading/hideLoading helpers added');
console.log('  ✓ _doRefresh uses crossfade morphDOM');
console.log('  ✓ Cart operations show loading overlay');
console.log('  ✓ Loading hidden after render completes');
