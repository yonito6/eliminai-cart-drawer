const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/protection-editor.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Change default iconColor from #8b5cf6 to #555 (matches v14-complete.js fallback)
code = code.replace(
  "const [iconColor, setIconColor] = useState(config.iconColor ?? '#8b5cf6');",
  "const [iconColor, setIconColor] = useState(config.iconColor ?? '#555555');"
);

// 2. Update preset color palette — add #555555 as first, remove duplicate
code = code.replace(
  "['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#000000']",
  "['#555555', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#000000']"
);

// 3. Update placeholder to match
code = code.replace(
  'placeholder="#8b5cf6"',
  'placeholder="#555555"'
);

// 4. Also update addon-preview default to match
const previewPath = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/addon-preview.tsx';
let preview = fs.readFileSync(previewPath, 'utf8');
preview = preview.replace(
  "const iconColor = addonConfig.iconColor || '#8b5cf6';",
  "const iconColor = addonConfig.iconColor || '#555555';"
);
fs.writeFileSync(previewPath, preview);

fs.writeFileSync(path, code);

console.log('✓ Default icon color changed to #555555');
console.log('✓ Preset palette updated with #555555 first');

// Verify
const u = fs.readFileSync(path, 'utf8');
console.log('Default:', u.includes("config.iconColor ?? '#555555'"));
console.log('Presets:', u.includes("'#555555', '#8b5cf6'"));
