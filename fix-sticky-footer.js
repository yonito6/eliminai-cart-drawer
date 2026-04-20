const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Fix #CCD-Drawer.ccd-open — make it flex column properly
const oldOpen = '#CCD-Drawer.ccd-open { display: flex !important; flex-direction: column !important; transform: translateX(0) !important; box-shadow: -12px 0 45px rgba(0,0,0,0.25) !important; }';
const newOpen = '#CCD-Drawer.ccd-open { display: flex !important; flex-direction: column !important; transform: translateX(0) !important; box-shadow: -12px 0 45px rgba(0,0,0,0.25) !important; }';
// Actually this is fine. The issue is ccd-contents needs flex:1 min-height:0

// 2. Fix .ccd-contents — needs flex:1 and min-height:0 so it fills the drawer but doesn't overflow
const oldContents = '#CCD-Drawer .ccd-contents { display: flex !important; flex-direction: column !important; height: 100% !important; background: #fff !important; overflow: hidden !important; }';
const newContents = '#CCD-Drawer .ccd-contents { display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; background: #fff !important; overflow: hidden !important; }';

if (c.includes(oldContents)) {
  c = c.replace(oldContents, newContents);
  console.log('OK: ccd-contents fixed (height:100% -> flex:1, added min-height:0)');
} else {
  console.log('FAIL: ccd-contents CSS not found');
  // Debug
  const idx = c.indexOf('ccd-contents');
  if (idx > -1) {
    const start = c.lastIndexOf('{', idx);
    const end = c.indexOf('}', idx);
    console.log('Found:', c.substring(Math.max(0, idx - 50), end + 1));
  }
  process.exit(1);
}

// 3. Add overflow scroll shadow (the grey "pinch" indicator when content is scrollable)
// This is the ::after gradient on ccd-inner that indicates scrollable content below
const oldInnerAfter = '#CCD-Drawer .ccd-inner::after { content: "" !important; position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important; height: 50px !important; background: linear-gradient(to top, var(--ccd-bg, #fff), transparent) !important; pointer-events: none !important; z-index: 1 !important; }';
const newInnerAfter = '#CCD-Drawer .ccd-inner::after { content: "" !important; position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important; height: 30px !important; background: linear-gradient(to top, rgba(0,0,0,0.06), transparent) !important; pointer-events: none !important; z-index: 1 !important; transition: opacity 0.2s !important; }';

if (c.includes(oldInnerAfter)) {
  c = c.replace(oldInnerAfter, newInnerAfter);
  console.log('OK: scroll shadow updated (grey gradient instead of white fade)');
} else {
  console.log('WARN: ccd-inner::after not found exactly, searching...');
  const idx = c.indexOf('ccd-inner::after');
  if (idx > -1) {
    const ruleStart = c.lastIndexOf("'", idx);
    const ruleEnd = c.indexOf("\\n", idx);
    console.log('Found rule:', c.substring(ruleStart, ruleEnd + 2));
  }
}

fs.writeFileSync('v14-complete.js', c);
console.log('File saved');
