const fs = require('fs');
let c = fs.readFileSync('v14-complete.js', 'utf8');

// 1. Add display:flex to #CCD-Drawer base rule (so ccd-contents flex:1 works)
const oldDrawer = '#CCD-Drawer { position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important; background: var(--ccd-bg, #fff) !important; color: #111 !important; max-width: 380px !important; width: 100% !important; z-index: 9999 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; height: 100vh !important; height: 100dvh !important; max-height: 100vh !important; max-height: 100dvh !important; transform: translateX(100%) !important; transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1) !important; will-change: transform !important; overflow: hidden !important; }';
const newDrawer = '#CCD-Drawer { position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important; background: var(--ccd-bg, #fff) !important; color: #111 !important; max-width: 380px !important; width: 100% !important; z-index: 9999 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; height: 100vh !important; height: 100dvh !important; max-height: 100vh !important; max-height: 100dvh !important; transform: translateX(100%) !important; transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1) !important; will-change: transform !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; }';

if (c.includes(oldDrawer)) {
  c = c.replace(oldDrawer, newDrawer);
  console.log('OK: #CCD-Drawer base now has display:flex + flex-direction:column');
} else {
  console.log('FAIL: #CCD-Drawer base CSS not found');
  process.exit(1);
}

// 2. Remove the inline style on drawer element that might override
// Change: drawer.style.cssText = 'position:fixed;top:0;right:0;';
// To just empty (CSS handles everything)
const oldInline = "drawer.style.cssText = 'position:fixed;top:0;right:0;';";
const newInline = "drawer.style.cssText = '';";

if (c.includes(oldInline)) {
  c = c.replace(oldInline, newInline);
  console.log('OK: Removed inline styles (CSS handles positioning)');
} else {
  console.log('WARN: inline style not found');
}

fs.writeFileSync('v14-complete.js', c);
console.log('File saved');
