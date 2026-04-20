const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// === FIX 1: Gift detection in buildCartItemsContainer ===
// Replace the single-handle check with GIFT_HANDLES map check
code = code.replace(
  '        if (CFG.giftHandle && item.handle === CFG.giftHandle) {\n          giftHTML += CCD.buildGiftItemHTML(item);\n          return;\n        }',
  '        if (GIFT_HANDLES[item.handle] || (CFG.giftHandle && item.handle === CFG.giftHandle)) {\n          giftHTML += CCD.buildGiftItemHTML(item);\n          return;\n        }'
);

// === FIX 2: Parse tiers from nested config at init time ===
code = code.replace(
  '  var REWARD_TIERS = CFG.tiers || [];',
  '  // Try flat tiers first, then nested addons.freeShippingBar.config.tiers\n' +
  '  var REWARD_TIERS = CFG.tiers || [];\n' +
  '  if (REWARD_TIERS.length === 0 && CFG.addons && CFG.addons.freeShippingBar && CFG.addons.freeShippingBar.config && CFG.addons.freeShippingBar.config.tiers) {\n' +
  '    REWARD_TIERS = CFG.addons.freeShippingBar.config.tiers;\n' +
  '    var _fsbCfg = CFG.addons.freeShippingBar.config;\n' +
  '    if (_fsbCfg.thresholdMode) THRESHOLD_MODE = _fsbCfg.thresholdMode;\n' +
  '    if (_fsbCfg.highestTierOnly !== undefined) HIGHEST_TIER_ONLY = !!_fsbCfg.highestTierOnly;\n' +
  '    if (_fsbCfg.allRewardsUnlockedText) ALL_REWARDS_TEXT = _fsbCfg.allRewardsUnlockedText;\n' +
  '    if (_fsbCfg.giftBadgeText) GIFT_BADGE_TEXT = _fsbCfg.giftBadgeText;\n' +
  '    if (_fsbCfg.giftShowComparePrice !== undefined) GIFT_SHOW_COMPARE_PRICE = _fsbCfg.giftShowComparePrice !== false;\n' +
  '    if (_fsbCfg.giftHideDiscountLabel !== undefined) GIFT_HIDE_DISCOUNT_LABEL = _fsbCfg.giftHideDiscountLabel !== false;\n' +
  '  }'
);

// === FIX 3: Theme takeover — force our dimensions on the element ===
code = code.replace(
  "          el.classList.remove('drawer', 'drawer--right', 'drawer--left');\n" +
  "          // Kill any theme styles that might interfere\n" +
  "          el.querySelectorAll('style').forEach(function(s) { s.remove(); });\n" +
  "          console.log('[CCD] Replaced theme drawer DOM with self-rendered shell",
  "          el.classList.remove('drawer', 'drawer--right', 'drawer--left');\n" +
  "          // Force our dimensions — override any theme tag-level CSS (cart-drawer { width: ... })\n" +
  "          el.style.setProperty('max-width', '', '');\n" +
  "          el.style.setProperty('width', '100%', 'important');\n" +
  "          el.style.setProperty('height', '100vh', 'important');\n" +
  "          el.style.setProperty('height', '100dvh', 'important');\n" +
  "          el.style.setProperty('position', 'fixed', 'important');\n" +
  "          el.style.setProperty('top', '0', 'important');\n" +
  "          el.style.setProperty('right', '0', 'important');\n" +
  "          el.style.setProperty('bottom', '0', 'important');\n" +
  "          el.style.setProperty('z-index', '9999', 'important');\n" +
  "          el.style.setProperty('overflow', 'hidden', 'important');\n" +
  "          el.style.setProperty('box-sizing', 'border-box', 'important');\n" +
  "          el.style.setProperty('padding', '0', 'important');\n" +
  "          el.style.setProperty('margin', '0', 'important');\n" +
  "          // Kill any theme styles that might interfere\n" +
  "          el.querySelectorAll('style').forEach(function(s) { s.remove(); });\n" +
  "          console.log('[CCD] Replaced theme drawer DOM with self-rendered shell"
);

fs.writeFileSync(file, code, 'utf8');

const result = fs.readFileSync(file, 'utf8');
var opens = (result.match(/{/g) || []).length;
var closes = (result.match(/}/g) || []).length;
console.log('Brace balance: { = ' + opens + ', } = ' + closes + ' (diff: ' + (opens - closes) + ')');
console.log('GIFT_HANDLES check in items:', result.includes('GIFT_HANDLES[item.handle]'));
console.log('Nested tiers fallback:', result.includes('CFG.addons.freeShippingBar.config.tiers'));
console.log('Theme dimension override:', result.includes("el.style.setProperty('width', '100%', 'important')"));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');
