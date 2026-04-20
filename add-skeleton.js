const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Add skeleton CSS — append to the CSS string before overlay CSS
const skeletonCSS = [
  '@keyframes ccdShimmer { 0% { background-position: -200px 0; } 100% { background-position: calc(200px + 100%) 0; } }',
  '.ccd-loading-skeleton { display: block; padding-top: 12px; }',
  '.ccd-skeleton { display: flex; gap: 12px; padding: 12px 16px; }',
  '.ccd-skeleton__img { width: 64px; height: 64px; border-radius: 8px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; flex-shrink: 0; }',
  '.ccd-skeleton__lines { flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; }',
  '.ccd-skeleton__line { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; }',
  '.ccd-skeleton__line--short { width: 60%; }',
  '.ccd-skeleton__line--medium { width: 80%; }',
  '.ccd-skeleton__footer { padding: 12px 16px; }',
  '.ccd-skeleton__btn { height: 48px; border-radius: 8px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; }',
  '.ccd-skeleton__progress { height: 32px; margin: 0 16px 8px; border-radius: 6px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200px 100%; animation: ccdShimmer 1.2s ease-in-out infinite; }'
].join('\n');

// Insert skeleton CSS before the overlay CSS line
const overlayCSS = "'.ccd-overlay { position: fixed";
const overlayIdx = code.indexOf(overlayCSS);
if (overlayIdx === -1) { console.log('ERROR: overlay CSS not found'); process.exit(1); }

// Find the start of that line (go back to the previous newline + whitespace)
let lineStart = overlayIdx;
while (lineStart > 0 && code[lineStart-1] !== '\n') lineStart--;

// Insert skeleton CSS lines before overlay
const cssLines = skeletonCSS.split('\n').map(line => "      '" + line + "\n' +").join('\n');
code = code.substring(0, lineStart) + cssLines + '\n' + code.substring(lineStart);

// 2. Add skeleton HTML inside the drawer shell — before <div class="ccd-inner">
const innerDiv = '<div class=\\"ccd-inner\\">';
const innerIdx = code.indexOf(innerDiv);
if (innerIdx === -1) { console.log('ERROR: ccd-inner not found'); process.exit(1); }

const skeletonHTML = '<div class=\\"ccd-loading-skeleton\\" data-ccd-skeleton>' +
  '<div class=\\"ccd-skeleton__progress\\"></div>' +
  '<div class=\\"ccd-skeleton\\"><div class=\\"ccd-skeleton__img\\"></div><div class=\\"ccd-skeleton__lines\\"><div class=\\"ccd-skeleton__line\\"></div><div class=\\"ccd-skeleton__line ccd-skeleton__line--medium\\"></div><div class=\\"ccd-skeleton__line ccd-skeleton__line--short\\"></div></div></div>' +
  '<div class=\\"ccd-skeleton\\"><div class=\\"ccd-skeleton__img\\"></div><div class=\\"ccd-skeleton__lines\\"><div class=\\"ccd-skeleton__line\\"></div><div class=\\"ccd-skeleton__line ccd-skeleton__line--short\\"></div></div></div>' +
  '<div class=\\"ccd-skeleton__footer\\"><div class=\\"ccd-skeleton__btn\\"></div></div>' +
  '</div>';

code = code.substring(0, innerIdx) + skeletonHTML + code.substring(innerIdx);

// 3. Show skeleton on drawer open when content hasn't loaded yet
// In openDrawer, after the drawer is shown, show skeleton if items not loaded
const firstOpenMarker = '_lastRealCount === -1';
const firstOpenIdx = code.indexOf(firstOpenMarker);
if (firstOpenIdx === -1) { console.log('ERROR: _lastRealCount check not found'); process.exit(1); }

// Find the line after this check where we can add skeleton show
const afterFirstOpen = code.indexOf('\n', firstOpenIdx);
// Insert skeleton show after the line
const skeletonShowCode = '\n        var _sk = document.querySelector("[data-ccd-skeleton]"); if (_sk) _sk.style.display = "block";';
code = code.substring(0, afterFirstOpen) + skeletonShowCode + code.substring(afterFirstOpen);

// 4. Hide skeleton in _doRefresh when real content renders
const doRefreshMarker = 'function _doRefresh(';
const doRefreshIdx = code.indexOf(doRefreshMarker);
if (doRefreshIdx === -1) { console.log('ERROR: _doRefresh not found'); process.exit(1); }

// Find the opening { of the function
const doRefreshBrace = code.indexOf('{', doRefreshIdx);
const afterBrace = code.indexOf('\n', doRefreshBrace);
const skeletonHideCode = '\n      var _skeleton = document.querySelector("[data-ccd-skeleton]"); if (_skeleton) _skeleton.style.display = "none";';
code = code.substring(0, afterBrace) + skeletonHideCode + code.substring(afterBrace);

// 5. Also show skeleton on EVERY open when cart needs to fetch (not just first)
// In refreshOnOpen, show skeleton before starting network requests
const refreshOnOpenMarker = 'function refreshOnOpen()';
const refreshOnOpenIdx = code.indexOf(refreshOnOpenMarker);
if (refreshOnOpenIdx !== -1) {
  const rooBrace = code.indexOf('{', refreshOnOpenIdx);
  const afterRooBrace = code.indexOf('\n', rooBrace);
  const skeletonOnRefresh = '\n      var _skOnOpen = document.querySelector("[data-ccd-skeleton]"); if (_skOnOpen && !document.querySelector(".ccd-item")) _skOnOpen.style.display = "block";';
  code = code.substring(0, afterRooBrace) + skeletonOnRefresh + code.substring(afterRooBrace);
  console.log('Added skeleton show in refreshOnOpen');
}

fs.writeFileSync('v14-complete.js', code);
console.log('All skeleton changes applied!');
