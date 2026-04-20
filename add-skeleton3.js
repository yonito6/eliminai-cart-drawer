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
const innerDiv = "'<div class=\"ccd-inner\"";
const innerIdx = code.indexOf(innerDiv);
if (innerIdx === -1) {
  // Try alternate form
  const alt = "ccd-inner";
  const altIdx = code.indexOf("'<div class=\\\"ccd-inner\\\"");
  console.log('Alt search:', altIdx);
  // Search more broadly
  const lines = code.split('\n');
  for (let i = 500; i < 520; i++) {
    if (lines[i] && lines[i].includes('ccd-inner')) {
      console.log('Line', i+1, ':', lines[i].substring(0, 120));
    }
  }
  process.exit(1);
}
