const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');
let changes = 0;

// ──────────────────────────────────────────────────────────
// FIX 1: morphDOM — remove dimmed items immediately instead of skipping them
// Old: skips ccd-item--removing elements (assumed they'd collapse via CSS)
// New: removes them immediately (they're already dimmed at 0.3 opacity)
// ──────────────────────────────────────────────────────────

const oldMorphRemove = `      Object.keys(existMap).forEach(function(k) {
        var found = newList.some(function(n) { return n.key === k; });
        if (!found) {
          var el = existMap[k];
            if (el.classList.contains('ccd-item--removing')) { return; } // already collapsing — let CSS animation finish
          el.classList.add('ccd-item--removing');
          var h = el.offsetHeight;
          el.style.maxHeight = h + 'px';
          el.style.overflow = 'hidden';
          el.offsetHeight; /* force reflow */
          el.style.transition = 'max-height 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease, padding 0.15s cubic-bezier(0.4, 0, 0.2, 1), margin 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-width 0.15s ease';
          el.style.opacity = '0';
          el.style.maxHeight = '0';
          el.style.paddingTop = '0';
          el.style.paddingBottom = '0';
          el.style.marginTop = '0';
          el.style.marginBottom = '0';
          el.style.borderWidth = '0';
          setTimeout(function() { el.remove(); }, 180);
        }
      });`;

const newMorphRemove = `      Object.keys(existMap).forEach(function(k) {
        var found = newList.some(function(n) { return n.key === k; });
        if (!found) {
          var el = existMap[k];
          // Item not in new cart — remove it from DOM immediately
          // (it's already dimmed at 0.3 opacity from the click handler)
          el.remove();
        }
      });`;

if (c.includes(oldMorphRemove)) {
  c = c.replace(oldMorphRemove, newMorphRemove);
  changes++;
  console.log('OK [1/2]: morphDOM — items removed immediately (no collapse animation)');
} else {
  console.log('FAIL [1/2]: morphDOM remove block not found');
  const idx = c.indexOf('ccd-item--removing');
  const idx2 = c.indexOf('ccd-item--removing', idx + 1);
  const idx3 = c.indexOf('ccd-item--removing', idx2 + 1);
  console.log('  Found ccd-item--removing at positions:', idx, idx2, idx3);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────
// FIX 2: Remove the "smooth reflow" transition block that references
//        ccd-item--removing for remaining items (no longer needed —
//        removal is instant, no collapse to reflow around)
// ──────────────────────────────────────────────────────────

const oldReflow = `      // Smooth reflow: only when items are being removed
      var hasRemovals = Object.keys(existMap).some(function(k) { return !newList.some(function(n) { return n.key === k; }); });
      if (hasRemovals) Object.keys(existMap).forEach(function(k) {
        var rl = existMap[k];
        if (!rl.classList.contains('ccd-item--removing')) {
          rl.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
          var cl = function() { rl.style.transition = ''; rl.removeEventListener('transitionend', cl); };
          rl.addEventListener('transitionend', cl);
        }
      });`;

const newReflow = `      // Items removed instantly — remaining items reflow naturally`;

if (c.includes(oldReflow)) {
  c = c.replace(oldReflow, newReflow);
  changes++;
  console.log('OK [2/2]: Removed stale reflow transition block');
} else {
  console.log('WARN [2/2]: Reflow transition block not found');
}

fs.writeFileSync('v14-complete.js', c);
console.log('\nDone — ' + changes + '/2 changes applied');
console.log('morphDOM now removes items instantly (no ghost elements)');
