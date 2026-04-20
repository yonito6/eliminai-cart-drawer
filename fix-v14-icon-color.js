const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/v14-complete.js';
let code = fs.readFileSync(path, 'utf8');

// 1. Change hardcoded fill:#555 to use CSS variable with fallback
code = code.replace(
  "'.ccd-shipping-protection__icon svg { width: 24px !important; height: 24px !important; fill: #555 !important; }\\n'",
  "'.ccd-shipping-protection__icon svg { width: 24px !important; height: 24px !important; fill: var(--ccd-prot-color, #555) !important; }\\n'"
);

// 2. Add PROT_COLOR variable after PROT_ENABLED
code = code.replace(
  "var PROT_ENABLED = _sp.enabled === true || (CFG.protectionEnabled === true);",
  "var PROT_ENABLED = _sp.enabled === true || (CFG.protectionEnabled === true);\n  var PROT_COLOR = _spCfg.iconColor || '#555';"
);

// 3. Apply the color as inline style on the icon container in the HTML template
// Find the protection icon HTML and add style with the CSS variable
code = code.replace(
  `'<div class="ccd-shipping-protection__icon">' + (_spCfg.iconUrl ? '<img src="' + _spCfg.iconUrl + '" style="width:20px;height:20px" alt="" />' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>') + '</div>'`,
  `'<div class="ccd-shipping-protection__icon" style="--ccd-prot-color:' + PROT_COLOR + '">' + (_spCfg.iconUrl ? '<img src="' + _spCfg.iconUrl + '" style="width:20px;height:20px" alt="" />' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>') + '</div>'`
);

fs.writeFileSync(path, code);
console.log('✓ v14-complete.js: icon color now reads from config');

// Verify
const updated = fs.readFileSync(path, 'utf8');
console.log('Has PROT_COLOR var:', updated.includes('var PROT_COLOR'));
console.log('Has CSS var:', updated.includes('var(--ccd-prot-color'));
console.log('Sets CSS var on icon:', updated.includes('--ccd-prot-color:'));
