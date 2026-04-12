const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// STRATEGY: Instead of trying to block theme rebuilds (which we can't fully do),
// FREEZE the visual state of remaining items during remove animation.
// Use CSS will-change + opacity trick: set items to a frozen visual state
// so that even if the DOM changes underneath, the user sees no flicker.

// 1. In the remove click handler, add a class to the cart items container
//    that freezes all non-removing items visually
// 2. Remove the class after animation completes

// Find the remove handler where we set ccd-item--removing
const oldRemoveBlock = `        if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var item = removeBtn.closest('.ccd-item');
          if (item) {
            item.classList.add('ccd-item--removing');
            // Block theme.js from rebuilding cart during animation
            window.__ccd_block_rebuild = true;
            setTimeout(function() { window.__ccd_block_rebuild = false; }, 500);`;

const newRemoveBlock = `        if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var item = removeBtn.closest('.ccd-item');
          // Freeze all siblings visually so theme rebuild is invisible
          var cartItemsContainer = document.querySelector('#CartDrawer [data-products]');
          if (cartItemsContainer) {
            // Snapshot current layout: lock each item's height and content
            var allItems = cartItemsContainer.querySelectorAll('.ccd-item:not(.ccd-item--removing)');
            allItems.forEach(function(el) {
              if (el !== item) {
                el.style.willChange = 'transform';
                el.setAttribute('data-ccd-frozen', '1');
              }
            });
            cartItemsContainer.classList.add('ccd-rebuilding');
          }
          if (item) {
            item.classList.add('ccd-item--removing');
            item.removeAttribute('data-ccd-frozen');
            // Block theme.js from rebuilding cart during animation
            window.__ccd_block_rebuild = true;
            setTimeout(function() { window.__ccd_block_rebuild = false; }, 800);`;

function tryReplace(src, old, repl, label) {
  if (src.indexOf(old) !== -1) {
    console.log(label + ': found (LF)');
    return src.replace(old, repl);
  }
  const oldCR = old.replace(/\n/g, '\r\n');
  const replCR = repl.replace(/\n/g, '\r\n');
  if (src.indexOf(oldCR) !== -1) {
    console.log(label + ': found (CRLF)');
    return src.replace(oldCR, replCR);
  }
  console.log(label + ': NOT FOUND');
  return src;
}

code = tryReplace(code, oldRemoveBlock, newRemoveBlock, 'FIX 1: freeze siblings');

// 2. After the remove animation completes (the setTimeout that removes the item),
//    unfreeze remaining items
const oldRemoveTimeout = `            setTimeout(function() { if (item.parentNode) item.remove(); }, 240);`;
const newRemoveTimeout = `            setTimeout(function() {
              if (item.parentNode) item.remove();
              // Unfreeze siblings after animation
              setTimeout(function() {
                var frozen = document.querySelectorAll('[data-ccd-frozen]');
                frozen.forEach(function(el) {
                  el.style.willChange = '';
                  el.removeAttribute('data-ccd-frozen');
                });
                var cc = document.querySelector('#CartDrawer [data-products]');
                if (cc) cc.classList.remove('ccd-rebuilding');
              }, 100);
            }, 240);`;

code = tryReplace(code, oldRemoveTimeout, newRemoveTimeout, 'FIX 2: unfreeze after remove');

// 3. Add CSS to make .ccd-rebuilding hide any DOM thrash
// We'll inject it into the morphDOM or refresh section
// Actually better: inject a <style> tag from JS at the top of init
const oldInit = `    init: function() {
      this.fixMobileWidth();`;
const newInit = `    init: function() {
      // Inject anti-flicker CSS for remove animations
      if (!document.getElementById('ccd-antiflicker-css')) {
        var style = document.createElement('style');
        style.id = 'ccd-antiflicker-css';
        style.textContent = [
          '.ccd-rebuilding .ccd-item[data-ccd-frozen] {',
          '  contain: strict;',
          '  contain-intrinsic-size: auto;',
          '}',
          '.ccd-rebuilding .ccd-item[data-ccd-frozen] * {',
          '  pointer-events: none !important;',
          '}',
        ].join('\\n');
        document.head.appendChild(style);
      }
      this.fixMobileWidth();`;

code = tryReplace(code, oldInit, newInit, 'FIX 3: inject anti-flicker CSS');

// 4. CRITICAL: The real problem is likely that our CCD.refresh() is called for
//    qty changes (not removes). For REMOVES, we already skip refresh (line ~298-300).
//    But the THEME also calls buildCart which re-renders the section.
//    The section render re-fetches the cart drawer HTML from Shopify.
//
//    NUCLEAR OPTION: During the block window, intercept the theme's
//    section rendering by also blocking fetch to section_rendering URLs
//    AND blocking innerHTML/outerHTML writes on the cart container.
//
//    Let's try MutationObserver: watch the cart container and REVERT
//    any childList or attribute changes during the block window.

// Add a MutationObserver that reverts DOM changes during block window
const oldUseStrict = `  'use strict';

  var CFG = window.CCD_CONFIG || {};`;
const newUseStrict = `  'use strict';

  // MutationObserver: revert theme.js DOM changes during our animation
  var _ccd_observer = null;
  function _ccd_startGuard() {
    var target = document.querySelector('#CartDrawer [data-products]');
    if (!target || _ccd_observer) return;
    // Take a snapshot of current innerHTML
    var snapshot = target.innerHTML;
    _ccd_observer = new MutationObserver(function(mutations) {
      if (!window.__ccd_block_rebuild) return;
      // Theme tried to change the cart DOM — revert it
      var hasItemChanges = mutations.some(function(m) {
        return m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0);
      });
      if (hasItemChanges && target.innerHTML !== snapshot) {
        // Restore, but keep any items we deliberately removed (ccd-item--removing)
        target.innerHTML = snapshot;
        // Re-remove items that were being animated out
        var removing = target.querySelectorAll('.ccd-item--removing');
        removing.forEach(function(el) { el.remove(); });
      }
    });
    _ccd_observer.observe(target, { childList: true, subtree: true, attributes: true });
  }
  function _ccd_stopGuard() {
    if (_ccd_observer) {
      _ccd_observer.disconnect();
      _ccd_observer = null;
    }
  }

  var CFG = window.CCD_CONFIG || {};`;

code = tryReplace(code, oldUseStrict, newUseStrict, 'FIX 4: MutationObserver guard');

// 5. Start the guard when we start a remove animation, stop when done
// In the remove handler, after setting __ccd_block_rebuild:
const oldBlockRebuild = `            // Block theme.js from rebuilding cart during animation
            window.__ccd_block_rebuild = true;
            setTimeout(function() { window.__ccd_block_rebuild = false; }, 800);`;
const newBlockRebuild = `            // Block theme.js from rebuilding cart during animation
            window.__ccd_block_rebuild = true;
            _ccd_startGuard();
            setTimeout(function() { window.__ccd_block_rebuild = false; _ccd_stopGuard(); }, 800);`;

code = tryReplace(code, oldBlockRebuild, newBlockRebuild, 'FIX 5: start/stop MutationObserver');

// Also need to handle the __ccd_block_rebuild in changeQty
const oldChangeQtyBlock = `      // Block theme.js rebuild for ALL cart changes
      window.__ccd_block_rebuild = true;
      setTimeout(function() { window.__ccd_block_rebuild = false; }, 800);`;
const newChangeQtyBlock = `      // Block theme.js rebuild for ALL cart changes
      window.__ccd_block_rebuild = true;
      _ccd_startGuard();
      setTimeout(function() { window.__ccd_block_rebuild = false; _ccd_stopGuard(); }, 800);`;

code = tryReplace(code, oldChangeQtyBlock, newChangeQtyBlock, 'FIX 6: guard in changeQty');

fs.writeFileSync(file, code, 'utf8');
console.log('\nDone. Size:', code.length);
