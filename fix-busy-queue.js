const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

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

// PROBLEM: Click handler starts collapse animation BEFORE changeQty checks busy.
// If busy=true, changeQty returns silently — item is visually gone but never removed from cart.
//
// FIX: Add a queue. If busy, save the operation and execute it after current op finishes.
// Also: don't animate remove in click handler if busy — let changeQty handle it.

// 1. Add a queue variable after the busy flag
const oldBusy = `  var busy = false;`;
const newBusy = `  var busy = false;
  var _pendingOp = null; // queued operation when busy`;

code = tryReplace(code, oldBusy, newBusy, 'Add queue variable');

// 2. In changeQty: if busy, queue the operation instead of dropping it
const oldBusyCheck = `    changeQty: function(key, qty, btnEl) {
      if (busy) return;`;
const newBusyCheck = `    changeQty: function(key, qty, btnEl) {
      if (busy) {
        // Queue this operation — will execute after current op finishes
        _pendingOp = { key: key, qty: qty, btnEl: btnEl };
        return;
      }`;

code = tryReplace(code, oldBusyCheck, newBusyCheck, 'Queue when busy');

// 3. After busy=false in .then(), execute queued operation
const oldBusyFalse = `        window.__ccd_last_cart = cart;
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');`;
const newBusyFalse = `        window.__ccd_last_cart = cart;
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        // Execute queued operation if any
        if (_pendingOp) {
          var p = _pendingOp;
          _pendingOp = null;
          // Start collapse animation for queued removes
          if (p.qty === 0) {
            var qItem = p.btnEl ? p.btnEl.closest('.ccd-item') : document.querySelector('.ccd-item[data-key="' + p.key + '"]');
            if (qItem && !qItem.classList.contains('ccd-item--removing')) {
              qItem.classList.add('ccd-item--removing');
              var _qh = qItem.offsetHeight;
              qItem.style.maxHeight = _qh + 'px';
              qItem.style.overflow = 'hidden';
              qItem.offsetHeight;
              qItem.style.transition = 'max-height 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.12s ease, padding 0.22s cubic-bezier(0.4,0,0.2,1), margin 0.22s cubic-bezier(0.4,0,0.2,1), border-width 0.22s ease';
              qItem.style.opacity = '0';
              qItem.style.maxHeight = '0';
              qItem.style.paddingTop = '0';
              qItem.style.paddingBottom = '0';
              qItem.style.marginTop = '0';
              qItem.style.marginBottom = '0';
              qItem.style.borderWidth = '0';
              setTimeout(function() { if (qItem.parentNode) qItem.remove(); }, 240);
            }
          }
          CCD.changeQty(p.key, p.qty, p.btnEl);
          return; // skip the rest — the queued changeQty will handle it
        }`;

code = tryReplace(code, oldBusyFalse, newBusyFalse, 'Execute queued op');

// 4. Same in the catch handler
const oldCatchBusy = `      .catch(function() {
        window.__ccd_block_rebuild = false;
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        if (item) item.classList.remove('ccd-item--removing');
      });`;
const newCatchBusy = `      .catch(function() {
        window.__ccd_block_rebuild = false;
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        if (item) item.classList.remove('ccd-item--removing');
        // Execute queued operation if any
        if (_pendingOp) {
          var p = _pendingOp;
          _pendingOp = null;
          CCD.changeQty(p.key, p.qty, p.btnEl);
        }
      });`;

code = tryReplace(code, oldCatchBusy, newCatchBusy, 'Execute queued op in catch');

// 5. In the remove click handler, check busy BEFORE starting animation
// If busy, don't animate — the queue will handle it when the current op finishes
const oldRemoveHandler = `        if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var item = removeBtn.closest('.ccd-item');
          if (item) {
            item.classList.add('ccd-item--removing');`;
const newRemoveHandler = `        if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var item = removeBtn.closest('.ccd-item');
          if (item && !busy) {
            item.classList.add('ccd-item--removing');`;

code = tryReplace(code, oldRemoveHandler, newRemoveHandler, 'Guard remove animation with busy');

// 6. Also fix: the remove handler has its own __ccd_block_rebuild=true + 800ms timeout
// which conflicts with changeQty's flag. Remove the redundant one from click handler.
const oldRemoveBlock = `            // Block theme.js from rebuilding cart during animation
            window.__ccd_block_rebuild = true;
            setTimeout(function() { window.__ccd_block_rebuild = false; }, 800);`;
// Just remove it — changeQty handles the flag now
code = tryReplace(code, oldRemoveBlock, '', 'Remove redundant block in click handler');

// 7. Update version
code = code.replace("'14.10'", "'14.11'");
code = code.replace("v14.10", "v14.11");
console.log('Updated version to 14.11');

fs.writeFileSync(file, code, 'utf8');
console.log('Done. Size:', code.length);
