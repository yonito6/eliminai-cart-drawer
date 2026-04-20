const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');
let changes = 0;

// ──────────────────────────────────────────────────────────
// FIX 1: Remove handler — replace collapse animation with
//        instant dim + loading overlay. Let morphDOM handle removal.
// ──────────────────────────────────────────────────────────

const oldRemove = `if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var item = removeBtn.closest('.ccd-item');
          if (item && !busy) {
            item.classList.add('ccd-item--removing');

            var _h = item.offsetHeight;
            item.style.maxHeight = _h + 'px';
            item.style.overflow = 'hidden';
            item.offsetHeight;
            item.style.transition = 'max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.12s ease, padding 0.22s cubic-bezier(0.4, 0, 0.2, 1), margin 0.22s cubic-bezier(0.4, 0, 0.2, 1), border-width 0.22s ease';
            item.style.opacity = '0';
            item.style.maxHeight = '0';
            item.style.paddingTop = '0';
            item.style.paddingBottom = '0';
            item.style.marginTop = '0';
            item.style.marginBottom = '0';
            item.style.borderWidth = '0';
            setTimeout(function() { if (item.parentNode) item.remove(); }, 240);
          }`;

const newRemove = `if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var item = removeBtn.closest('.ccd-item');
          if (item && !busy) {
            // Dim item immediately (no collapse) — morphDOM handles removal
            item.classList.add('ccd-item--removing');
            item.style.opacity = '0.3';
            item.style.pointerEvents = 'none';
            item.style.transition = 'opacity 0.15s ease';
          }
          // Show loading overlay immediately
          if (CCD._isOpen) CCD.showLoading();`;

if (c.includes(oldRemove)) {
  c = c.replace(oldRemove, newRemove);
  changes++;
  console.log('OK [1/4]: Remove handler — replaced collapse animation with dim + loading');
} else {
  console.log('FAIL [1/4]: Remove handler not found');
  // Debug: find nearby code
  const idx = c.indexOf('ccd-item--removing');
  if (idx > -1) console.log('  Found ccd-item--removing at char', idx, ':', c.substring(idx - 80, idx + 200));
  process.exit(1);
}

// ──────────────────────────────────────────────────────────
// FIX 2: Gift remove handler — same treatment
// ──────────────────────────────────────────────────────────

const oldGiftRemove = `var giftItem = giftRemoveBtn.closest('.ccd-gift-item');
          if (giftItem) {
            giftItem.classList.add('ccd-item--removing');
            var gh = giftItem.offsetHeight;
            giftItem.style.maxHeight = gh + 'px';
            giftItem.style.overflow = 'hidden';
            giftItem.offsetHeight;
            giftItem.style.transition = 'max-height 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease, padding 0.15s cubic-bezier(0.4, 0, 0.2, 1), margin 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            giftItem.style.opacity = '0';
            giftItem.style.maxHeight = '0';
            giftItem.style.paddingTop = '0';
            giftItem.style.paddingBottom = '0';
            giftItem.style.marginTop = '0';
            giftItem.style.marginBottom = '0';
          }`;

const newGiftRemove = `var giftItem = giftRemoveBtn.closest('.ccd-gift-item');
          if (giftItem) {
            giftItem.classList.add('ccd-item--removing');
            giftItem.style.opacity = '0.3';
            giftItem.style.pointerEvents = 'none';
            giftItem.style.transition = 'opacity 0.15s ease';
          }
          if (CCD._isOpen) CCD.showLoading();`;

if (c.includes(oldGiftRemove)) {
  c = c.replace(oldGiftRemove, newGiftRemove);
  changes++;
  console.log('OK [2/4]: Gift remove handler — replaced collapse with dim + loading');
} else {
  console.log('WARN [2/4]: Gift remove handler not found (may already be updated)');
}

// ──────────────────────────────────────────────────────────
// FIX 3: Queued remove in changeQty — replace collapse animation
//        with simple dim (same as main handler)
// ──────────────────────────────────────────────────────────

const oldQueued = `if (p.qty === 0) {
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
          }`;

const newQueued = `if (p.qty === 0) {
            var qItem = p.btnEl ? p.btnEl.closest('.ccd-item') : document.querySelector('.ccd-item[data-key="' + p.key + '"]');
            if (qItem && !qItem.classList.contains('ccd-item--removing')) {
              qItem.classList.add('ccd-item--removing');
              qItem.style.opacity = '0.3';
              qItem.style.pointerEvents = 'none';
              qItem.style.transition = 'opacity 0.15s ease';
            }
          }`;

if (c.includes(oldQueued)) {
  c = c.replace(oldQueued, newQueued);
  changes++;
  console.log('OK [3/4]: Queued remove — replaced collapse with dim');
} else {
  console.log('WARN [3/4]: Queued remove not found (may already be updated)');
}

// ──────────────────────────────────────────────────────────
// FIX 4: Show loading for qty +/- too (not just removes)
//        In changeQty, show loading at the top for all ops when drawer is open
// ──────────────────────────────────────────────────────────

const oldChangeQtyStart = `busy = true;
      if (btnEl) btnEl.classList.add('ccd-qty__btn--loading');
      var item = btnEl ? btnEl.closest('.ccd-item') : null;
      if (item && qty === 0) item.classList.add('ccd-item--removing');`;

const newChangeQtyStart = `busy = true;
      if (btnEl) btnEl.classList.add('ccd-qty__btn--loading');
      var item = btnEl ? btnEl.closest('.ccd-item') : null;
      if (item && qty === 0) item.classList.add('ccd-item--removing');
      // Show loading for ALL operations — keeps drawer in loading state until fresh data arrives
      if (CCD._isOpen && qty !== 0) CCD.showLoading();`;

if (c.includes(oldChangeQtyStart)) {
  c = c.replace(oldChangeQtyStart, newChangeQtyStart);
  changes++;
  console.log('OK [4/4]: changeQty — added showLoading for qty +/- ops');
} else {
  console.log('WARN [4/4]: changeQty start not found');
}

fs.writeFileSync('v14-complete.js', c);
console.log('\nDone — ' + changes + '/4 changes applied');
console.log('\nSummary:');
console.log('  - Remove: dim item (opacity 0.3) + loading overlay, NO collapse animation');
console.log('  - Gift remove: same treatment');
console.log('  - Queued remove: same treatment');
console.log('  - Qty +/-: loading overlay shown during fetch');
console.log('  - morphDOM handles all DOM changes in one clean pass');
console.log('  - No more double-render blink');
