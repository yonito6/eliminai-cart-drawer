const fs = require('fs');
const file = 'v14-complete.js';
let code = fs.readFileSync(file, 'utf8');
let changes = 0;

// 1. Add GIFT_VIDS set after GIFT_TIERS initialization (first occurrence, around line 283)
const afterGiftHandles = "  var GIFT_DISCOUNT_CODES = [];";
const giftVidsInit = `  var GIFT_VIDS = {}; // variant_id → true for ALL gift variants
  GIFT_TIERS.forEach(function(t) {
    tierGifts(t).forEach(function(g) { if (g.variantId) GIFT_VIDS[String(g.variantId)] = true; });
  });
  if (WATCH_CASE_VID) GIFT_VIDS[String(WATCH_CASE_VID)] = true;
  var GIFT_DISCOUNT_CODES = [];`;

if (code.includes(afterGiftHandles)) {
  code = code.replace(afterGiftHandles, giftVidsInit);
  changes++;
  console.log('1. Added GIFT_VIDS set initialization');
} else {
  console.log('1. SKIP GIFT_VIDS init');
}

// 2. Also update GIFT_VIDS in the config reload section (second GIFT_DISCOUNT_CODES)
// Find the reload block that rebuilds GIFT_TIERS
const reloadMarker = "      GIFT_DISCOUNT_CODES = config.cartConfig.giftDiscountCodes || [];";
const reloadWithVids = `      GIFT_DISCOUNT_CODES = config.cartConfig.giftDiscountCodes || [];
      GIFT_VIDS = {};
      GIFT_TIERS.forEach(function(t) {
        tierGifts(t).forEach(function(g) { if (g.variantId) GIFT_VIDS[String(g.variantId)] = true; });
      });
      if (WATCH_CASE_VID) GIFT_VIDS[String(WATCH_CASE_VID)] = true;`;

if (code.includes(reloadMarker)) {
  code = code.replace(reloadMarker, reloadWithVids);
  changes++;
  console.log('2. Added GIFT_VIDS rebuild on config reload');
} else {
  console.log('2. SKIP GIFT_VIDS reload');
}

// 3. Add gift block guard in fetch intercept — right after the case guard block
const afterCaseGuard = "          } catch(caseEx) {}\n\n          // Hide empty-state immediately";
const giftBlockGuard = `          } catch(caseEx) {}

          // GUARD: Block external adds of gift variants — gifts are auto-added when qualified
          try {
            var _giftBody = JSON.parse(opts.body);
            var _giftList = _giftBody.items || [_giftBody];
            var _isOurGiftAdd = _giftList.some(function(ai) { return ai.properties && ai.properties._eliminai_gift === 'true'; });
            if (!_isOurGiftAdd) {
              var _hasGiftVariant = _giftList.some(function(ai) { return GIFT_VIDS[String(ai.id)]; });
              if (_hasGiftVariant) {
                CCD.showScarcityToast('This gift is automatically added when you qualify \u2728');
                return Promise.resolve(new Response(JSON.stringify({items:[]}), {status: 200}));
              }
            }
          } catch(_giftEx) {}
          // Also check form-encoded body for gift variant
          try {
            if (typeof opts.body === 'string' && opts.body.indexOf('{') === -1) {
              var _giftParams = new URLSearchParams(opts.body);
              var _giftFormId = _giftParams.get('id');
              var _giftFormIsOurs = opts.body.indexOf('_eliminai_gift') !== -1;
              if (_giftFormId && GIFT_VIDS[String(_giftFormId)] && !_giftFormIsOurs) {
                CCD.showScarcityToast('This gift is automatically added when you qualify \u2728');
                return Promise.resolve(new Response(JSON.stringify({items:[]}), {status: 200}));
              }
            }
          } catch(_giftFormEx) {}

          // Hide empty-state immediately`;

if (code.includes(afterCaseGuard)) {
  code = code.replace(afterCaseGuard, giftBlockGuard);
  changes++;
  console.log('3. Added gift block guard in fetch intercept');
} else {
  console.log('3. SKIP fetch gift guard');
  // Debug
  const idx = code.indexOf('} catch(caseEx) {}');
  console.log('   caseEx at index:', idx);
  if (idx > 0) {
    console.log('   Next 50 chars:', JSON.stringify(code.substring(idx + 19, idx + 70)));
  }
}

// 4. Add gift block guard in XHR intercept
const xhrSendBlock = `        if (this._ccdUrl && this._ccdUrl.indexOf && this._ccdUrl.indexOf('/cart/add') !== -1 && this._ccdMethod && this._ccdMethod.toUpperCase() === 'POST') {`;
const xhrWithGiftGuard = `        if (this._ccdUrl && this._ccdUrl.indexOf && this._ccdUrl.indexOf('/cart/add') !== -1 && this._ccdMethod && this._ccdMethod.toUpperCase() === 'POST') {
          // GUARD: Block external adds of gift variants via XHR
          try {
            var _xhrBody = typeof body === 'string' ? body : '';
            var _xhrIsOurs = _xhrBody.indexOf('_eliminai_gift') !== -1;
            if (!_xhrIsOurs) {
              try {
                var _xb = JSON.parse(_xhrBody);
                var _xl = _xb.items || [_xb];
                if (_xl.some(function(ai) { return GIFT_VIDS[String(ai.id)]; })) {
                  CCD.showScarcityToast('This gift is automatically added when you qualify \u2728');
                  return;
                }
              } catch(_xje) {
                var _xp = new URLSearchParams(_xhrBody);
                if (GIFT_VIDS[String(_xp.get('id'))]) {
                  CCD.showScarcityToast('This gift is automatically added when you qualify \u2728');
                  return;
                }
              }
            }
          } catch(_xgEx) {}`;

if (code.includes(xhrSendBlock)) {
  code = code.replace(xhrSendBlock, xhrWithGiftGuard);
  changes++;
  console.log('4. Added gift block guard in XHR intercept');
} else {
  console.log('4. SKIP XHR gift guard');
}

fs.writeFileSync(file, code);
console.log('\n' + changes + ' changes applied. File size:', code.length);
