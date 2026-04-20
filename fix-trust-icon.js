const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');

// Old SVG (stroke-based return arrow with polyline)
const oldSvg = `<svg class="ccd-trust__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;

// New SVG (filled return arrow matching the preview in cart-constants.ts)
const newSvg = `<svg class="ccd-trust__icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"></path></svg>`;

if (c.includes(oldSvg)) {
  c = c.replace(oldSvg, newSvg);
  console.log('OK: Trust icon SVG replaced (stroke → filled, matches preview)');
} else {
  console.log('FAIL: Old trust icon SVG not found');
  // Debug
  const idx = c.indexOf('ccd-trust__icon');
  console.log('ccd-trust__icon at:', idx);
  console.log(c.substring(idx-10, idx+300));
  process.exit(1);
}

// Also update the CSS for the trust icon to work with fill instead of stroke
const oldIconCss = ".ccd-trust__icon { width: 16px !important; height: 16px !important; flex-shrink: 0 !important; }";
const newIconCss = ".ccd-trust__icon { width: 16px !important; height: 16px !important; flex-shrink: 0 !important; fill: #555 !important; }";

if (c.includes(oldIconCss)) {
  c = c.replace(oldIconCss, newIconCss);
  console.log('OK: Trust icon CSS updated (added fill:#555)');
} else {
  console.log('INFO: Trust icon CSS not found or already has fill');
}

fs.writeFileSync('v14-complete.js', c);
console.log('File saved');
