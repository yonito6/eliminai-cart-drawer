const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Load GIFT_URL_MAP in the dynamic config reload section
const oldReload = `GIFT_DISCOUNT_CODES = config.cartConfig.giftDiscountCodes || [];
      console.log('[CCD] Loaded tiers from backend:', REWARD_TIERS.length, 'tiers, GIFT_HANDLES=', JSON.stringify(GIFT_HANDLES), 'GIFT_CODES=', GIFT_DISCOUNT_CODES.length);`;

const newReload = `GIFT_DISCOUNT_CODES = config.cartConfig.giftDiscountCodes || [];
      // Load gift URL map — duplicate handle → original product URL
      GIFT_URL_MAP = {};
      (config.cartConfig.giftMappings || []).forEach(function(m) {
        if (m.duplicateHandle && m.originalUrl) GIFT_URL_MAP[m.duplicateHandle] = m.originalUrl;
      });
      console.log('[CCD] Loaded tiers from backend:', REWARD_TIERS.length, 'tiers, GIFT_HANDLES=', JSON.stringify(GIFT_HANDLES), 'GIFT_CODES=', GIFT_DISCOUNT_CODES.length, 'GIFT_URL_MAP=', JSON.stringify(GIFT_URL_MAP));`;

if (code.includes(oldReload)) {
  code = code.replace(oldReload, newReload);
  console.log('1. Updated dynamic config reload with GIFT_URL_MAP');
} else {
  console.log('1. SKIP: dynamic config reload pattern not found');
}

// 2. Override item URL in renderItemHTML for gift items
// Find the URL usage in renderItemHTML: (item.url || '/products/' + item.handle)
// We need to replace the URL for gift items with the original product URL
const oldRender = `return '<div class="ccd-item" data-key="' + item.key + '" data-variant-id="' + item.variant_id + '">' +
        '<div class="ccd-item__image">' +
          '<a href="' + (item.url || '/products/' + item.handle) + '">' +`;

const newRender = `var itemUrl = GIFT_URL_MAP[item.handle] || item.url || '/products/' + item.handle;
      return '<div class="ccd-item" data-key="' + item.key + '" data-variant-id="' + item.variant_id + '">' +
        '<div class="ccd-item__image">' +
          '<a href="' + itemUrl + '">' +`;

if (code.includes(oldRender)) {
  code = code.replace(oldRender, newRender);
  console.log('2. Updated renderItemHTML image link with GIFT_URL_MAP');
} else {
  console.log('2. SKIP: renderItemHTML image link pattern not found');
}

// 3. Also update the title link (same function, uses same URL pattern)
const oldTitleLink = `'<a class="ccd-item__name" href="' + (item.url || '/products/' + item.handle) + '">'`;
const newTitleLink = `'<a class="ccd-item__name" href="' + itemUrl + '">'`;

if (code.includes(oldTitleLink)) {
  code = code.replace(oldTitleLink, newTitleLink);
  console.log('3. Updated renderItemHTML title link with itemUrl');
} else {
  console.log('3. SKIP: title link pattern not found');
}

// 4. Also update the second config reload section (there's a duplicate in the initial load around line 2870+)
// Find the second occurrence
const secondReloadOld = `GIFT_DISCOUNT_CODES = config.cartConfig.giftDiscountCodes || [];`;
// Check if there's still an unreplaced occurrence
const idx = code.lastIndexOf(secondReloadOld);
const firstIdx = code.indexOf(secondReloadOld);
if (idx > 0 && idx !== firstIdx) {
  // There's a second occurrence — add GIFT_URL_MAP loading after it
  const afterSecond = code.substring(idx);
  const nextLine = afterSecond.indexOf('\n');
  const insertPoint = idx + nextLine;
  const indent = '      ';
  const giftMapCode = `\n${indent}GIFT_URL_MAP = {};\n${indent}(config.cartConfig.giftMappings || []).forEach(function(m) {\n${indent}  if (m.duplicateHandle && m.originalUrl) GIFT_URL_MAP[m.duplicateHandle] = m.originalUrl;\n${indent}});`;
  code = code.substring(0, insertPoint) + giftMapCode + code.substring(insertPoint);
  console.log('4. Updated second config reload with GIFT_URL_MAP');
} else {
  console.log('4. SKIP: no second config reload occurrence found');
}

// Also need to update the product title display — gift items should show original title (without "[Gift] " prefix)
// The cart drawer gets product_title from Shopify which will be "[Gift] Original Title"
// We need to strip the "[Gift] " prefix for display
const oldTitleDisplay = `(item.product_title || item.title || '').replace(/</g, '&lt;')`;
const newTitleDisplay = `(function(t) { return t.replace(/^\\[Gift\\]\\s*/, ''); })(item.product_title || item.title || '').replace(/</g, '&lt;')`;

if (code.includes(oldTitleDisplay)) {
  code = code.replace(oldTitleDisplay, newTitleDisplay);
  console.log('5. Updated title display to strip [Gift] prefix');
} else {
  console.log('5. SKIP: title display pattern not found');
}

fs.writeFileSync(file, code);
console.log('Done. File size:', code.length);
