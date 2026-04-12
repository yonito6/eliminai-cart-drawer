const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// FIX A: Make fetch interceptor skip our own calls
code = code.replace(
  'if (window.__ccd_block_rebuild && typeof url === \'string\' && url.indexOf(\'/cart/change.js\') !== -1) {',
  'if (window.__ccd_block_rebuild && !window.__ccd_own_fetch && typeof url === \'string\' && url.indexOf(\'/cart/change.js\') !== -1) {'
);
console.log('FIX A: fetch interceptor skip own calls');

// FIX B: In changeQty, wrap our fetch with __ccd_own_fetch flag
const oldFetch = `      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      })
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        window.__ccd_last_cart = cart; // cache for fetch interceptor
        busy = false;`;

const newFetch = `      window.__ccd_own_fetch = true;
      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      })
      .then(function(r) { window.__ccd_own_fetch = false; return r.json(); })
      .then(function(cart) {
        window.__ccd_last_cart = cart; // cache for fetch interceptor
        busy = false;`;

if (code.indexOf(oldFetch) !== -1) {
  code = code.replace(oldFetch, newFetch);
  console.log('FIX B: wrapped changeQty fetch with own_fetch flag (LF)');
} else {
  const oldCR = oldFetch.replace(/\n/g, '\r\n');
  const newCR = newFetch.replace(/\n/g, '\r\n');
  if (code.indexOf(oldCR) !== -1) {
    code = code.replace(oldCR, newCR);
    console.log('FIX B: wrapped changeQty fetch with own_fetch flag (CRLF)');
  } else {
    console.log('FIX B: NOT FOUND');
  }
}

// FIX C: Also reset __ccd_own_fetch in the catch handler
const oldCatch = `      .catch(function() {
        busy = false;`;
const newCatch = `      .catch(function() {
        window.__ccd_own_fetch = false;
        busy = false;`;

if (code.indexOf(oldCatch) !== -1) {
  code = code.replace(oldCatch, newCatch);
  console.log('FIX C: reset own_fetch in catch (LF)');
} else {
  const oldCR = oldCatch.replace(/\n/g, '\r\n');
  const newCR = newCatch.replace(/\n/g, '\r\n');
  if (code.indexOf(oldCR) !== -1) {
    code = code.replace(oldCR, newCR);
    console.log('FIX C: reset own_fetch in catch (CRLF)');
  } else {
    console.log('FIX C: NOT FOUND');
  }
}

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
