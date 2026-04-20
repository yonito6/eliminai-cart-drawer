const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/addon-preview.tsx';
let code = fs.readFileSync(path, 'utf8');

// Fix: use both color AND fill on the SVG, and wrap in a colored div for img icons
code = code.replace(
  `    // Apply icon color
    const iconColor = addonConfig.iconColor || '#555555';
    const coloredIconSvg = iconSvg.replace(/<(svg|img)/, \`<$1 style="color:\${iconColor}"\`);`,
  `    // Apply icon color — set color+fill on SVG so fill:currentColor works
    const iconColor = addonConfig.iconColor || '#555555';
    const coloredIconSvg = iconSvg.includes('<svg')
      ? iconSvg.replace(/<svg/, \`<svg style="color:\${iconColor};fill:\${iconColor}"\`)
      : iconSvg; // img icons don't need color`
);

fs.writeFileSync(path, code);
console.log('✓ Preview: icon color now uses fill directly on SVG');
