const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Add skeleton CSS before overlay CSS
const overlayCSS = "'.ccd-overlay { position: fixed";
const overlayIdx = code.indexOf(overlayCSS);
if (overlayIdx === -1) { console.log('ERROR: overlay CSS not found'); process.exit(1); }

let lineStart = overlayIdx;
while (lineStart > 0 && code[lineStart-1] !== '\n') lineStart--;

const cssEntries = [
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
  '.ccd-skeleton__progress{height:32px;margin:0 16px 8px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200px 100%;animation:ccdShimmer 1.2s ease-in-out infinite}'
];
const cssBlock = cssEntries.map(e => "      '" + e + "\n' +").join('\n') + '\n';
code = code.substring(0, lineStart) + cssBlock + code.substring(lineStart);
console.log('1. CSS added');

// 2. Add skeleton HTML before ccd-inner div
const innerDiv = '<div class="ccd-inner" data-ccd-inner';
const innerIdx = code.indexOf(innerDiv);
if (innerIdx === -1) { console.log('ERROR: ccd-inner not found'); process.exit(1); }

const skeletonHTML = 
  '<div class="ccd-loading-skeleton" data-ccd-skeleton style="display:none">' +
  '<div class="ccd-skeleton__progress"></div>' +
  '<div class="ccd-skeleton"><div class="ccd-skeleton__img"></div><div class="ccd-skeleton__lines"><div class="ccd-skeleton__line"></div><div class="ccd-skeleton__line ccd-skeleton__line--medium"></div><div class="ccd-skeleton__line ccd-skeleton__line--short"></div></div></div>' +
  '<div class="ccd-skeleton"><div class="ccd-skeleton__img"></div><div class="ccd-skeleton__lines"><div class="ccd-skeleton__line"></div><div class="ccd-skeleton__line ccd-skeleton__line--short"></div></div></div>' +
  '<div class="ccd-skeleton__footer"><div class="ccd-skeleton__btn"></div></div>' +
  '</div>';

code = code.substring(0, innerIdx) + skeletonHTML + code.substring(innerIdx);
console.log('2. Skeleton HTML added');

// 3. Show skeleton on openDrawer when items haven't loaded
const firstOpenMarker = '_lastRealCount === -1';
const firstOpenIdx = code.indexOf(firstOpenMarker);
if (firstOpenIdx === -1) { console.log('ERROR: _lastRealCount not found'); process.exit(1); }

const afterFirstOpen = code.indexOf('\n', firstOpenIdx);
const skeletonShowCode = '\n        var _sk = document.querySelector("[data-ccd-skeleton]"); if (_sk) _sk.style.display = "block";';
code = code.substring(0, afterFirstOpen) + skeletonShowCode + code.substring(afterFirstOpen);
console.log('3. Skeleton show on first open added');

// 4. Hide skeleton in _doRefresh
const doRefreshMarker = 'function _doRefresh(';
const doRefreshIdx = code.indexOf(doRefreshMarker);
if (doRefreshIdx === -1) { console.log('ERROR: _doRefresh not found'); process.exit(1); }

const doRefreshBrace = code.indexOf('{', doRefreshIdx);
const afterBrace = code.indexOf('\n', doRefreshBrace);
const skeletonHideCode = '\n      var _skeleton = document.querySelector("[data-ccd-skeleton]"); if (_skeleton) _skeleton.style.display = "none";';
code = code.substring(0, afterBrace) + skeletonHideCode + code.substring(afterBrace);
console.log('4. Skeleton hide on refresh added');

// 5. Show skeleton in refreshOnOpen when no items rendered yet
const refreshOnOpenMarker = 'function refreshOnOpen()';
const refreshOnOpenIdx = code.indexOf(refreshOnOpenMarker);
if (refreshOnOpenIdx !== -1) {
  const rooBrace = code.indexOf('{', refreshOnOpenIdx);
  const afterRooBrace = code.indexOf('\n', rooBrace);
  const skeletonOnRefresh = '\n      var _skR = document.querySelector("[data-ccd-skeleton]"); if (_skR && !document.querySelector(".ccd-item")) _skR.style.display = "block";';
  code = code.substring(0, afterRooBrace) + skeletonOnRefresh + code.substring(afterRooBrace);
  console.log('5. Skeleton show in refreshOnOpen added');
}

fs.writeFileSync('v14-complete.js', code);
console.log('Done!');
