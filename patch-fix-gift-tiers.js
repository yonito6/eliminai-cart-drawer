const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// Problem: Lines 278-280 use GIFT_TIERS.forEach() but GIFT_TIERS is declared
// with var on line 284 — so it's hoisted as undefined at line 278.
// Fix: Replace the premature GIFT_TIERS.forEach with REWARD_TIERS.forEach
// (REWARD_TIERS is defined on line 246 and contains all tiers)
// tierGifts() already handles tiers without gifts by returning []

const broken = 'GIFT_TIERS.forEach(function(t) {\n' +
               '    tierGifts(t).forEach(function(g) { if (g.variantId) GIFT_VIDS[String(g.variantId)] = true; });\n' +
               '  });\n' +
               '  if (WATCH_CASE_VID) GIFT_VIDS[String(WATCH_CASE_VID)] = true;';

const fixed = 'REWARD_TIERS.forEach(function(t) {\n' +
              '    tierGifts(t).forEach(function(g) { if (g.variantId) GIFT_VIDS[String(g.variantId)] = true; });\n' +
              '  });';

if (code.includes(broken)) {
  code = code.replace(broken, fixed);
  console.log('Fixed: GIFT_TIERS.forEach → REWARD_TIERS.forEach (line 278)');
  console.log('Removed premature WATCH_CASE_VID check (line 281, runs before var declaration)');
} else {
  console.log('Exact pattern not found, trying line-by-line...');
  // Try just the first line
  const line278 = '  GIFT_TIERS.forEach(function(t) {';
  if (code.includes(line278)) {
    // Only replace the FIRST occurrence (which is the problematic one)
    const idx = code.indexOf(line278);
    code = code.substring(0, idx) + '  REWARD_TIERS.forEach(function(t) {' + code.substring(idx + line278.length);
    console.log('Fixed line 278: GIFT_TIERS → REWARD_TIERS');
  }
  // Also remove the WATCH_CASE_VID line that uses an undefined var
  const watchLine = '  if (WATCH_CASE_VID) GIFT_VIDS[String(WATCH_CASE_VID)] = true;';
  const watchIdx = code.indexOf(watchLine);
  if (watchIdx !== -1 && watchIdx < code.indexOf('var WATCH_CASE_VID')) {
    code = code.substring(0, watchIdx) + code.substring(watchIdx + watchLine.length + 1);
    console.log('Removed premature WATCH_CASE_VID check');
  }
}

fs.writeFileSync('v14-complete.js', code);
console.log('Saved');
