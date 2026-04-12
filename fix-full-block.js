const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Replace the entire interceptor block with a much more aggressive one
const oldBlock = `  // Intercept theme.js cart rebuilds: block its fetch + swallow its events
  var _origDispatch = document.dispatchEvent.bind(document);
  document.dispatchEvent = function(evt) {
    if (window.__ccd_block_rebuild && evt.type && (evt.type === 'cart:updated' || evt.type === 'cart:build')) {
      return true;
    }
    return _origDispatch(evt);
  };
  // Intercept fetch: when __ccd_block_rebuild is active, return cached cart for /cart/change.js
  var _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (window.__ccd_block_rebuild && !window.__ccd_own_fetch && typeof url === 'string' && url.indexOf('/cart/change.js') !== -1) {
      // Return the last known cart state so theme.js gets a response but doesn't trigger rebuild
      var cached = window.__ccd_last_cart;
      if (cached) {
        return Promise.resolve(new Response(JSON.stringify(cached), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        }));
      }
    }
    return _origFetch.apply(this, arguments);
  };`;

const newBlock = `  // === THEME REBUILD BLOCKER ===
  // Blocks ALL theme.js cart rebuilds during our animations:
  // 1. Swallow cart:updated / cart:build events
  // 2. Block theme's fetch to /cart/change.js AND /cart (section render)
  // 3. Block theme's XMLHttpRequest to same URLs
  var _origDispatch = document.dispatchEvent.bind(document);
  document.dispatchEvent = function(evt) {
    if (window.__ccd_block_rebuild && evt.type && (evt.type === 'cart:updated' || evt.type === 'cart:build' || evt.type === 'cart:quantity')) {
      return true;
    }
    return _origDispatch(evt);
  };
  function _ccd_isBlockedUrl(url) {
    if (typeof url !== 'string') return false;
    // Block /cart/change.js, /cart/update.js, /cart?section_id=, /cart?view=
    if (url.indexOf('/cart/change.js') !== -1) return true;
    if (url.indexOf('/cart/update.js') !== -1) return true;
    if (url.indexOf('/cart?section_id') !== -1) return true;
    // Don't block /cart.js (we use it) or /cart?view=ajax (we use it)
    return false;
  }
  var _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (window.__ccd_block_rebuild && !window.__ccd_own_fetch && _ccd_isBlockedUrl(url)) {
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
    }
    return _origFetch.apply(this, arguments);
  };
  // Also intercept XMLHttpRequest for older theme code paths
  var _origXhrOpen = XMLHttpRequest.prototype.open;
  var _origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._ccd_url = url;
    return _origXhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    if (window.__ccd_block_rebuild && !window.__ccd_own_fetch && _ccd_isBlockedUrl(this._ccd_url)) {
      // Silently swallow — don't send the request
      var self = this;
      setTimeout(function() {
        Object.defineProperty(self, 'readyState', { value: 4, writable: true });
        Object.defineProperty(self, 'status', { value: 200, writable: true });
        Object.defineProperty(self, 'responseText', { value: '{}', writable: true });
        if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
        if (typeof self.onload === 'function') self.onload();
      }, 0);
      return;
    }
    return _origXhrSend.apply(this, arguments);
  };`;

// Try both line endings
let found = false;
if (code.indexOf(oldBlock) !== -1) {
  code = code.replace(oldBlock, newBlock);
  found = true;
  console.log('Replaced interceptor block (LF)');
} else {
  const oldCR = oldBlock.replace(/\n/g, '\r\n');
  if (code.indexOf(oldCR) !== -1) {
    code = code.replace(oldCR, newBlock.replace(/\n/g, '\r\n'));
    found = true;
    console.log('Replaced interceptor block (CRLF)');
  }
}

if (!found) {
  console.log('ERROR: Could not find old interceptor block');
  // Debug: show first 1000 chars
  console.log(code.substring(0, 500).replace(/\r/g, '\\r').replace(/\n/g, '\\n\n'));
  process.exit(1);
}

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
