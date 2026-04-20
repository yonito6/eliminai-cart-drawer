const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');
let changes = 0;

// 1. Make desktop width configurable via CSS variable with larger default (480px)
const oldDesktopWidth = "@media (min-width: 769px) { #CCD-Drawer { max-width: 520px !important; } }";
const newDesktopWidth = "@media (min-width: 769px) { #CCD-Drawer { max-width: var(--ccd-desktop-width, 480px) !important; } }";
if (code.includes(oldDesktopWidth)) {
  code = code.replace(oldDesktopWidth, newDesktopWidth);
  changes++;
  console.log('1. Desktop width now configurable via --ccd-desktop-width (default 480px)');
}

// 2. Apply desktop width from config
// Find where config is applied to look for existing width setting
const configApplyMarker = "if (config.cartConfig.mobileWidth)";
if (code.includes(configApplyMarker)) {
  // Add desktop width config right after mobile width
  code = code.replace(
    "if (config.cartConfig.mobileWidth)",
    "if (config.cartConfig.desktopWidth) { document.getElementById('CCD-Drawer').style.setProperty('--ccd-desktop-width', config.cartConfig.desktopWidth + 'px'); }\n        if (config.cartConfig.mobileWidth)"
  );
  changes++;
  console.log('2. Added desktopWidth config application');
} else {
  // Try to find where CFG properties are applied
  console.log('2. SKIP desktopWidth config - looking for alternative...');
}

fs.writeFileSync(file, code);
console.log('\n' + changes + ' changes. File size:', code.length);
