const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let changes = 0;

// ============================================================
// CHANGE 1: Add skeleton CSS + smooth transition CSS
// ============================================================
const overlayCSS = "'.ccd-overlay { position: fixed";
const overlayIdx = code.indexOf(overlayCSS);
if (overlayIdx === -1) { console.error('ERROR: overlay CSS not found'); process.exit(1); }
let lineStart = overlayIdx;
while (lineStart > 0 && code[lineStart-1] !== '\n') lineStart--;

const cssEntries = [
  // Skeleton
  '@keyframes ccdShimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}',
  '.ccd-loading-skeleton{display:block;padding-top:12px}',
  '.ccd-skeleton{display:flex;gap:12px;padding:12px 16px}',
  '.ccd-skeleton__img{width:64px;height:64px;border-radius:8px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200px 100%;animation:ccdShimmer 1.2s ease-in-out infinite;flex-shrink:0}',
  '.ccd-skeleton__lines{flex:1;display:flex;flex-direction:column;gap:8px;justify-content:center}',
  '.ccd-skeleton__line{height:12px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200px 100%;animation:ccdShimmer 1.2s ease-in-out infinite}',
  '.ccd-skeleton__line--short{width:60%}',
  '.ccd-skeleton__line--medium{width:80%}',
  '.ccd-skeleton__footer{padding:12px 16px}',
  '.ccd-skeleton__btn{height:48px;border-radius:8px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200px 100%;animation:ccdShimmer 1.2s ease-in-out infinite}',
  '.ccd-skeleton__progress{height:32px;margin:0 16px 8px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200px 100%;animation:ccdShimmer 1.2s ease-in-out infinite}',
  // Smooth transitions for items
  '.ccd-item{transition:opacity 0.2s ease,transform 0.2s ease}',
  '.ccd-item__price,.ccd-item__compare-price,.ccd-checkout-total,[data-subtotal]{transition:opacity 0.15s ease}',
  '.ccd-price-updating{opacity:0.5}',
];
const cssBlock = cssEntries.map(function(e) { return "      '" + e + "\\n' +"; }).join('\n') + '\n';
code = code.substring(0, lineStart) + cssBlock + code.substring(lineStart);
changes++;
console.log('1. CSS added (skeleton + smooth transitions)');

// ============================================================
// CHANGE 2: Add skeleton HTML in drawer shell
// ============================================================
const innerDiv = '<div class="ccd-inner" data-ccd-inner';
const innerIdx = code.indexOf(innerDiv);
if (innerIdx === -1) { console.error('ERROR: ccd-inner not found'); process.exit(1); }

const skeletonHTML =
  '<div class="ccd-loading-skeleton" data-ccd-skeleton style="display:none">' +
  '<div class="ccd-skeleton__progress"></div>' +
  '<div class="ccd-skeleton"><div class="ccd-skeleton__img"></div><div class="ccd-skeleton__lines"><div class="ccd-skeleton__line"></div><div class="ccd-skeleton__line ccd-skeleton__line--medium"></div><div class="ccd-skeleton__line ccd-skeleton__line--short"></div></div></div>' +
  '<div class="ccd-skeleton"><div class="ccd-skeleton__img"></div><div class="ccd-skeleton__lines"><div class="ccd-skeleton__line"></div><div class="ccd-skeleton__line ccd-skeleton__line--short"></div></div></div>' +
  '<div class="ccd-skeleton__footer"><div class="ccd-skeleton__btn"></div></div>' +
  '</div>';

code = code.substring(0, innerIdx) + skeletonHTML + code.substring(innerIdx);
changes++;
console.log('2. Skeleton HTML added');

// ============================================================
// CHANGE 3: Show skeleton on first open (before data loads)
// ============================================================
const firstOpenComment = '// First open ever (_lastRealCount is -1)';
const firstOpenIdx = code.indexOf(firstOpenComment);
if (firstOpenIdx === -1) { console.error('ERROR: first open comment not found'); process.exit(1); }

const afterComment = code.indexOf('\n', firstOpenIdx);
const skeletonShowCode = '\n        var _sk = document.querySelector("[data-ccd-skeleton]"); if (_sk) _sk.style.display = "block";';
code = code.substring(0, afterComment) + skeletonShowCode + code.substring(afterComment);
changes++;
console.log('3. Skeleton show on first open');

// ============================================================
// CHANGE 4: Hide skeleton when _doRefresh runs
// ============================================================
const doRefreshMarker = '_doRefresh: function(cart)';
const doRefreshIdx = code.indexOf(doRefreshMarker);
if (doRefreshIdx === -1) { console.error('ERROR: _doRefresh not found'); process.exit(1); }

const doRefreshBrace = code.indexOf('{', doRefreshIdx + doRefreshMarker.length);
const afterBrace = code.indexOf('\n', doRefreshBrace);
const skeletonHideCode = '\n      var _skeleton = document.querySelector("[data-ccd-skeleton]"); if (_skeleton) _skeleton.style.display = "none";';
code = code.substring(0, afterBrace) + skeletonHideCode + code.substring(afterBrace);
changes++;
console.log('4. Skeleton hide on refresh');

// ============================================================
// CHANGE 5: Smoother post-remove — remove 150ms delay
// ============================================================
// Find the setTimeout wrapping the /cart.js fetch after remove
const delay150 = '}, 150);';
// Find it in the remove context (near "post-remove /cart.js")
const postRemoveComment = 'post-remove /cart.js';
const prIdx = code.indexOf(postRemoveComment);
if (prIdx > -1) {
  // Find the setTimeout before this
  const searchStart = Math.max(0, prIdx - 500);
  const chunk = code.substring(searchStart, prIdx + 200);
  const stMatch = chunk.indexOf('setTimeout(function()');
  const endMatch = chunk.indexOf('}, 150);');
  if (stMatch > -1 && endMatch > -1) {
    const absStart = searchStart + stMatch;
    const absEnd = searchStart + endMatch + '}, 150);'.length;
    // Extract inner code (between setTimeout(function() { ... }, 150))
    const innerStart = absStart + 'setTimeout(function() {\n'.length;
    const innerEnd = searchStart + endMatch;
    const innerCode = code.substring(innerStart, innerEnd).trim();
    code = code.substring(0, absStart) + innerCode + code.substring(absEnd);
    changes++;
    console.log('5. Removed 150ms delay on post-remove refresh');
  } else {
    console.log('5. SKIP: setTimeout wrapper not found near post-remove comment');
  }
} else {
  console.log('5. SKIP: post-remove comment not found');
}

// ============================================================
// CHANGE 6: Add price fade transition in morphDOM updates
// ============================================================
const priceUpdateLine = "if (exPrice && nPrice && exPrice.textContent !== nPrice.textContent) exPrice.textContent = nPrice.textContent;";
const smoothPriceUpdate = "if (exPrice && nPrice && exPrice.textContent !== nPrice.textContent) { exPrice.classList.add('ccd-price-updating'); exPrice.textContent = nPrice.textContent; setTimeout(function(){exPrice.classList.remove('ccd-price-updating');},150); }";

if (code.includes(priceUpdateLine)) {
  code = code.replace(priceUpdateLine, smoothPriceUpdate);
  changes++;
  console.log('6. Added smooth price fade on update');
} else {
  console.log('6. SKIP: price update line not found');
}

// ============================================================
// CHANGE 7: Show skeleton on refreshOnOpen if no items
// ============================================================
const refreshOnOpenMarker = 'function refreshOnOpen()';
const refreshOnOpenIdx = code.indexOf(refreshOnOpenMarker);
if (refreshOnOpenIdx !== -1) {
  const rooBrace = code.indexOf('{', refreshOnOpenIdx);
  const afterRooBrace = code.indexOf('\n', rooBrace);
  const skeletonOnRefresh = '\n      var _skR = document.querySelector("[data-ccd-skeleton]"); if (_skR && !document.querySelector(".ccd-item")) _skR.style.display = "block";';
  code = code.substring(0, afterRooBrace) + skeletonOnRefresh + code.substring(afterRooBrace);
  changes++;
  console.log('7. Skeleton show in refreshOnOpen');
}

// ============================================================
// CHANGE 8: Smooth total price update (fade instead of snap)
// ============================================================
// In the lightweight remove path, make total update smooth
const totalUpdateLine = "if (_ct) _ct.textContent = CCD.fmt(CCD.getAdjustedTotal(cart));";
const smoothTotalUpdate = "if (_ct) { _ct.classList.add('ccd-price-updating'); _ct.textContent = CCD.fmt(CCD.getAdjustedTotal(cart)); setTimeout(function(){_ct.classList.remove('ccd-price-updating');},150); }";

if (code.includes(totalUpdateLine)) {
  code = code.replace(totalUpdateLine, smoothTotalUpdate);
  changes++;
  console.log('8. Smooth total price update');
} else {
  console.log('8. SKIP: total update line not found');
}

fs.writeFileSync('v14-complete.js', code);
console.log('\n' + changes + ' changes applied.');
