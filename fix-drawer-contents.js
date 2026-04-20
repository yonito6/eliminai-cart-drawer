const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');

// The theme takeover path creates class "ccd-drawer-contents" not "ccd-contents"
// Need to add CSS for BOTH class names
// Current rule: #CCD-Drawer .ccd-contents { display: flex ... }
// Need to also target: #CCD-Drawer .ccd-drawer-contents

const oldRule = "#CCD-Drawer .ccd-contents { display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; background: #fff !important; overflow: hidden !important; }";
const newRule = "#CCD-Drawer .ccd-contents, #CCD-Drawer .ccd-drawer-contents { display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; background: #fff !important; overflow: hidden !important; }";

if (c.includes(oldRule)) {
  c = c.replace(oldRule, newRule);
  console.log('OK: Added .ccd-drawer-contents to flex layout rule');
} else {
  console.log('FAIL: ccd-contents rule not found');
  // Debug
  const idx = c.indexOf('.ccd-contents');
  if (idx > -1) {
    console.log('Found at', idx, ':', c.substring(idx - 30, idx + 200));
  }
  process.exit(1);
}

fs.writeFileSync('v14-complete.js', c);
console.log('File saved');
