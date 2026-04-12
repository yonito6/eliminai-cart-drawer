const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// REMOVE the MutationObserver entirely — it's causing ghost items
// Replace with a simpler approach: just use CSS containment on frozen items

// 1. Remove the MutationObserver functions
const oldObserver = `  // MutationObserver: revert theme.js DOM changes during our animation
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

`;

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

code = tryReplace(code, oldObserver, '\n', 'Remove MutationObserver');

// 2. Remove _ccd_startGuard() and _ccd_stopGuard() calls
code = code.replace(/_ccd_startGuard\(\);\s*/g, '');
code = code.replace(/_ccd_stopGuard\(\);\s*/g, '');
console.log('Removed startGuard/stopGuard calls');

// 3. Remove the freeze siblings block and simplify back to just the class add
const oldFreezeBlock = `          // Freeze all siblings visually so theme rebuild is invisible
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
            item.removeAttribute('data-ccd-frozen');`;

const newFreezeBlock = `          if (item) {
            item.classList.add('ccd-item--removing');`;

code = tryReplace(code, oldFreezeBlock, newFreezeBlock, 'Simplify remove handler');

// 4. Remove the unfreeze setTimeout
const oldUnfreeze = `            setTimeout(function() {
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

const newUnfreeze = `            setTimeout(function() { if (item.parentNode) item.remove(); }, 240);`;

code = tryReplace(code, oldUnfreeze, newUnfreeze, 'Simplify unfreeze');

// 5. Remove anti-flicker CSS injection (not needed without freeze)
const oldCssInject = `      // Inject anti-flicker CSS for remove animations
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

const newCssInject = `      this.fixMobileWidth();`;

code = tryReplace(code, oldCssInject, newCssInject, 'Remove anti-flicker CSS');

// 6. NOW the real fix: Instead of MutationObserver, we intercept the theme's
//    buildCart by intercepting the Shopify section rendering endpoint.
//    The Impulse theme fetches /?section_id=cart-drawer or similar to rebuild.
//    Let's also block /cart (without .js) which returns HTML.
//
//    Update the fetch interceptor to also block section renders:
const oldIsBlocked = `  function _ccd_isBlockedUrl(url) {
    if (typeof url !== 'string') return false;
    // Block /cart/change.js, /cart/update.js, /cart?section_id=, /cart?view=
    if (url.indexOf('/cart/change.js') !== -1) return true;
    if (url.indexOf('/cart/update.js') !== -1) return true;
    if (url.indexOf('/cart?section_id') !== -1) return true;
    // Don't block /cart.js (we use it) or /cart?view=ajax (we use it)
    return false;
  }`;

const newIsBlocked = `  function _ccd_isBlockedUrl(url) {
    if (typeof url !== 'string') return false;
    if (url.indexOf('/cart/change.js') !== -1) return true;
    if (url.indexOf('/cart/update.js') !== -1) return true;
    if (url.indexOf('/cart?section_id') !== -1) return true;
    if (url.indexOf('section_id=cart') !== -1) return true;
    if (url.indexOf('sections=cart') !== -1) return true;
    // Block section rendering that themes use to rebuild cart HTML
    if (/\\/cart(?:\\?|$)/.test(url) && url.indexOf('.js') === -1 && url.indexOf('view=ajax') === -1) return true;
    return false;
  }`;

code = tryReplace(code, oldIsBlocked, newIsBlocked, 'Expand blocked URLs');

// 7. For the blocked section render fetches, return empty HTML instead of JSON
const oldFetchBlock = `    if (window.__ccd_block_rebuild && !window.__ccd_own_fetch && _ccd_isBlockedUrl(url)) {
      var cached = window.__ccd_last_cart;
      if (cached) {
        return Promise.resolve(new Response(JSON.stringify(cached), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        }));
      }
      // No cache yet — return empty-ish response to prevent theme rebuild
      return Promise.resolve(new Response('{}', {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }`;

const newFetchBlock = `    if (window.__ccd_block_rebuild && !window.__ccd_own_fetch && _ccd_isBlockedUrl(url)) {
      var cached = window.__ccd_last_cart;
      // For JSON endpoints, return cached cart; for HTML endpoints, return empty
      var isJson = url.indexOf('.js') !== -1;
      if (isJson && cached) {
        return Promise.resolve(new Response(JSON.stringify(cached), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        }));
      }
      return Promise.resolve(new Response(isJson ? '{}' : '', {
        status: 200, headers: { 'Content-Type': isJson ? 'application/json' : 'text/html' }
      }));
    }`;

code = tryReplace(code, oldFetchBlock, newFetchBlock, 'Smart response types');

fs.writeFileSync(file, code, 'utf8');
console.log('\nDone. Size:', code.length);
