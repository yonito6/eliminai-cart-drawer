const fs = require('fs');

const path = 'C:/Projects/eliminai-cart-drawer/v14-complete.js';
let code = fs.readFileSync(path, 'utf8');

// ═══ STEP 1: Add config vars for gift customer choice ═══
const afterFreePriceColor = "  var FREE_PRICE_COLOR = _fsb.freePriceColor || CFG.freePriceColor || '#111';";
const newConfigVars = afterFreePriceColor + '\n' +
  "  var GIFT_CUSTOMER_CHOICE = !!(_fsb.giftCustomerChoice || CFG.giftCustomerChoice);\n" +
  "  var GIFT_PICKER_TITLE = _fsb.giftPickerTitle || CFG.giftPickerTitle || 'Choose your free gift';";

if (code.includes(afterFreePriceColor)) {
  code = code.replace(afterFreePriceColor, newConfigVars);
  console.log('1. Config vars added');
} else {
  console.log('ERROR: Could not find FREE_PRICE_COLOR line');
  process.exit(1);
}

// ═══ STEP 2: Add CSS for gift picker ═══
const pickerCSS = "      '.ccd-gift-picker { border-top: 1px dashed #ddd !important; margin-top: 8px !important; padding: 12px 0 !important; }\\n' +\n" +
  "      '.ccd-gift-picker__title { font-size: 13px !important; font-weight: 600 !important; color: #1a7a1a !important; margin-bottom: 10px !important; display: flex !important; align-items: center !important; gap: 6px !important; }\\n' +\n" +
  "      '.ccd-gift-picker__title svg { width: 16px !important; height: 16px !important; fill: #1a7a1a !important; }\\n' +\n" +
  "      '.ccd-gift-picker__options { display: flex !important; flex-direction: column !important; gap: 6px !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt { display: flex !important; align-items: center !important; gap: 10px !important; padding: 8px 10px !important; border-radius: 10px !important; border: 2px solid #e5e7eb !important; background: #fff !important; cursor: pointer !important; transition: all 0.15s !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt:hover { border-color: #c4b5fd !important; background: #faf5ff !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt--selected { border-color: #7c3aed !important; background: #f5f3ff !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt img { width: 50px !important; height: 50px !important; border-radius: 6px !important; object-fit: cover !important; flex-shrink: 0 !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt-info { flex: 1 !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt-title { font-size: 12px !important; font-weight: 500 !important; color: #111 !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt-price { font-size: 11px !important; color: #6b7280 !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt-price span { text-decoration: line-through !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt-check { width: 20px !important; height: 20px !important; border-radius: 50% !important; border: 2px solid #d1d5db !important; flex-shrink: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.15s !important; }\\n' +\n" +
  "      '.ccd-gift-picker__opt--selected .ccd-gift-picker__opt-check { border-color: #7c3aed !important; background: #7c3aed !important; }\\n' +\n";

// Insert picker CSS before the gift badge CSS
const giftBadgeCSS = "      '.ccd-gift-badge {";
if (code.includes(giftBadgeCSS)) {
  code = code.replace(giftBadgeCSS, pickerCSS + giftBadgeCSS);
  console.log('2. Picker CSS added');
} else {
  console.log('ERROR: Could not find gift badge CSS');
}

// ═══ STEP 3: Add picker state variable ═══
const afterWatchCaseBusy = "  var watchCaseBusy = false;";
code = code.replace(afterWatchCaseBusy, afterWatchCaseBusy + '\n  var _giftPickerShown = false;');
console.log('3. Picker state var added');

// ═══ STEP 4: Modify checkWatchCase to support customer choice ═══
// In the "ADD gifts" section, when GIFT_CUSTOMER_CHOICE is true, show picker instead of auto-adding

const oldAddSection = "      // ADD gifts that should be in cart but aren't\n" +
  "      var toAdd = [];\n" +
  "      Object.keys(shouldHave).forEach(function(h) {\n" +
  "        if (!giftInCart[h] && !caseDismissed) {\n" +
  "          if ((_giftAddFails[h] || 0) >= 3) {\n" +
  "            console.warn('[CCD GIFT] Skipping ' + h + ' — failed ' + _giftAddFails[h] + ' times');\n" +
  "            return;\n" +
  "          }\n" +
  "          toAdd.push({ id: shouldHave[h], quantity: 1, properties: { _eliminai_gift: 'true' } });\n" +
  "        }\n" +
  "      });";

const newAddSection = "      // ADD gifts that should be in cart but aren't\n" +
  "      var toAdd = [];\n" +
  "      var eligibleForPicker = []; // gifts the customer can choose from\n" +
  "      Object.keys(shouldHave).forEach(function(h) {\n" +
  "        if (!giftInCart[h] && !caseDismissed) {\n" +
  "          if ((_giftAddFails[h] || 0) >= 3) {\n" +
  "            console.warn('[CCD GIFT] Skipping ' + h + ' — failed ' + _giftAddFails[h] + ' times');\n" +
  "            return;\n" +
  "          }\n" +
  "          if (GIFT_CUSTOMER_CHOICE && Object.keys(shouldHave).length > 1) {\n" +
  "            // Customer choice mode with 2+ options — collect for picker\n" +
  "            eligibleForPicker.push({ handle: h, variantId: shouldHave[h] });\n" +
  "          } else {\n" +
  "            // Auto-add mode or only 1 gift — add directly\n" +
  "            toAdd.push({ id: shouldHave[h], quantity: 1, properties: { _eliminai_gift: 'true' } });\n" +
  "          }\n" +
  "        }\n" +
  "      });\n" +
  "\n" +
  "      // Show gift picker if customer choice mode and eligible gifts available\n" +
  "      if (eligibleForPicker.length > 0 && !_giftPickerShown) {\n" +
  "        CCD._showGiftPicker(eligibleForPicker, shouldHave);\n" +
  "        _giftPickerShown = true;\n" +
  "      } else if (eligibleForPicker.length === 0) {\n" +
  "        CCD._hideGiftPicker();\n" +
  "        _giftPickerShown = false;\n" +
  "      }";

if (code.includes(oldAddSection)) {
  code = code.replace(oldAddSection, newAddSection);
  console.log('4. checkWatchCase modified for customer choice');
} else {
  console.log('ERROR: Could not find old ADD section');
  // Debug: check if partial match exists
  if (code.includes('// ADD gifts that should be in cart')) {
    console.log('  Found partial match — whitespace issue');
  }
}

// ═══ STEP 5: Add _showGiftPicker and _hideGiftPicker methods ═══
// Add before the checkWatchCase method

const beforeCheckWatch = "    checkWatchCase: function(cart) {";
const pickerMethods = "    _showGiftPicker: function(options, shouldHave) {\n" +
  "      var container = document.querySelector('#CCD-Drawer .ccd-items');\n" +
  "      if (!container) return;\n" +
  "      var existing = container.querySelector('.ccd-gift-picker');\n" +
  "      if (existing) return; // already showing\n" +
  "\n" +
  "      // Find gift info from tiers for images/titles\n" +
  "      var giftInfo = {};\n" +
  "      GIFT_TIERS.forEach(function(t) {\n" +
  "        tierGifts(t).forEach(function(g) { giftInfo[g.handle] = g; });\n" +
  "      });\n" +
  "      // Also check giftMappings for image URLs\n" +
  "      var mappings = CFG.giftMappings || [];\n" +
  "\n" +
  "      var html = '<div class=\"ccd-gift-picker\">' +\n" +
  "        '<div class=\"ccd-gift-picker__title\">' +\n" +
  "        '<svg viewBox=\"0 0 24 24\"><path d=\"M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z\"/></svg>' +\n" +
  "        GIFT_PICKER_TITLE +\n" +
  "        '</div>' +\n" +
  "        '<div class=\"ccd-gift-picker__options\">';\n" +
  "\n" +
  "      options.forEach(function(opt) {\n" +
  "        var info = giftInfo[opt.handle] || {};\n" +
  "        var title = info.title || opt.handle;\n" +
  "        var imgUrl = info.imageUrl || '';\n" +
  "        var price = info.price || '';\n" +
  "        var imgHtml = imgUrl ? '<img src=\"' + imgUrl + '\" alt=\"\" />' : '';\n" +
  "        var priceHtml = price ? '<div class=\"ccd-gift-picker__opt-price\"><span>$' + price + '</span> ' + FREE_PRICE_LABEL + '</div>' : '<div class=\"ccd-gift-picker__opt-price\">' + FREE_PRICE_LABEL + '</div>';\n" +
  "        html += '<div class=\"ccd-gift-picker__opt\" data-handle=\"' + opt.handle + '\" data-vid=\"' + opt.variantId + '\">' +\n" +
  "          imgHtml +\n" +
  "          '<div class=\"ccd-gift-picker__opt-info\">' +\n" +
  "          '<div class=\"ccd-gift-picker__opt-title\">' + title + '</div>' +\n" +
  "          priceHtml +\n" +
  "          '</div>' +\n" +
  "          '<div class=\"ccd-gift-picker__opt-check\"><svg viewBox=\"0 0 12 12\" fill=\"none\" style=\"width:12px;height:12px\"><path d=\"M2 6l3 3 5-5\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></div>' +\n" +
  "          '</div>';\n" +
  "      });\n" +
  "\n" +
  "      html += '</div></div>';\n" +
  "      container.insertAdjacentHTML('beforeend', html);\n" +
  "\n" +
  "      // Click handler for picking a gift\n" +
  "      container.querySelector('.ccd-gift-picker').addEventListener('click', function(e) {\n" +
  "        var opt = e.target.closest('.ccd-gift-picker__opt');\n" +
  "        if (!opt) return;\n" +
  "        var vid = opt.dataset.vid;\n" +
  "        var handle = opt.dataset.handle;\n" +
  "        if (!vid) return;\n" +
  "\n" +
  "        // Visual feedback — select this option\n" +
  "        container.querySelectorAll('.ccd-gift-picker__opt').forEach(function(o) { o.classList.remove('ccd-gift-picker__opt--selected'); });\n" +
  "        opt.classList.add('ccd-gift-picker__opt--selected');\n" +
  "\n" +
  "        // Add selected gift to cart\n" +
  "        watchCaseBusy = true;\n" +
  "        if (CCD._isOpen) CCD.showLoading();\n" +
  "        var body = 'id=' + vid + '&quantity=1&properties%5B_eliminai_gift%5D=true';\n" +
  "        var _oF = CCD._origFetch || fetch;\n" +
  "        _oF('/cart/add.js', {\n" +
  "          method: 'POST',\n" +
  "          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },\n" +
  "          body: body\n" +
  "        }).then(function(r) { return r.json(); })\n" +
  "        .then(function() {\n" +
  "          // Remove picker, refresh cart\n" +
  "          _giftPickerShown = false;\n" +
  "          return _oF('/cart.js').then(function(r) { return r.json(); });\n" +
  "        })\n" +
  "        .then(function(cart) {\n" +
  "          watchCaseBusy = false;\n" +
  "          CCD.refresh(cart);\n" +
  "        })\n" +
  "        .catch(function() { watchCaseBusy = false; });\n" +
  "      });\n" +
  "    },\n" +
  "\n" +
  "    _hideGiftPicker: function() {\n" +
  "      var picker = document.querySelector('#CCD-Drawer .ccd-gift-picker');\n" +
  "      if (picker) picker.remove();\n" +
  "    },\n" +
  "\n";

if (code.includes(beforeCheckWatch)) {
  code = code.replace(beforeCheckWatch, pickerMethods + '    ' + beforeCheckWatch);
  console.log('5. Picker methods added');
} else {
  console.log('ERROR: Could not find checkWatchCase');
}

// ═══ STEP 6: Reset picker state when gifts are removed or cart changes ═══
// When all gifts are removed from cart, reset _giftPickerShown
const resetDismiss = "      // Reset dismiss when no gifts should be present\n" +
  "      if (Object.keys(shouldHave).length === 0 && !Object.keys(giftInCart).length) {\n" +
  "        caseDismissed = false;\n" +
  "        try { sessionStorage.removeItem('ccd_case_dismissed'); } catch(e) {}";

const resetDismissNew = "      // Reset dismiss when no gifts should be present\n" +
  "      if (Object.keys(shouldHave).length === 0 && !Object.keys(giftInCart).length) {\n" +
  "        caseDismissed = false;\n" +
  "        _giftPickerShown = false;\n" +
  "        CCD._hideGiftPicker();\n" +
  "        try { sessionStorage.removeItem('ccd_case_dismissed'); } catch(e) {}";

if (code.includes(resetDismiss)) {
  code = code.replace(resetDismiss, resetDismissNew);
  console.log('6. Reset picker on cart clear');
} else {
  console.log('WARNING: Could not find reset dismiss section');
}

fs.writeFileSync(path, code);
console.log('\nDone! Verifying...');

const final = fs.readFileSync(path, 'utf8');
console.log('  GIFT_CUSTOMER_CHOICE var:', final.includes('GIFT_CUSTOMER_CHOICE'));
console.log('  GIFT_PICKER_TITLE var:', final.includes('GIFT_PICKER_TITLE'));
console.log('  _showGiftPicker method:', final.includes('_showGiftPicker'));
console.log('  _hideGiftPicker method:', final.includes('_hideGiftPicker'));
console.log('  eligibleForPicker:', final.includes('eligibleForPicker'));
console.log('  ccd-gift-picker CSS:', final.includes('ccd-gift-picker'));
console.log('  _giftPickerShown state:', final.includes('_giftPickerShown'));
