const fs = require('fs');

// 1. Update protection-editor.tsx — selected icon shows chosen color
const editorPath = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/protection-editor.tsx';
let editor = fs.readFileSync(editorPath, 'utf8');

// Change the selected icon color from PURPLE to iconColor
editor = editor.replace(
  `color: iconId === icon.id && !customIconUrl ? PURPLE : GRAY_SEC,`,
  `color: iconId === icon.id && !customIconUrl ? iconColor : GRAY_SEC,`
);

// Also update the border of selected icon to use iconColor
editor = editor.replace(
  `border: \`2px solid \${iconId === icon.id && !customIconUrl ? PURPLE : '#e5e7eb'}\`,`,
  `border: \`2px solid \${iconId === icon.id && !customIconUrl ? iconColor : '#e5e7eb'}\`,`
);

// And the selected background tint
editor = editor.replace(
  `background: iconId === icon.id && !customIconUrl ? \`\${PURPLE}10\` : '#fff',`,
  `background: iconId === icon.id && !customIconUrl ? \`\${iconColor}15\` : '#fff',`
);

fs.writeFileSync(editorPath, editor);
console.log('✓ Editor: selected icon now uses chosen color');

// 2. Update addon-preview.tsx — apply iconColor to the icon in preview
const previewPath = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/addon-preview.tsx';
let preview = fs.readFileSync(previewPath, 'utf8');

// Add icon color style to the protection icon container
preview = preview.replace(
  `    cartHtml = cartHtml.replace(
      /(<div class="ccd-shipping-protection__icon">)[\\s\\S]*?(<\\/div>\\s*<div class="ccd-shipping-protection__info">)/,
      '$1' + iconSvg + '$2'
    );`,
  `    // Apply icon color
    const iconColor = addonConfig.iconColor || '#8b5cf6';
    const coloredIconSvg = iconSvg.replace(/<(svg|img)/, \`<$1 style="color:\${iconColor}"\`);
    cartHtml = cartHtml.replace(
      /(<div class="ccd-shipping-protection__icon">)[\\s\\S]*?(<\\/div>\\s*<div class="ccd-shipping-protection__info">)/,
      '$1' + coloredIconSvg + '$2'
    );`
);

fs.writeFileSync(previewPath, preview);
console.log('✓ Preview: icon now uses chosen color');

// Verify
const e2 = fs.readFileSync(editorPath, 'utf8');
const p2 = fs.readFileSync(previewPath, 'utf8');
console.log('Editor has iconColor in icon style:', e2.includes('color: iconId === icon.id && !customIconUrl ? iconColor'));
console.log('Preview has iconColor:', p2.includes('addonConfig.iconColor'));
