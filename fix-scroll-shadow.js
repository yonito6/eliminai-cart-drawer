const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');

// Fix the scroll shadow — change from white fade to grey "pinch" shadow
const oldShadow = '#CCD-Drawer .ccd-inner::after { content: "" !important; position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important; height: 50px !important; background: linear-gradient(transparent 0%, rgba(255,255,255,0.6) 35%, rgba(255,255,255,0.95) 100%) !important; pointer-events: none !important; z-index: 3 !important; transition: opacity 0.3s !important; }';
const newShadow = '#CCD-Drawer .ccd-inner::after { content: "" !important; position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important; height: 24px !important; background: linear-gradient(to top, rgba(0,0,0,0.08), transparent) !important; pointer-events: none !important; z-index: 3 !important; transition: opacity 0.3s !important; }';

if (c.includes(oldShadow)) {
  c = c.replace(oldShadow, newShadow);
  console.log('OK: scroll shadow updated (grey pinch gradient)');
} else {
  console.log('FAIL: scroll shadow not found');
  process.exit(1);
}

fs.writeFileSync('v14-complete.js', c);
console.log('File saved');
