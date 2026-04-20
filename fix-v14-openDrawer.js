const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/v14-complete.js';
let code = fs.readFileSync(path, 'utf8');

// The problem: openDrawer is missing its closing lines after "CCD._isOpen = true;"
// It should have: d.classList.add('ccd-open'), overlay, body overflow, refreshOnOpen, },
const oldBlock = `      CCD._isOpen = true;

    closeDrawer: function() {`;

const newBlock = `      CCD._isOpen = true;
      d.classList.add('ccd-open');
      d.style.display = 'flex';
      var ov = document.getElementById('CCD-Overlay');
      if (ov) ov.classList.add('ccd-overlay--visible');
      document.body.style.overflow = 'hidden';
      CCD.refreshOnOpen();
    },

    closeDrawer: function() {`;

if (code.includes(oldBlock)) {
  code = code.replace(oldBlock, newBlock);
  console.log('1. Restored openDrawer closing lines (classList, overlay, refresh)');
} else {
  console.log('WARNING: Could not find openDrawer broken block');
}

// Also enhance the debug overlay to show gift config info
const oldDebugInfo = "var _cartInfo = '';";
const newDebugInfo = `var _cartInfo = '';
    var _giftInfo = '';
    try {
      _giftInfo = '\\n=== GIFT CONFIG ===\\n';
      _giftInfo += 'GIFT_CUSTOMER_CHOICE: ' + (typeof GIFT_CUSTOMER_CHOICE !== 'undefined' ? GIFT_CUSTOMER_CHOICE : 'undefined') + '\\n';
      _giftInfo += 'GIFT_PICKER_TITLE: ' + (typeof GIFT_PICKER_TITLE !== 'undefined' ? GIFT_PICKER_TITLE : 'undefined') + '\\n';
      _giftInfo += '_giftPickerShown: ' + (typeof _giftPickerShown !== 'undefined' ? _giftPickerShown : 'undefined') + '\\n';
      if (typeof CFG !== 'undefined') {
        var _fsbDbg = (CFG.addons && CFG.addons.freeShippingBar && CFG.addons.freeShippingBar.config) || {};
        _giftInfo += 'tiers: ' + ((_fsbDbg.tiers || []).length) + '\\n';
        (_fsbDbg.tiers || []).forEach(function(t, i) {
          var gp = t.giftProducts || (t.giftProduct ? [t.giftProduct] : []);
          _giftInfo += '  tier ' + i + ' (goal=' + t.goal + '): ' + gp.length + ' gifts\\n';
          gp.forEach(function(g) { _giftInfo += '    ' + g.handle + ' vid=' + g.variantId + '\\n'; });
        });
        _giftInfo += 'giftMappings: ' + ((CFG.giftMappings || []).length) + '\\n';
        (CFG.giftMappings || []).forEach(function(m) { _giftInfo += '  ' + m.originalHandle + ' -> ' + m.duplicateHandle + ' vid=' + m.duplicateVariantId + '\\n'; });
      }
      _giftInfo += '================\\n';
    } catch(e) { _giftInfo = '\\n[gift config error: ' + e.message + ']\\n'; }`;

if (code.includes(oldDebugInfo)) {
  code = code.replace(oldDebugInfo, newDebugInfo);
  console.log('2. Enhanced debug overlay with gift config info');
} else {
  console.log('WARNING: Could not find debug info block');
}

// Also update the innerHTML to include _giftInfo
const oldInnerHtml = "_cartInfo + _ccdLogs.join('\\n')";
const newInnerHtml = "_giftInfo + _cartInfo + _ccdLogs.join('\\n')";
if (code.includes(oldInnerHtml)) {
  code = code.replace(oldInnerHtml, newInnerHtml);
  console.log('3. Debug overlay now shows gift info');
} else {
  console.log('WARNING: Could not find innerHTML pattern');
}

fs.writeFileSync(path, code);
console.log('\nFile saved. Size: ' + (code.length / 1024).toFixed(1) + ' KB');
