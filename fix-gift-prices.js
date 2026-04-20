const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// Replace buildGiftItemHTML with dynamic price version
code = code.replace(
  "    buildGiftItemHTML: function(item) {\n" +
  "      var giftCprice = CFG.giftComparePrice || '$49.99';\n" +
  "      var giftLabel = CFG.giftLabel || 'Bonus gift';",
  "    buildGiftItemHTML: function(item) {\n" +
  "      var giftLabel = GIFT_BADGE_TEXT || CFG.giftLabel || 'Bonus gift';\n" +
  "      // Dynamic compare price from cart JSON item data\n" +
  "      var giftCprice = '';\n" +
  "      if (GIFT_SHOW_COMPARE_PRICE) {\n" +
  "        var _cents = item.original_line_price || item.line_price || item.price || 0;\n" +
  "        if (_cents > 0) { giftCprice = CCD.fmt(_cents); }\n" +
  "        else { for (var _ti = 0; _ti < GIFT_TIERS.length; _ti++) { var _tg = tierGift(GIFT_TIERS[_ti]); if (_tg && _tg.handle === item.handle && _tg.price) { giftCprice = '$' + _tg.price; break; } } }\n" +
  "      }"
);

// Replace the gift label div to use config colors
code = code.replace(
  "        '<div class=\"ccd-gift-label\">' +\n" +
  "          '<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z\"/></svg> ' +\n" +
  "          giftLabel +",
  "        '<div class=\"ccd-gift-label\" style=\"background:' + GIFT_BADGE_BG_COLOR + ';color:' + GIFT_BADGE_TEXT_COLOR + '\">' +\n" +
  "          '<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z\"/></svg> ' +\n" +
  "          giftLabel +"
);

// Replace compare price and Free label to use dynamic values and green color
code = code.replace(
  "            '<div class=\"ccd-gift-item__price-row\">' +\n" +
  "              '<span class=\"ccd-item__compare-price\">' + giftCprice + '</span>' +\n" +
  "              '<span class=\"ccd-item__price ccd-item__price--free\">Free</span>' +",
  "            '<div class=\"ccd-gift-item__price-row\">' +\n" +
  "              (giftCprice ? '<span class=\"ccd-item__compare-price\">' + giftCprice + '</span>' : '') +\n" +
  "              '<span class=\"ccd-item__price ccd-item__price--free\" style=\"color:#1a7a1a;font-weight:600\">Free</span>' +"
);

fs.writeFileSync(file, code, 'utf8');

const result = fs.readFileSync(file, 'utf8');
var opens = (result.match(/{/g) || []).length;
var closes = (result.match(/}/g) || []).length;
console.log('Brace balance: { = ' + opens + ', } = ' + closes + ' (diff: ' + (opens - closes) + ')');
console.log('Dynamic price:', result.includes('item.original_line_price'));
console.log('Green Free:', result.includes('color:#1a7a1a;font-weight:600'));
console.log('Badge colors:', result.includes('GIFT_BADGE_BG_COLOR'));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
