const fs = require('fs');
let code = fs.readFileSync('v14-complete.js', 'utf8');
let fixes = 0;

// OPTIMIZATION 1: Show gift item OPTIMISTICALLY in the DOM immediately,
// before the /cart/add.js call completes.
// When we know a gift should be added, inject a placeholder gift item into the DOM
// instantly, then the /cart/add.js call confirms it in the background.

// Find the block where toAdd is processed (after "Execute removals and adds")
const executeBlock = "// Execute removals and adds — batch for speed";
const executeIdx = code.indexOf(executeBlock);
if (executeIdx === -1) { console.error('ERROR: execute block not found'); process.exit(1); }

// Find the "if (toRemove.length > 0 || toAdd.length > 0) {" line
const ifBatchLine = "if (toRemove.length > 0 || toAdd.length > 0) {";
const ifBatchIdx = code.indexOf(ifBatchLine, executeIdx);
if (ifBatchIdx === -1) { console.error('ERROR: batch if not found'); process.exit(1); }

// Insert optimistic gift rendering BEFORE the batch operations
const optimisticGiftCode = `
      // OPTIMISTIC: Show gift items in DOM immediately (before API confirms)
      if (toAdd.length > 0 && toRemove.length === 0) {
        toAdd.forEach(function(giftItem) {
          // Find the gift config to get image/title
          var giftHandle = null;
          var giftTitle = 'Free Gift';
          var giftImg = '';
          Object.keys(shouldHave).forEach(function(h) {
            if (shouldHave[h] == giftItem.id) giftHandle = h;
          });
          // Search GIFT_TIERS for the matching product info
          GIFT_TIERS.forEach(function(t) {
            var gifts = tierGifts(t);
            gifts.forEach(function(g) {
              if (g.handle === giftHandle) {
                giftTitle = g.title || giftTitle;
                giftImg = g.image || giftImg;
              }
            });
          });
          // Inject optimistic gift row
          var itemsContainer = document.querySelector('#CCD-Drawer .ccd-items');
          if (itemsContainer && !itemsContainer.querySelector('.ccd-gift-item[data-optimistic="1"]')) {
            var giftHtml = '<div class="ccd-gift-item" data-optimistic="1" data-gift="1" style="opacity:0;transform:translateY(8px);transition:opacity 0.25s ease,transform 0.25s ease">' +
              '<div class="ccd-gift-label"><span>\\u2728 FREE GIFT</span></div>' +
              '<div style="display:flex;gap:12px;align-items:center;padding:0 16px">' +
              (giftImg ? '<img src="' + giftImg + '" width="48" height="48" style="border-radius:6px;object-fit:cover" />' : '') +
              '<div style="flex:1"><div style="font-size:13px;font-weight:500">' + giftTitle + '</div>' +
              '<div style="font-size:12px;color:#1a7a1a;font-weight:600">FREE</div></div></div></div>';
            itemsContainer.insertAdjacentHTML('beforeend', giftHtml);
            // Trigger animation
            var optGift = itemsContainer.querySelector('.ccd-gift-item[data-optimistic="1"]');
            if (optGift) requestAnimationFrame(function() { optGift.style.opacity = '1'; optGift.style.transform = 'translateY(0)'; });
          }
        });
      }
`;

code = code.substring(0, ifBatchIdx) + optimisticGiftCode + '\n      ' + code.substring(ifBatchIdx);
fixes++;
console.log('1. Added optimistic gift rendering');

// OPTIMIZATION 2: Skip the extra /cart.js fetch after /cart/add.js
// /cart/add.js returns the added item, but we need the full cart.
// Instead of fetching /cart.js separately, use /cart/add.js response + merge with existing cart
// Actually, the issue is we NEED /cart.js for the full cart state.
// But we can start the refresh with optimistic data while /cart.js loads.
// The optimistic rendering above already handles the visual part.

// OPTIMIZATION 3: Use /cart/add.js with sections=[] to avoid theme section rendering
// (reduces server-side work)
// Already done in app-embed.liquid fetch interception

// OPTIMIZATION 4: Remove the extra /cart.js call when only adding gifts
// After /cart/add.js succeeds, we can construct the cart state from the existing
// cart + the added items, skipping the /cart.js roundtrip entirely
const oldAfterAdd = "return _oFBatch('/cart.js');";
// There are TWO of these - in the batch add success and the sequential fallback
// Replace both with a lighter approach
const newAfterAdd = "return _oFBatch('/cart.js', { headers: { 'Content-Type': 'application/json' } });";
// Actually, we can't really skip /cart.js because Shopify recalculates discounts.
// But we can make the /cart/add.js NOT wait for theme sections (already handled).
// The real win is the optimistic rendering above.

console.log('2. Optimistic rendering is the main speed win — gift shows instantly');

fs.writeFileSync('v14-complete.js', code);
console.log('\n' + fixes + ' fix(es) applied.');
