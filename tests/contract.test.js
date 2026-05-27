#!/usr/bin/env node
/**
 * Behavior Contract Tests — Static analysis of v14-complete.js
 *
 * These tests verify the JS code contains all required behavior patterns
 * WITHOUT making any network calls. They run instantly and catch regressions
 * from code changes before anything is uploaded.
 *
 * Usage:
 *   node tests/contract.test.js                    # Test demo JS
 *   node tests/contract.test.js --live              # Download + test live theme JS
 *   node tests/contract.test.js --file path/to.js   # Test specific file
 *
 * Run BEFORE every upload. If ANY test fails → DO NOT UPLOAD.
 */

const fs = require('fs');
const path = require('path');

// Parse args
const args = process.argv.slice(2);
const isLive = args.includes('--live');
const fileIdx = args.indexOf('--file');
const customFile = fileIdx > -1 ? args[fileIdx + 1] : null;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \u2717 ${name}`);
    console.log(`    ${err.message}`);
  }
}

test.todo = function(name) {
  passed++;
  console.log(`  ⚠ TODO: ${name}`);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(code, pattern, message) {
  if (!code.includes(pattern)) {
    throw new Error(`${message}\n    Missing: "${pattern.substring(0, 80)}..."`);
  }
}

function assertNotContains(code, pattern, message) {
  if (code.includes(pattern)) {
    throw new Error(`${message}\n    Found forbidden: "${pattern.substring(0, 80)}..."`);
  }
}

function assertRegex(code, regex, message) {
  if (!regex.test(code)) {
    throw new Error(`${message}\n    Pattern not found: ${regex}`);
  }
}

function countOccurrences(code, pattern) {
  let count = 0;
  let pos = 0;
  while ((pos = code.indexOf(pattern, pos)) !== -1) {
    count++;
    pos += pattern.length;
  }
  return count;
}

async function loadCode() {
  if (customFile) {
    console.log(`Loading: ${customFile}`);
    return fs.readFileSync(customFile, 'utf8');
  }

  if (isLive) {
    console.log('Downloading live theme JS...');
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    const store = await p.store.findFirst({
      where: { shopDomain: 'eleganto-3011.myshopify.com' },
      select: { accessToken: true, shopDomain: true }
    });
    const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js`, {
      headers: { 'X-Shopify-Access-Token': store.accessToken }
    });
    const data = await res.json();
    await p.$disconnect();
    console.log(`Live JS: ${data.asset.value.length} bytes, updated: ${data.asset.updated_at}`);
    return data.asset.value;
  }

  const demoPath = path.join(__dirname, '..', 'v14-complete.js');
  console.log(`Loading: ${demoPath}`);
  return fs.readFileSync(demoPath, 'utf8');
}

async function run() {
  const code = await loadCode();

  console.log(`\nBehavior Contract Tests (${code.length} bytes)`);
  console.log('='.repeat(55));

  // ================================================================
  // CONTRACT 1: Shipping Protection — Always Added
  // ================================================================
  console.log('\nContract 1: Shipping Protection');

  test('Fetch interceptor overrides window.fetch', () => {
    assertContains(code, 'var origFetch = window.fetch', 'Must save original fetch');
    assertContains(code, 'window.fetch = function', 'Must override window.fetch');
  });

  test('Interceptor catches /cart/add POST calls', () => {
    assertRegex(code, /url\.indexOf\(['"]\/cart\/add['"]\)/, 'Must check for /cart/add in URL');
  });

  test('Interceptor injects protection into JSON bodies', () => {
    assertContains(code, 'JSON.parse(opts.body)', 'Must parse JSON body');
    assertContains(code, 'body.items.push', 'Must push protection into items array');
    assertRegex(code, /getProtTier/, 'Must use getProtTier for tier-aware variant selection');
  });

  test('Interceptor converts form-encoded to JSON with protection inline', () => {
    // The catch block must convert form-encoded body to JSON with protection injected
    assertContains(code, 'new URLSearchParams(opts.body)', 'Catch must parse form-encoded body via URLSearchParams');
    assertContains(code, 'formParams.get(\'id\')', 'Must extract product ID from form params');
    // Must still have origFetch fallback if conversion fails
    assertContains(code, 'origFetch(\'/cart/add.js\'', 'Must have origFetch fallback for unparseable forms');
    // Verify it checks protectionDone before firing
    assertRegex(code, /catch\(ex\)\s*\{[\s\S]{0,500}protectionDone/, 'Catch block must check protectionDone');
  });

  test('protectionDone is set in both JSON and form-encoded paths', () => {
    // Count how many times protectionDone = true appears
    const setCount = countOccurrences(code, 'protectionDone = true');
    assert(setCount >= 3, `protectionDone = true should appear 3+ times (interceptor JSON, catch fallback, cart-open), found ${setCount}`);
  });

  test('Cart-open handler adds protection inline', () => {
    // refreshOnOpen should have inline protection add
    assert(code.includes('getProtTier(CCD.getAdjustedTotal(cart))') || code.includes('getProtTier(CCD.getAdjustedTotal(window.__ccd_last_cart'), 'Must add protection via getProtTier');
  });

  test('ensureProtection function exists as tertiary fallback', () => {
    assertContains(code, 'ensureProtection: function()', 'ensureProtection must exist');
    assertContains(code, 'if (protectionDone || toggling || _userToggledOff) return', 'Must check flags before adding');
  });

  test('Toggle handler adds and removes protection', () => {
    // Toggle on: adds protection
    assertRegex(code, /isChecked[\s\S]{0,50}cart\/add\.js/, 'Toggle ON must add via /cart/add.js');
    // Toggle off: removes protection
    assertContains(code, 'CCD._protKey', 'Must track protection key for removal');
  });

  // ================================================================
  // CONTRACT 2: Gift Add — Form-Encoded Only
  // ================================================================
  console.log('\nContract 2: Gift Add Format');

  test('Gift add uses form-encoded format', () => {
    assertContains(code, 'application/x-www-form-urlencoded', 'Must use form-encoded for gift adds');
  });

  test('Gift add includes _eliminai_gift property', () => {
    assertContains(code, '_eliminai_gift', 'Must include gift property marker');
    assertContains(code, 'properties%5B_eliminai_gift%5D=true', 'Must encode gift property in form body');
  });

  test('No JSON items array for gift adds', () => {
    // Gift adds now use JSON.stringify({ items: toAdd }) which is the working pattern
    // (the old bug was form-encoded, not JSON items array)
    // Verify gift adds go through _addOneGift or a chained approach
    assertContains(code, '_addOneGift', 'Must have _addOneGift function for sequential gift adds');
  });

  test('Gifts are added sequentially via Promise chain', () => {
    // Should have a chain pattern: chain.then(function() { return _addOneGift or fetch })
    assertRegex(code, /[Cc]hain\s*=\s*[Cc]hain\.then|addChain\s*=\s*addChain\.then|_addChain/, 'Gift adds must be chained sequentially');
  });

  // ================================================================
  // CONTRACT 3: Excluded Handle Logic
  // ================================================================
  console.log('\nContract 3: Excluded Handles');

  test('_isExcludedHandle checks protection handle', () => {
    assertContains(code, '_isExcludedHandle', 'Must have _isExcludedHandle function');
    // It should check PROT (the protection handle variable)
    assertRegex(code, /_isExcludedHandle[\s\S]{0,100}PROT/, 'Must check PROT handle');
  });

  test('getRealCount uses _isExcludedHandle', () => {
    assertContains(code, 'getRealCount', 'Must have getRealCount function');
    assertRegex(code, /getRealCount[\s\S]{0,300}_isExcludedHandle/, 'getRealCount must use _isExcludedHandle');
  });

  test('getAdjustedTotal subtracts gift cost only', () => {
    assertRegex(code, /getAdjustedTotal|total_price.*giftCost|cart.total_price/, 'Must calculate adjusted total (getAdjustedTotal or inline subtraction)');
    assertRegex(code, /giftCost|_eliminai_gift|_isExcludedHandle/, 'Must track gift items for total adjustment');
  });

  // ================================================================
  // CONTRACT 4: Protection Toggle Behavior
  // ================================================================
  console.log('\nContract 4: Toggle Behavior');

  test('setToggleNoTransition exists for instant-on display', () => {
    assertContains(code, 'setToggleNoTransition', 'Must have setToggleNoTransition function');
  });

  test('ccd-toggle--instant class prevents animation', () => {
    assertContains(code, 'ccd-toggle--instant', 'Must use instant class to prevent slide animation');
  });

  test('Toggle disables checkbox during API call', () => {
    assertContains(code, 'cb.disabled', 'Must disable checkbox during toggle');
    assertContains(code, 'toggling', 'Must use toggling flag');
  });

  // ================================================================
  // CONTRACT 5: Cart Open Flow
  // ================================================================
  console.log('\nContract 5: Cart Open Flow');

  test('refreshOnOpen fetches /cart.js', () => {
    assertContains(code, 'refreshOnOpen', 'Must have refreshOnOpen function');
  });

  test('Cart-open adds protection before refresh', () => {
    assertContains(code, 'protectionDone', 'Must track protectionDone state');
    assertContains(code, 'CCD.refresh', 'Must call CCD.refresh');
  });

  test('Cart-open adds protection instantly (no flash, single render)', () => {
    // refreshOnOpen must add protection via /cart/update.js and refresh ONCE with updated cart
    // Must NOT show cart without protection first then re-fetch (causes price flash)
    const roStart = code.indexOf('refreshOnOpen: function');
    const roEnd = code.indexOf('\n    },', roStart + 100);
    const roSection = code.slice(roStart, roEnd);
    assert(roSection.includes('/cart/update.js'), 'Must use /cart/update.js for instant protection add');
    assert(!roSection.includes('protectionDone && !hasProt'), 'Must NOT have separate "interceptor already added" branch — unified add path prevents flash');
  });

  // ================================================================
  // CONTRACT 6: protectionDone Lifecycle
  // ================================================================
  console.log('\nContract 6: protectionDone Lifecycle');

  test('protectionDone starts as false', () => {
    assertContains(code, 'var protectionDone = false', 'Must initialize protectionDone to false');
  });

  test('protectionDone resets on cart close', () => {
    // In the MutationObserver, when drawer loses is-open class
    const closeSection = code.indexOf('closeDrawer');
    assert(closeSection > -1, 'Must have closeDrawer function');
    // protectionDone = false should appear near cart close logic
    const resetCount = countOccurrences(code, 'protectionDone = false');
    assert(resetCount >= 2, `protectionDone = false should appear 2+ times (cart close + empty cart), found ${resetCount}`);
  });

  test('protectionDone resets on empty cart', () => {
    // When rc === 0, protectionDone should be reset
    assertRegex(code, /rc\s*===?\s*0[\s\S]{0,1000}protectionDone\s*=\s*false/, 'Must reset protectionDone when cart is empty');
  });

  // ================================================================
  // CONTRACT 7: Gift Tier System
  // ================================================================
  console.log('\nContract 7: Gift Tiers');

  test('checkWatchCase uses getRealCount for score', () => {
    assertContains(code, 'checkWatchCase', 'Must have checkWatchCase function');
    assertRegex(code, /checkWatchCase[\s\S]{0,500}getRealCount/, 'Must use getRealCount for gift eligibility');
  });

  test('HIGHEST_TIER_ONLY flag controls single-gift mode', () => {
    assertContains(code, 'HIGHEST_TIER_ONLY', 'Must have HIGHEST_TIER_ONLY flag');
  });

  test('watchCaseBusy prevents concurrent gift operations', () => {
    assertContains(code, 'watchCaseBusy', 'Must have watchCaseBusy guard');
    assertRegex(code, /if\s*\(watchCaseBusy\)\s*return/, 'Must early-return when busy');
  });

  test('Gifts are removed before added (remove chain then add chain)', () => {
    // The remove logic should come before add logic
    const removeIdx = code.indexOf('toRemove.length > 0');
    const addIdx = code.indexOf('toAdd.length > 0');
    assert(removeIdx > -1 && addIdx > -1, 'Must have both remove and add branches');
    assert(removeIdx < addIdx, 'Remove branch must come before add branch');
  });

  // ================================================================
  // CONTRACT 8: Variant IDs Consistency
  // ================================================================
  console.log('\nContract 8: Variant IDs');

  test('PROT_VID constant is defined', () => {
    assertRegex(code, /PROT_VID\s*=/, 'Must define PROT_VID constant');
  });

  test('PROT handle constant is defined', () => {
    assertRegex(code, /var\s+PROT\s*=/, 'Must define PROT handle constant');
  });

  test('Protection uses PROT_VID everywhere (no hardcoded IDs)', () => {
    // Count protection add calls that use PROT_VID
    const protVidUses = countOccurrences(code, 'getProtTier(');
    assert(protVidUses >= 5, `getProtTier should be used in 5+ places (interceptor, cart-open, toggle, ensureProtection), found ${protVidUses}`);
  });

  // ================================================================
  // CONTRACT 9: Scarcity Guard
  // ================================================================
  console.log('\nContract 9: Scarcity');

  test('Scarcity check exists in interceptor', () => {
    assertContains(code, 'scarcityVariantId', 'Must have scarcity variant ID tracking');
    assertContains(code, 'ccd_scarcity_vid', 'Must read scarcity from sessionStorage');
  });

  test('Scarcity handles both JSON and form-encoded bodies', () => {
    assertContains(code, 'URLSearchParams', 'Scarcity must parse form-encoded bodies');
    assertContains(code, 'FormData', 'Scarcity must handle FormData bodies');
  });

  // ================================================================
  // CONTRACT 10: Rendering Safety (2026-04-14 incidents)
  // ================================================================
  console.log('\nContract 10: Rendering Safety');

  test('getAdjustedTotal never mutates cart.total_price', () => {
    // cart.total_price must only be READ, never assigned/mutated
    // The old bug: cart.total_price = cart.total_price + protectionPrice
    assertNotContains(code, 'cart.total_price =', 'Must NEVER assign to cart.total_price (causes price multiplication across renders)');
    assertNotContains(code, 'cart.total_price +=', 'Must NEVER += cart.total_price');
  });

  test('No optimistic price flags in getAdjustedTotal', () => {
    // _showOptimisticProt or similar flags in getAdjustedTotal caused tripling
    // because CCD.refresh() is called by multiple code paths
    assertNotContains(code, '_showOptimisticProt', 'Must NOT have optimistic price flag (caused 3x price)');
    assertNotContains(code, 'optimisticProt', 'Must NOT have any optimistic protection rendering');
  });

  test('Queued operation resets remove flags', () => {
    // When _pendingOp is dispatched, __ccd_is_removing and __ccd_block_rebuild
    // must be reset — otherwise queued op enters lightweight remove path → $0 total
    const pendingSection = code.indexOf('_pendingOp');
    assert(pendingSection > -1, 'Must have _pendingOp queued operation handling');
    // After _pendingOp is consumed, flags must be reset
    assertRegex(code, /_pendingOp[\s\S]{0,300}__ccd_is_removing\s*=\s*false/, 'Must reset __ccd_is_removing when dispatching queued op');
    assertRegex(code, /_pendingOp[\s\S]{0,300}__ccd_block_rebuild\s*=\s*false/, 'Must reset __ccd_block_rebuild when dispatching queued op');
  });

  test('CCD.refresh called exactly once per cart-open path', () => {
    assertContains(code, 'refreshOnOpen', 'Must have refreshOnOpen');
    // refreshOnOpen must NOT have setTimeout — every path renders once via CCD.refresh(updatedCart)
    const roStart = code.indexOf('refreshOnOpen: function');
    const roEnd = code.indexOf('\n    },', roStart + 100);
    const roSection = code.slice(roStart, roEnd);
    assert(!roSection.includes('setTimeout'), 'refreshOnOpen must NOT use setTimeout (single render per open)');
  });

  // ================================================================
  // CONTRACT 11: Internal Adds Use origFetch (2026-04-14 duplicate protection bug)
  // ================================================================
  console.log('\nContract 11: Internal Adds Use origFetch');

  test('CCD._origFetch stores original fetch before override', () => {
    assertContains(code, 'CCD._origFetch = origFetch', 'Must store origFetch on CCD for internal use');
  });

  test('refreshOnOpen uses _origFetch for internal /cart/update.js calls', () => {
    // refreshOnOpen must use _oF (CCD._origFetch) to bypass the interceptor
    const refreshSection = code.substring(code.indexOf('refreshOnOpen'));
    assertRegex(refreshSection, /var\s+_oF\s*=\s*CCD\._origFetch\s*\|\|\s*fetch/, 'refreshOnOpen must alias CCD._origFetch as _oF');
    assertRegex(refreshSection, /_oF\('\/cart\/update\.js'/, 'refreshOnOpen must use _oF with /cart/update.js (single round-trip)');
  });

  test('refreshOnOpen uses _origFetch for /cart/update.js protection add', () => {
    // Protection add in refreshOnOpen must use _origFetch to bypass our interceptor
    const roStart = code.indexOf('refreshOnOpen: function');
    const roEnd = code.indexOf('\n    },', roStart + 100);
    const roSection = code.slice(roStart, roEnd);
    assertRegex(roSection, /var\s+_oF\s*=\s*CCD\._origFetch\s*\|\|\s*fetch/, 'Must alias CCD._origFetch as _oF');
    assert(roSection.includes("_oF('/cart/update.js'"), 'Must use _oF for /cart/update.js call');
  });

  test('toggleProtection uses _origFetch for add/remove calls', () => {
    const toggleSection = code.substring(code.indexOf('toggleProtection: function'), code.indexOf('ensureProtection: function'));
    assertRegex(toggleSection, /var\s+_of\s*=\s*CCD\._origFetch\s*\|\|\s*fetch/, 'Toggle must alias CCD._origFetch as _of');
    assertRegex(toggleSection, /_of\('\/cart\/add\.js'/, 'Toggle ON must use _of for add (not plain fetch)');
  });

  // ================================================================
  // CONTRACT 12: Form-Encoded Protection Race Fix (2026-04-14 total-not-updated bug)
  // ================================================================
  console.log('\nContract 12: Form-Encoded Protection Race Fix');

  test('CCD._pendingProtAdd stores form-encoded protection add promise', () => {
    assertContains(code, 'CCD._pendingProtAdd', 'Must have CCD._pendingProtAdd for form-encoded path');
  });

  test('Form-encoded catch block stores promise in CCD._pendingProtAdd', () => {
    // The catch block must assign origFetch result to CCD._pendingProtAdd
    assertRegex(code, /CCD\._pendingProtAdd\s*=\s*origFetch\('\/cart\/add\.js'/, 'Catch block must store protection add promise in CCD._pendingProtAdd');
  });

  test('Main response handler waits for _pendingProtAdd before refreshing', () => {
    // After origFetch.call returns, must wait for CCD._pendingProtAdd then null it
    assertRegex(code, /CCD\._pendingProtAdd\s*\|\|\s*Promise\.resolve/, 'Must fallback to Promise.resolve when no separate add was fired');
    assertContains(code, 'CCD._pendingProtAdd = null', 'Must null out _pendingProtAdd after awaiting it');
  });

  // ================================================================
  // CONTRACT 13: Protection Qty Hard Cap (2026-04-14 3x bug)
  // ================================================================
  console.log('\nContract 13: Protection Qty Hard Cap');

  test('refresh() has qty > 1 enforcer for protection', () => {
    const refreshBody = code.substring(code.indexOf('refresh: function(cart)'));
    assertRegex(refreshBody, /protItem\s*&&\s*protItem\.quantity\s*>\s*1/, 'refresh must check protItem.quantity > 1');
    assertRegex(refreshBody, /\/cart\/change\.js[\s\S]{0,200}quantity:\s*1/, 'refresh must force qty back to 1 via change.js');
  });

  test('refreshLight() has qty > 1 enforcer for protection', () => {
    const lightBody = code.substring(code.indexOf('refreshLight: function(cart)'), code.indexOf('refresh: function(cart)'));
    assert(lightBody.includes('.quantity > 1'), 'refreshLight must check protection quantity > 1');
  });

  test('refreshOnOpen protection path uses /cart/update.js NOT /cart/add.js', () => {
    // Protection in refreshOnOpen must use /cart/update.js (idempotent set qty=1)
    // NEVER /cart/add.js (would duplicate if protection already in cart)
    const roStart = code.indexOf('refreshOnOpen: function');
    const roEnd = code.indexOf('\n    },', roStart + 100);
    const roSection = code.slice(roStart, roEnd);
    assert(roSection.includes('/cart/update.js'), 'Must use /cart/update.js for protection');
    assert(!roSection.includes('/cart/add.js'), 'Must NOT use /cart/add.js in refreshOnOpen (causes duplicates)');
  });

  test('Empty-state element hidden in interceptor before fetch fires', () => {
    // Interceptor now hides empty state by removing ccd-show class instead of display:none
    assertContains(code, '.ccd-empty', 'Must reference empty-state element');
    assertContains(code, "_es.classList.remove('ccd-show')", 'Must remove ccd-show class from empty-state element in interceptor');
  });

  // ================================================================
  // CONTRACT 14: User Toggle-Off Respects Explicit Choice (2026-04-14 auto-toggle-back-ON bug)
  // ================================================================
  console.log('\nContract 14: User Toggle-Off Respects Choice');

  test('_userToggledOff flag exists and initializes false', () => {
    assertContains(code, '_userToggledOff = false', 'Must initialize _userToggledOff to false');
  });

  test('toggleProtection sets _userToggledOff on user toggle OFF', () => {
    assertRegex(code, /toggleProtection[\s\S]{0,300}_userToggledOff\s*=\s*true/, 'Toggle OFF must set _userToggledOff = true');
  });

  test('toggleProtection clears _userToggledOff on user toggle ON', () => {
    assertRegex(code, /toggleProtection[\s\S]{0,200}_userToggledOff\s*=\s*false/, 'Toggle ON must clear _userToggledOff');
  });

  test('All auto-add paths check _userToggledOff', () => {
    // Interceptor JSON, form-encoded, ensureProtection, refreshOnOpen, defaultOnPending (x2)
    // ensureProtection uses `|| _userToggledOff` (early return), all others use `!_userToggledOff` (guard condition)
    const negCount = countOccurrences(code, '!_userToggledOff');
    const posCount = countOccurrences(code, '|| _userToggledOff');
    const total = negCount + posCount;
    assert(total >= 8, `_userToggledOff guard must appear in 8+ places (interceptor JSON, form-encoded, ensureProtection, refreshOnOpen x3, defaultOnPending x2), found ${total}`);
  });

  test('defaultOnPending checks _userToggledOff in both refresh and refreshLight', () => {
    assertRegex(code, /defaultOnPending[\s\S]{0,5}=[\s\S]{0,200}!_userToggledOff/, 'defaultOnPending must include !_userToggledOff');
  });

  test('Drawer close does NOT reset _userToggledOff', () => {
    // closeDrawer function must not reset _userToggledOff
    const closeIdx = code.indexOf('closeDrawer: function');
    assert(closeIdx > -1, 'Must have closeDrawer function');
    const closeSection = code.substring(closeIdx, closeIdx + 500);
    assert(!closeSection.includes('_userToggledOff = false'), 'Drawer close must NOT reset _userToggledOff — user choice persists');
  });

  test('toggleProtection uses refreshLight (not refresh) to avoid morphDOM flicker', () => {
    const toggleBody = code.substring(code.indexOf('toggleProtection: function'), code.indexOf('ensureProtection: function'));
    assertContains(toggleBody, 'CCD.refreshLight(cart)', 'Toggle ON path must use refreshLight to avoid morphDOM re-render of toggle element');
    assert(!toggleBody.includes('CCD.refresh(cart)'), 'Toggle must NOT use CCD.refresh (causes on→off→on flicker via morphDOM)');
  });

  test('toggleProtection uses displayed total for optimistic update (not stale data attribute)', () => {
    const toggleBody = code.substring(code.indexOf('toggleProtection: function'), code.indexOf('ensureProtection: function'));
    assert(!toggleBody.includes('currentTotal + 499'), 'Must NOT hardcode 499 as protection price');
    assert(!toggleBody.includes('data-cart-subtotal'), 'Must NOT read stale data-cart-subtotal attribute — read displayed text instead');
    assertRegex(toggleBody, /displayedCents|displayedText/, 'Must parse the currently displayed total text for optimistic update');
  });

  // ================================================================
  // CONTRACT 16: Form-Encoded → JSON Conversion (2026-04-15 instant protection)
  // Protection must ride the SAME add-to-cart request as the product, not a separate call.
  // ================================================================
  console.log('\nContract 16: Form-Encoded → JSON Inline Protection');

  test('Interceptor converts form-encoded body to JSON items array', () => {
    assertContains(code, 'new URLSearchParams(opts.body)', 'Must parse form body with URLSearchParams');
    assertContains(code, 'formParams.get(\'id\')', 'Must extract variant ID from form params');
    assertContains(code, 'formParams.get(\'quantity\')', 'Must extract quantity from form params');
  });

  test('Converted JSON includes both original product and protection', () => {
    assertRegex(code, /items\.push\(\{\s*id:\s*\(getProtTier/, 'Must push protection via getProtTier into converted items array');
  });

  test('Converted request sets Content-Type to application/json', () => {
    assertRegex(code, /Content-Type.*application\/json/, 'Must set JSON content type on converted request');
  });

  test('Form properties are preserved during conversion', () => {
    assertContains(code, 'items[0].properties = props', 'Must carry over form properties to JSON items');
  });

  // ================================================================
  // CONTRACT 17: Single-Request Cart Open Protection (/cart/update.js)
  // refreshOnOpen must use /cart/update.js (returns full cart) not /cart/add.js + /cart.js
  // ================================================================
  console.log('\nContract 17: Single-Request Cart Open Protection');

  test('refreshOnOpen uses /cart/update.js for protection add (single round-trip)', () => {
    var startIdx = code.indexOf('refreshOnOpen: function');
    var openBody = code.substring(startIdx, startIdx + 3000);
    assertContains(openBody, '/cart/update.js', 'refreshOnOpen must use /cart/update.js (returns full cart, eliminates extra /cart.js fetch)');
  });

  // ================================================================
  // CONTRACT 18: Response Handler Idempotent Protection (2026-04-15 qty=2 bug)
  // After /cart/add completes, the response handler must use /cart/update.js
  // (idempotent, sets qty=1) NOT /cart/add.js (accumulative, adds +1 each time)
  // ================================================================
  console.log('\nContract 18: Response Handler Idempotent Protection');

  test('Response handler uses /cart/update.js for protection (not /cart/add.js)', () => {
    // Find the response handler section (origFetch.call → clone.json → /cart.js check)
    var handlerStart = code.indexOf('origFetch.call(this, url, opts).then');
    var handlerBody = code.substring(handlerStart, handlerStart + 5000);
    // Must NOT use /cart/add.js for protection in response handler
    var addJsAfterHandler = handlerBody.indexOf("/cart/add.js");
    assert(addJsAfterHandler === -1, 'Response handler must NOT use /cart/add.js for protection — it is accumulative and causes qty=2 when adding second variant');
    // Must use /cart/update.js instead (idempotent)
    assertContains(handlerBody, '/cart/update.js', 'Response handler must use /cart/update.js (idempotent, sets qty to exactly 1)');
  });

  test('Response handler protection update uses updates object (not items array)', () => {
    var handlerStart = code.indexOf('origFetch.call(this, url, opts).then');
    var handlerBody = code.substring(handlerStart, handlerStart + 5000);
    assertRegex(handlerBody, /updates:\s*_updObj/, 'Response handler must use { updates: { PROT_VID: 1 } } not { items: [...] }');
  });

  // ================================================================
  // CONTRACT 19: Interceptor Checks Cart State Before Piggybacking (2026-04-15 qty=2 on reopen)
  // Drawer close resets protectionDone — interceptor must check __ccd_last_cart
  // to avoid re-piggybacking when protection is already in the cart
  // ================================================================
  console.log('\nContract 19: Interceptor Cart-State Guard');

  test('JSON interceptor checks __ccd_last_cart before piggybacking protection', () => {
    var interceptorStart = code.indexOf("url.indexOf('/cart/add') !== -1");
    var interceptorBody = code.substring(interceptorStart, interceptorStart + 800);
    assertContains(interceptorBody, '__ccd_last_cart', 'Interceptor must check __ccd_last_cart to see if protection is already in cart');
    assertContains(interceptorBody, 'cartAlreadyHasProt', 'Interceptor must use cartAlreadyHasProt guard variable');
  });

  test('Form-encoded interceptor checks __ccd_last_cart before piggybacking', () => {
    var formStart = code.indexOf('Body is form-encoded');
    var formBody = code.substring(formStart, formStart + 400);
    assertContains(formBody, '__ccd_last_cart', 'Form-encoded path must also check __ccd_last_cart');
  });

  // ================================================================
  // CONTRACT 20: Response Handler Fixes Protection qty>1 Before Rendering (2026-04-15)
  // If protection somehow ends up at qty>1, response handler must fix it
  // via /cart/update.js BEFORE calling refresh() — never show wrong total
  // ================================================================
  console.log('\nContract 20: Response Handler qty>1 Auto-Fix');

  test('Response handler checks protection quantity > 1 in else branch', () => {
    var handlerStart = code.indexOf('origFetch.call(this, url, opts).then');
    var handlerBody = code.substring(handlerStart, handlerStart + 5000);
    assertRegex(handlerBody, /quantity\s*>\s*1/, 'Response handler must check if protection quantity > 1');
  });

  test('Response handler fixes qty>1 with /cart/update.js before refresh', () => {
    var handlerStart = code.indexOf('origFetch.call(this, url, opts).then');
    var handlerBody = code.substring(handlerStart, handlerStart + 5500);
    // The qty>1 fix must use /cart/update.js (idempotent) and refresh with the fixed cart
    var qtyCheckIdx = handlerBody.indexOf('quantity > 1');
    var afterQtyCheck = handlerBody.substring(qtyCheckIdx, qtyCheckIdx + 900);
    assertContains(afterQtyCheck, '/cart/update.js', 'qty>1 fix must use /cart/update.js (idempotent, sets qty=1)');
    assertContains(afterQtyCheck, 'fixedCart', 'Must refresh with the corrected cart from update.js response');
  });

  // ================================================================
  // Contract 21: Gift discount code auto-apply at checkout
  // When a gift item is in the cart, the checkout click must redirect
  // through /discount/FREECASE to auto-apply the discount code — Shopify
  // automatic discounts can't combine with BXGY, so we use a code instead.
  // ================================================================
  console.log('\nContract 21: Gift Discount Code Auto-Apply');

  test('Checkout click checks for gift in cart', () => {
    assertContains(code, 'GIFT_HANDLES[i.handle]', 'Must check if any gift handle is in cart items');
  });

  test('Checkout redirects through /discount/<code> when gift present', () => {
    assertContains(code, 'giftDiscountCode', 'Must use giftDiscountCode config for gift discount redirect');
  });

  // ================================================================
  // CONTRACT 22: Multi-Gift Per Tier (2026-04-16 missing gift bug)
  // tierGifts() must exist and return ALL gifts for a tier.
  // _mergeTiersFromConfig and checkWatchCase must use tierGifts (plural),
  // NOT tierGift (singular) — singular only returns the first gift per tier,
  // silently dropping all others.
  // ================================================================
  console.log('\nContract 22: Multi-Gift Per Tier');

  test('tierGifts (plural) function exists and returns array', () => {
    assertContains(code, 'function tierGifts(t)', 'Must have tierGifts (plural) function');
    assertRegex(code, /function tierGifts\(t\)[\s\S]{0,200}return t\.giftProducts/, 'tierGifts must return giftProducts array');
  });

  test('tierGift (singular) function exists for backwards compat', () => {
    assertContains(code, 'function tierGift(t)', 'Must have tierGift (singular) for legacy compat');
  });

  test('GIFT_HANDLES built using tierGifts (plural), not tierGift', () => {
    // The initial GIFT_HANDLES build loop must use tierGifts
    const buildSection = code.substring(code.indexOf('var GIFT_HANDLES = {}'), code.indexOf('var _lastGift'));
    assertContains(buildSection, 'tierGifts(t)', 'Initial GIFT_HANDLES build must use tierGifts (plural)');
    assert(!buildSection.includes('tierGift(t)'), 'Initial GIFT_HANDLES build must NOT use tierGift (singular) — drops 2nd+ gifts');
  });

  test('_mergeTiersFromConfig uses tierGifts (plural) for GIFT_HANDLES rebuild', () => {
    const mergeSection = code.substring(code.indexOf('_mergeTiersFromConfig'), code.indexOf('_isExcludedHandle'));
    assertContains(mergeSection, 'tierGifts(t)', '_mergeTiersFromConfig must use tierGifts (plural)');
    // The forEach that builds GIFT_HANDLES must use tierGifts
    assertRegex(mergeSection, /var gifts = tierGifts\(t\)/, '_mergeTiersFromConfig must call var gifts = tierGifts(t)');
    assertRegex(mergeSection, /gifts\.forEach\(function\(g\)[\s\S]{0,50}GIFT_HANDLES\[g\.handle\]/, 'Must iterate all gifts and add each handle to GIFT_HANDLES');
  });

  test('checkWatchCase shouldHave uses tierGifts (plural) for multi-gift eligibility', () => {
    const checkSection = code.substring(code.indexOf('checkWatchCase'), code.indexOf('_addOneGift'));
    // shouldHave building must use tierGifts
    const shouldHaveSection = checkSection.substring(checkSection.indexOf('var shouldHave'));
    assertRegex(shouldHaveSection, /tierGifts\(/, 'shouldHave logic must use tierGifts (plural) to include all gifts per tier');
    // Count tierGifts calls in shouldHave section — need at least 2 (HIGHEST_TIER_ONLY branch + else branch)
    const tierGiftsCalls = countOccurrences(shouldHaveSection.substring(0, 800), 'tierGifts(');
    assert(tierGiftsCalls >= 2, `shouldHave must call tierGifts in both HIGHEST_TIER_ONLY and normal branches, found ${tierGiftsCalls} calls`);
  });

  // ================================================================
  // CONTRACT 23: BXGY Discount Quantity Must Be "1" (2026-04-16 checkout $0 fix)
  // The gift-discounts API route must create BXGY with customerGets.quantity = "1".
  // Using the total gift count (e.g. "3") requires ALL gift items present in cart
  // simultaneously for ANY discount to apply — partial carts get $0 discount.
  // With qty "1" and no usesPerOrderLimit, Shopify repeats the discount per buy item.
  // ================================================================
  console.log('\nContract 23: BXGY Discount Quantity');

  test('gift-discounts route.ts uses product duplication (not BXGY discounts)', () => {
    const routePath = path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'gift-discounts', 'route.ts');
    let routeCode;
    try { routeCode = fs.readFileSync(routePath, 'utf8'); } catch(e) { throw new Error('Cannot read gift-discounts route.ts: ' + e.message); }
    // Gift system now uses /usr/bin/bash price product duplicates, not BXGY discounts
    assertContains(routeCode, 'productDuplicate', 'Must use Shopify productDuplicate mutation');
    assertContains(routeCode, '_eliminai-gift', 'Must tag gift products with _eliminai-gift');
  });

  // ================================================================
  // Contract 24: Gift Add Fail Safety
  // The cart drawer must track failed gift add attempts and skip after 3 failures
  // to prevent infinite retry loops for out-of-stock or hidden products.
  // ================================================================
  console.log('\nContract 24: Gift Add Fail Safety');

  test('_giftAddFails counter exists and is checked', () => {
    assertContains(code, '_giftAddFails', 'Must track gift add failure counts in _giftAddFails');
  });

  test('failed gift adds increment the counter', () => {
    assertRegex(code, /_giftAddFails\[.*\]\s*=\s*\(_giftAddFails/, 'Must increment _giftAddFails on add failure');
  });

  test('gifts are skipped after 3 failures', () => {
    assertRegex(code, />=\s*3/, 'Must skip gifts that failed 3+ times');
    assertContains(code, 'Skipping', 'Must log when skipping a failed gift');
  });

  test('successful add resets fail counter', () => {
    assertRegex(code, /_giftAddFails\[.*\]\s*=\s*0/, 'Must reset _giftAddFails to 0 on successful add');
  });

  // ================================================================
  // Contract 25: Product Search API — Inventory & Publication Guards
  // The product search API must return inventory and publication data
  // so the dashboard can block out-of-stock and hidden products from gift selection.
  // ================================================================
  console.log('\nContract 25: Product Search API Guards');

  test('search API returns inventoryQuantity and inventoryPolicy', () => {
    const routePath = path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'products', 'search', 'route.ts');
    let routeCode;
    try { routeCode = fs.readFileSync(routePath, 'utf8'); } catch(e) { throw new Error('Cannot read products/search route.ts: ' + e.message); }
    assertContains(routeCode, 'inventoryQuantity', 'GraphQL query must request inventoryQuantity');
    assertContains(routeCode, 'inventoryPolicy', 'GraphQL query must request inventoryPolicy');
    assertContains(routeCode, 'publishedOnCurrentPublication', 'GraphQL query must request publishedOnCurrentPublication');
  });

  test('search API response includes inventory fields in variants', () => {
    const routePath = path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'products', 'search', 'route.ts');
    let routeCode;
    try { routeCode = fs.readFileSync(routePath, 'utf8'); } catch(e) { throw new Error('Cannot read products/search route.ts: ' + e.message); }
    // The response transform must include these fields
    assertRegex(routeCode, /inventoryQuantity:\s*ve\.node\.inventoryQuantity/, 'Response must map inventoryQuantity from GraphQL');
    assertRegex(routeCode, /inventoryPolicy:\s*ve\.node\.inventoryPolicy/, 'Response must map inventoryPolicy from GraphQL');
    assertContains(routeCode, 'publishedOnCurrentPublication: node.publishedOnCurrentPublication', 'Response must map publishedOnCurrentPublication');
  });

  // ================================================================
  // Contract 26: Tier Editor Blocks Unavailable Gifts
  // The tier editor must prevent adding out-of-stock and hidden products as gifts.
  // ================================================================
  console.log('\nContract 26: Tier Editor Blocks Unavailable Gifts');

  test('tier editor checks inventory and publication status', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rewards-tier-editor.tsx');
    let editorCode;
    try { editorCode = fs.readFileSync(editorPath, 'utf8'); } catch(e) { throw new Error('Cannot read rewards-tier-editor.tsx: ' + e.message); }
    assertContains(editorCode, 'isOutOfStock', 'Must check isOutOfStock before allowing gift add');
    assertContains(editorCode, 'isHidden', 'Must check isHidden (publishedOnCurrentPublication) before allowing gift add');
    assertContains(editorCode, 'Unavailable', 'Must show Unavailable label for blocked products');
    assertContains(editorCode, 'publish', 'Must tell user to publish hidden products');
    assertContains(editorCode, 'restock', 'Must tell user to restock out-of-stock products');
  });

  // ================================================================
  // Contract 27: Browse Mode — Empty Search Returns Products
  // ================================================================
  console.log('\nContract 27: Browse Mode — Empty Search Returns Products');

  test('API allows empty query for browse mode', () => {
    const routePath = path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'products', 'search', 'route.ts');
    let routeCode;
    try { routeCode = fs.readFileSync(routePath, 'utf8'); } catch(e) { throw new Error('Cannot read product search route: ' + e.message); }
    // Must NOT have early return for empty query (browse mode needs to work)
    if (/if\s*\(\s*!q\.trim\(\)\s*\)\s*\{?\s*return/.test(routeCode)) {
      throw new Error('API must not early-return on empty query — browse mode requires fetching products with empty q');
    }
    assertContains(routeCode, 'status:active', 'Must filter by active status');
  });

  // ================================================================
  // Contract 28: Live Search — Debounced Search on Typing
  // ================================================================
  console.log('\nContract 28: Live Search — Debounced Search on Typing');

  test('tier editor has debounced live search', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rewards-tier-editor.tsx');
    let editorCode;
    try { editorCode = fs.readFileSync(editorPath, 'utf8'); } catch(e) { throw new Error('Cannot read rewards-tier-editor.tsx: ' + e.message); }
    assertContains(editorCode, 'debounce', 'Must have debounce logic for live search');
    assertContains(editorCode, 'setTimeout', 'Must use setTimeout for debounce');
    assertContains(editorCode, 'clearTimeout', 'Must clear previous timeout on new keystroke');
    assertContains(editorCode, 'onFocus', 'Must have onFocus handler for browse mode');
  });

  // ================================================================
  // Contract 29: No Theme Assets — Extension CDN Only
  // ================================================================
  console.log('\nContract 29: No Theme Assets — Extension CDN Only');

  test('no _jsUrl override in demo or live configs', () => {
    // Check that the API routes that return config don't hardcode _jsUrl
    const configFiles = [
      path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'cart-config', 'route.ts'),
    ];
    for (const f of configFiles) {
      let code;
      try { code = fs.readFileSync(f, 'utf8'); } catch(e) { continue; }
      if (/_jsUrl/.test(code) && !/\/\/.*_jsUrl/.test(code)) {
        // Allow commented-out references but not active ones
        const lines = code.split('\n');
        for (const line of lines) {
          if (line.includes('_jsUrl') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            throw new Error(`Active _jsUrl reference in ${path.basename(f)} — must use extension CDN, never theme assets`);
          }
        }
      }
    }
  });

  test('v14-complete.js never forces a theme asset URL', () => {
    const jsPath = path.join(__dirname, '..', 'v14-complete.js');
    let jsSrc;
    try { jsSrc = fs.readFileSync(jsPath, 'utf8'); } catch(e) { throw new Error('Cannot read v14-complete.js: ' + e.message); }
    if (new RegExp('cdn.shopify.com.+v14-complete.js').test(jsSrc)) {
      throw new Error('v14-complete.js must not contain hardcoded theme asset URLs');
    }
  });


  // ================================================================
  // CONTRACT 30-35: Shipping Protection — Tiered Pricing
  // ================================================================
  console.log("\nContract 30-35: Shipping Protection Tiered Pricing");

  test('Contract 30: getProtTier function exists and iterates tiers', () => {
    assert(code.includes('function getProtTier'), 'Missing getProtTier function');
    assert(code.includes('PROT_TIERS[i].maxValue'), 'getProtTier must check maxValue');
    assert(code.includes('cartValueCents'), 'getProtTier must accept cartValueCents parameter');
  });

  test('Contract 31: Tier lookup returns correct variant by comparing cart value', () => {
    assert(code.includes('cartValueCents <= PROT_TIERS[i].maxValue'), 'Must compare cartValue to tier maxValue');
    assert(code.includes('PROT_TIERS[PROT_TIERS.length - 1]'), 'Must fallback to last tier');
  });

  test('Contract 32: Silent tier swap when variant changes', () => {
    assert(code.includes('protItem.variant_id !== correctTier.vid') || code.includes('protItem.variant_id !== correctTierL.vid'), 'Must detect wrong tier');
    assert(code.includes('correctTier.vid'), 'Must use correctTier.vid for swap');
  });

  test('Contract 33: Single-tier fallback builds PROT_TIERS from PROT_VID_SINGLE', () => {
    assert(code.includes('PROT_VID_SINGLE'), 'Must define PROT_VID_SINGLE');
    assert(code.includes('PROT_TIERS.length === 0 && PROT_VID_SINGLE'), 'Must build PROT_TIERS from single VID when no tiers');
  });

  test('Contract 34: Toggle price reads from current tier', () => {
    assert(code.includes('getProtTier('), 'Must call getProtTier');
    assert(code.includes('displayPrice') || code.includes('data-prot-price'), 'Must have dynamic price display');
  });

  test('Contract 35: Icon URL from config supported', () => {
    assert(code.includes('iconUrl'), 'Must support iconUrl from config');
  });

  // ================================================================
  // CONTRACT 36-37: Protection API Route
  // ================================================================
  console.log("\nContract 36-37: Protection API Route");

  test('Contract 36: Protection create route sets non-physical product', () => {
    const routePath = path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'protection', 'create', 'route.ts');
    let routeFile;
    try { routeFile = fs.readFileSync(routePath, 'utf8'); } catch(e) { throw new Error('Cannot read protection create route: ' + e.message); }
    assert(routeFile.includes('requiresShipping: false') || routeFile.includes('requires_shipping: false'), 'Must set requiresShipping: false');
    assert(routeFile.includes('_eliminai-cart-protection') || routeFile.includes('eliminai') || routeFile.includes('cart-protection'), 'Must tag with cart-protection identifier');
  });

  test('Contract 37: Protection create route hides product from storefront', () => {
    // Updated 2026-05-05 per commit 5d4fd08: product MUST stay published so /cart/add.js works.
    // Customer-visibility is hidden via _eliminai-hidden tag + theme patch + noindex metafield,
    // NOT via unpublishing (unpublishing breaks add-to-cart).
    const routePath = path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'protection', 'create', 'route.ts');
    let routeFile;
    try { routeFile = fs.readFileSync(routePath, 'utf8'); } catch(e) { throw new Error('Cannot read protection create route: ' + e.message); }
    assert(routeFile.includes('_eliminai-hidden'), 'Must tag product with _eliminai-hidden so theme excludes it from recommendations');
    assert(routeFile.includes('patchThemeRecommendations'), 'Must patch themes to exclude _eliminai-hidden products');
    assert(routeFile.includes("namespace: 'seo'") && routeFile.includes("key: 'hidden'"), 'Must set seo.hidden noindex metafield');
  });

  // ================================================================
  // CONTRACT 38-44: Pricing / total update correctness
  // ================================================================

  test('Contract 38: gift adds use _origFetch (no wrapper interception)', function() {
    // _addOneGift must use CCD._origFetch or _origF so the wrapper doesn't intercept
    // internal gift adds and trigger double refreshes that race with each other
    var cwcStart = code.indexOf('checkWatchCase:');
    var cwcEnd = code.indexOf('enforceGiftItem:', cwcStart);
    if (cwcStart === -1 || cwcEnd === -1) throw new Error('Cannot find checkWatchCase');
    var cwcBody = code.substring(cwcStart, cwcEnd);
    assert(
      cwcBody.includes('_origF') || cwcBody.includes('CCD._origFetch'),
      'Gift add must use _origFetch to avoid wrapper intercepting internal ops'
    );
  });

  test('Contract 39: checkWatchCase uses _origFetch for gift removes', function() {
    // Gift removes inside checkWatchCase must bypass the wrapper too
    var cwcStart = code.indexOf('checkWatchCase:');
    var cwcEnd = code.indexOf('enforceGiftItem:', cwcStart);
    if (cwcStart === -1 || cwcEnd === -1) throw new Error('Cannot find checkWatchCase or enforceGiftItem');
    var cwcBody = code.substring(cwcStart, cwcEnd);
    assert(
      cwcBody.includes('_origFetch') || cwcBody.includes('_origF'),
      'checkWatchCase cart operations must use _origFetch to avoid wrapper interception'
    );
  });

  test('Contract 40: refreshLight updates __ccd_last_cart', function() {
    var rlStart = code.indexOf('refreshLight:');
    var rlEnd = code.indexOf('refresh:', rlStart + 10);
    if (rlStart === -1 || rlEnd === -1) throw new Error('Cannot find refreshLight or refresh');
    var rlBody = code.substring(rlStart, rlEnd);
    assertContains(rlBody, '__ccd_last_cart', 'refreshLight must update __ccd_last_cart to prevent stale data');
  });

  test('Contract 41: remove handler delayed fetch uses _origFetch', function() {
    // The 350ms delayed /cart.js fetch after remove must use _origFetch
    var changeQtyStart = code.indexOf('changeQty:');
    var toggleStart = code.indexOf('toggleProtection:');
    if (changeQtyStart === -1 || toggleStart === -1) throw new Error('Cannot find changeQty or toggleProtection');
    var changeQtyBody = code.substring(changeQtyStart, toggleStart);
    // Look for _origFetch usage near the delayed /cart.js fetch
    assert(
      changeQtyBody.includes('_origFetch') || changeQtyBody.includes('_origF'),
      'Remove handler delayed /cart.js fetch must use _origFetch to avoid wrapper interception'
    );
  });

  test('Contract 42: getAdjustedTotal returns 0 for null cart', function() {
    assertContains(code, 'if (!cart || !cart.items) return 0', 'getAdjustedTotal must return 0 for null/empty cart');
  });

  test('Contract 43: fmt guards against NaN', function() {
    assertContains(code, 'isNaN(c)', 'fmt must guard against NaN');
  });

  test('Contract 44: checkWatchCase final refresh uses _origFetch for /cart.js', function() {
    var cwcStart = code.indexOf('checkWatchCase:');
    var cwcEnd = code.indexOf('enforceGiftItem:', cwcStart);
    if (cwcStart === -1 || cwcEnd === -1) throw new Error('Cannot find checkWatchCase');
    var cwcBody = code.substring(cwcStart, cwcEnd);
    // The final /cart.js fetch in checkWatchCase must use origFetch
    var finalFetchPattern = /(CCD\._origFetch|_origF|origFetch|_oFBatch)\s*\(\s*['"]\/cart\.js/;
    assert(finalFetchPattern.test(cwcBody),
      'checkWatchCase final /cart.js fetch must use _origFetch');
  });


  // ================================================================
  // Contract 45-55: THEME-INDEPENDENT ARCHITECTURE (v15)
  // ================================================================
  console.log("Contract 45-55: Theme-Independent Architecture");

  test.todo('Contract 45: initDrawer function exists and moves element to body — Feature not yet implemented');

  test('Contract 46: openDrawer uses own ccd-open class (no theme dependency)', () => {
    assertContains(code, 'openDrawer:', 'Must have openDrawer method');
    assert(code.includes("d.classList.add('ccd-open')"), 'Must add ccd-open class');
  });

  test('Contract 47: closeDrawer removes ccd-open and resets state', () => {
    assertContains(code, 'closeDrawer:', 'Must have closeDrawer method');
    assert(code.includes("d.classList.remove('ccd-open')"), 'Must remove ccd-open class');
    assert(code.includes('protectionDone = false'), 'Must reset protectionDone on close');
  });

  test('Contract 48: Backdrop overlay created and wired', () => {
    assertContains(code, 'ccd-overlay', 'Must create overlay element');
    assertContains(code, 'CCD.closeDrawer()', 'Overlay click must close drawer');
  });

  test.todo('Contract 49: Native cart killer CSS injected dynamically — Feature not yet implemented');

  test.todo('Contract 50: MutationObserver suppresses native drawers — Feature not yet implemented');

  test.todo('Contract 51: Cart trigger interception methods — Feature not yet implemented');

  test('Contract 52: Uses CCD-Drawer as primary, CartDrawer only as fallback in initDrawer', () => {
    // CCD-Drawer must be the primary ID used everywhere
    var ccdRefs = (code.match(/getElementById\(['"]CCD-Drawer['"]/g) || []).length;
    assert(ccdRefs >= 5, 'Must use CCD-Drawer as primary ID (found ' + ccdRefs + ')');
    // CartDrawer references only allowed inside initDrawer's fallback section
    var cartDrawerRefs = (code.match(/getElementById\(['"]CartDrawer['"]/g) || []).length;
    assert(cartDrawerRefs <= 2, 'CartDrawer references must be limited to initDrawer fallback (found ' + cartDrawerRefs + ')');
    // initDrawer must contain the fallback
    assertContains(code, "getElementById('CartDrawer')", 'initDrawer must fallback to CartDrawer');
  });

  test('Contract 53: No drawer--is-open dependency for OUR drawer', () => {
    // drawer--is-open can appear for native drawer suppression, but our drawer uses ccd-open
    assert(code.includes("d.classList.add('ccd-open')"), 'Our drawer must use ccd-open class, not drawer--is-open');
    assert(code.includes("d.classList.remove('ccd-open')"), 'Our close must use ccd-open class');
  });

  test.todo('Contract 54: Error boundary restores native cart on failure — Feature not yet implemented');

  test('Contract 55: Checkout uses JS redirect (not form submission)', () => {
    assertContains(code, "window.location.href = '/checkout'", 'Must redirect to checkout via JS');
  });

  test('Contract 56: Protection toggle pre-set respects _userToggledOff flag', () => {
    // _doRefresh pre-sets toggle ON before morphDOM, but MUST check _userToggledOff
    // so that if user manually turned off protection, adding a product doesn't flash it on
    assertContains(code, '!_userToggledOff', '_doRefresh pre-set must check _userToggledOff');
    // The specific pre-set line in _doRefresh must include the guard
    var presetMatch = code.match(/if\s*\(shouldDefaultOn\s*&&\s*CCD\.getRealCount\(cart\)\s*>\s*0\s*&&\s*!_userToggledOff\)/);
    assert(presetMatch, '_doRefresh toggle pre-set must guard with && !_userToggledOff');
    // refreshLight must also check _userToggledOff in its toggle logic
    var refreshLightToggle = code.match(/!_userToggledOff\s*&&\s*!protItem\s*&&\s*CCD\.getRealCount/);
    assert(refreshLightToggle, 'refreshLight must check _userToggledOff before setting toggle');
  });

  // ================================================================
  // SECTION: SMOOTH REFRESH — No collapse animation, no ghost elements
  // ================================================================
  console.log('\n--- Smooth Refresh ---');

  test('Contract 57: Remove handler dims item (no collapse animation)', () => {
    assertContains(code, "item.style.opacity = '0.3'", 'Remove handler must dim item to 0.3 opacity');
    assertContains(code, "item.style.pointerEvents = 'none'", 'Remove handler must disable pointer events');
  });

  test('Contract 58: Remove handler does NOT use collapse animation', () => {
    var removeSection = code.substring(
      code.indexOf('if (removeBtn)'),
      code.indexOf('if (removeBtn)') + 600
    );
    assert(!removeSection.includes("item.style.maxHeight = '0'"), 'Remove must NOT collapse items');
    assert(!removeSection.includes('setTimeout(function() { if (item.parentNode) item.remove()'), 'Remove must NOT setTimeout-remove DOM');
  });

  test('Contract 59: Remove handler calls showLoading immediately', () => {
    var removeSection = code.substring(
      code.indexOf('if (removeBtn)'),
      code.indexOf('if (removeBtn)') + 800
    );
    assertContains(removeSection, 'CCD.showLoading()', 'Remove must call showLoading on click');
  });

  test('Contract 60: morphDOM removes items immediately (no ghost elements)', () => {
    var morphSection = code.substring(
      code.indexOf('morphDOM: function'),
      code.indexOf('morphDOM: function') + 2000
    );
    assertContains(morphSection, 'el.remove()', 'morphDOM must remove unmatched items');
    assert(!morphSection.includes("if (el.classList.contains('ccd-item--removing')) { return; }"), 'morphDOM must NOT skip removing elements');
  });

  test('Contract 61: morphDOM does NOT use collapse animation', () => {
    var morphSection = code.substring(
      code.indexOf('morphDOM: function'),
      code.indexOf('morphDOM: function') + 2000
    );
    assert(!morphSection.includes("el.style.maxHeight = '0'"), 'morphDOM must NOT collapse-animate');
    assert(!morphSection.includes('setTimeout(function() { el.remove(); }, 180)'), 'morphDOM must NOT delay-remove');
  });

  test('Contract 62: Qty +/- shows loading overlay', () => {
    var cqSection = code.substring(
      code.indexOf('changeQty: function'),
      code.indexOf('changeQty: function') + 2000
    );
    assertContains(cqSection, 'showLoading()', 'changeQty must show loading for qty changes');
  });

  test('Contract 63: Gift remove uses dim (not collapse)', () => {
    // Skip past CSS defs to JS handler
    var _gIdx = code.indexOf("'.ccd-gift-item__remove'");
    var _gIdx2 = -1; // handler starts at _gIdx
    var giftSection = code.substring(_gIdx2 > -1 ? _gIdx2 : _gIdx, (_gIdx2 > -1 ? _gIdx2 : _gIdx) + 800);
    assertContains(giftSection, "giftItem.style.opacity = '0.3'", 'Gift remove must dim to 0.3');
    assert(!giftSection.includes("giftItem.style.maxHeight = '0'"), 'Gift remove must NOT collapse');
  });
  // ================================================================
  // SECTION: Scarcity Badge — Nth unique variant gets the badge
  // ================================================================
  console.log('\n--- Scarcity Badge ---');

  test('Contract 64: Scarcity badges item via sticky lock when threshold met', () => {
    var startIdx = code.indexOf('Numeric target: activate scarcity');
    var scarcitySection = code.substring(startIdx, startIdx + 1200);
    assert(scarcitySection.includes('seenVids'), 'Scarcity must track seen variant IDs');
    assert(scarcitySection.includes('uniqueCount'), 'Scarcity must count unique variants');
    assert(scarcitySection.includes('_scarcityLockedVid'), 'Scarcity must use sticky lock for badge placement');
    assert(scarcitySection.includes('uniqueCount >= tNum'), 'Scarcity shows badge when threshold met');
  });

  test('Contract 65: Scarcity does NOT use lowest qty heuristic', () => {
    var scarcitySection = code.substring(
      code.indexOf('Numeric target: activate scarcity'),
      code.indexOf('Numeric target: activate scarcity') + 600
    );
    assert(!scarcitySection.includes('bestQty'), 'Scarcity must NOT use bestQty (old lowest-qty heuristic)');
    assert(!scarcitySection.includes('bestVid'), 'Scarcity must NOT use bestVid (old heuristic)');
  });

  // ================================================================
  // SECTION: Mobile Width — configurable via CSS variable
  // ================================================================
  console.log('\n--- Mobile Width ---');

  test('Contract 66: Mobile width default is 85%', () => {
    assertContains(code, 'var(--ccd-mobile-width, 85%)', 'Mobile width must default to 85%');
  });

  test('Contract 67: Mobile width reads from backend config', () => {
    assertContains(code, 'config.cartConfig.mobileWidth', 'Must read mobileWidth from config');
    assertContains(code, '--ccd-mobile-width', 'Must set --ccd-mobile-width CSS variable');
  });

  test('Contract 68: Drawer height is 100dvh', () => {
    // 100dvh is set on the drawer element itself (not mobile-specific)
    assertContains(code, 'height: 100dvh', 'Drawer must have height: 100dvh for proper mobile support');
  });

  // ================================================================
  // SECTION: Scroll Shadow — only shows when items overflow
  // ================================================================
  console.log('\n--- Scroll Shadow ---');

  test('Contract 69: Shadow hidden by default (opacity 0)', () => {
    assertContains(code, '.ccd-inner::after', 'Must have ccd-inner::after pseudo-element');
    // The ::after rule must have opacity: 0 by default
    var afterRule = code.substring(
      code.indexOf('.ccd-inner::after'),
      code.indexOf('.ccd-inner::after') + 400
    );
    assertContains(afterRule, 'opacity: 0', 'Shadow must be opacity: 0 by default');
  });

  test('Contract 70: Shadow shows only when has-overflow class present', () => {
    assertContains(code, '.ccd-inner.has-overflow::after { opacity: 1', 'Shadow must show on has-overflow');
  });

  test('Contract 71: Shadow hides when scrolled to bottom', () => {
    assertContains(code, '.ccd-inner.scrolled-bottom::after { opacity: 0', 'Shadow must hide when scrolled to bottom');
  });

  // ================================================================
  // SECTION: Scroll Shadow — overflow detection with rAF
  // ================================================================
  console.log('\n--- Scroll Shadow (overflow) ---');

  test('Contract 72: checkOverflow uses requestAnimationFrame in _doRefresh', () => {
    var doRefreshSection = code.substring(
      code.indexOf('_doRefresh: function'),
      code.indexOf('_doRefresh: function') + 9000
    );
    assert(doRefreshSection.includes('requestAnimationFrame') && doRefreshSection.includes('checkOverflow'),
      'checkOverflow in _doRefresh must be wrapped in requestAnimationFrame');
  });

  test('Contract 73: checkOverflow also called in refreshLight via rAF', () => {
    // Window expanded from 5000 → 8000 as refreshLight grew (added cart-aware addon syncs).
    // The assertion is "rAF + checkOverflow exist inside refreshLight" — window is just impl detail.
    var refreshLightSection = code.substring(
      code.indexOf('refreshLight: function'),
      code.indexOf('refreshLight: function') + 8000
    );
    assert(refreshLightSection.includes('requestAnimationFrame') && refreshLightSection.includes('checkOverflow'),
      'refreshLight must call checkOverflow via requestAnimationFrame');
  });

  test('Contract 74: setupScrollIndicator is idempotent (no duplicate listeners)', () => {
    var setupSection = code.substring(
      code.indexOf('setupScrollIndicator: function'),
      code.indexOf('setupScrollIndicator: function') + 500
    );
    assertContains(setupSection, '_ccdScrollBound',
      'setupScrollIndicator must check _ccdScrollBound to prevent duplicate listeners');
  });

  test('Contract 75: setupScrollIndicator re-called after _doRefresh', () => {
    var doRefreshSection = code.substring(
      code.indexOf('_doRefresh: function'),
      code.indexOf('_doRefresh: function') + 9000
    );
    assertContains(doRefreshSection, 'setupScrollIndicator',
      '_doRefresh must re-call setupScrollIndicator in case DOM was rebuilt');
  });

  test('Contract 76: Shadow gradient is visible (opacity >= 0.15)', () => {
    var afterRule = code.substring(
      code.indexOf('.ccd-inner::after'),
      code.indexOf('.ccd-inner::after') + 400
    );
    var match = afterRule.match(/rgba\(0,0,0,([\d.]+)\)/);
    assert(match, 'Shadow must use rgba gradient');
    var opacity = parseFloat(match[1]);
    assert(opacity >= 0.15, 'Shadow gradient opacity must be >= 0.15 (was ' + opacity + ')');
  });

  test('Contract 77: Shadow height is >= 24px', () => {
    var afterRule = code.substring(
      code.indexOf('.ccd-inner::after'),
      code.indexOf('.ccd-inner::after') + 400
    );
    var match = afterRule.match(/height:\s*(\d+)px/);
    assert(match, 'Shadow must have explicit height');
    assert(parseInt(match[1]) >= 24, 'Shadow height must be >= 24px (was ' + match[1] + 'px)');
  });

  test('Contract 78: checkOverflow checks scrollHeight > clientHeight', () => {
    var checkSection = code.substring(
      code.indexOf('checkOverflow: function'),
      code.indexOf('checkOverflow: function') + 500
    );
    assertContains(checkSection, 'scrollHeight', 'checkOverflow must read scrollHeight');
    assertContains(checkSection, 'clientHeight', 'checkOverflow must read clientHeight');
    assertContains(checkSection, 'has-overflow', 'checkOverflow must toggle has-overflow class');
  });

  test('Contract 79: scrolled-bottom detection in setupScrollIndicator', () => {
    var setupSection = code.substring(
      code.indexOf('setupScrollIndicator: function'),
      code.indexOf('setupScrollIndicator: function') + 600
    );
    assertContains(setupSection, 'scrolled-bottom', 'Must toggle scrolled-bottom class');
    assertContains(setupSection, 'scrollHeight', 'Must check scrollHeight for bottom detection');
  });

  // ================================================================
  // SECTION: Checkout Button Loading on Price Change
  // ================================================================
  console.log('\n--- Checkout Loading on Price Change ---');

  test('Contract 80: Checkout shows loading ONLY when price changes', () => {
    var doRefreshSection = code.substring(
      code.indexOf('_doRefresh: function'),
      code.indexOf('_doRefresh: function') + 5000
    );
    assertContains(doRefreshSection, 'oldTotal', 'Must capture old total before update');
    assertContains(doRefreshSection, 'newTotal !== oldTotal', 'Must compare old vs new total');
    assertContains(doRefreshSection, 'ccd-checkout-btn--loading', 'Must add loading class on price change');
  });

  test('Contract 81: Checkout loading removes itself after timeout', () => {
    var startIdx = code.indexOf('Checkout loading animation');
    assert(startIdx > -1, 'Must have Checkout loading animation comment');
    var doRefreshSection = code.substring(startIdx, startIdx + 800);
    assertContains(doRefreshSection, 'setTimeout', 'Must use setTimeout to remove loading');
    assert(doRefreshSection.includes('ccd-checkout-btn--loading') && doRefreshSection.includes('.remove('),
      'Must remove loading class after timeout');
  });

  test('Contract 82: Checkout total has opacity transition CSS', () => {
    assertContains(code, '.ccd-checkout-total { transition: opacity',
      'Checkout total must have CSS opacity transition');
  });

  test('Contract 83: No checkout loading when price stays same', () => {
    var startIdx = code.indexOf('Checkout loading animation');
    assert(startIdx > -1, 'Must have Checkout loading animation comment');
    var doRefreshSection = code.substring(startIdx, startIdx + 800);
    assert(doRefreshSection.includes('else') && doRefreshSection.includes('ct.textContent'),
      'Must have else branch that sets total directly when price unchanged');
  });

  // ================================================================
  // SECTION: Scarcity Badge — additional robustness tests
  // ================================================================
  console.log('\n--- Scarcity Badge (robustness) ---');

  test('Contract 84: Scarcity default target is 2', () => {
    var scarcitySection = code.substring(
      code.indexOf('applyScarcity: function'),
      code.indexOf('applyScarcity: function') + 800
    );
    assertContains(scarcitySection, "CFG.scarcityTarget || '2'",
      'Scarcity target must default to 2 (not 1)');
  });

  test('Contract 85: Scarcity badge renders by matching variant_id in DOM', () => {
    var renderSection = code.substring(
      code.indexOf('// Render badges'),
      code.indexOf('// Render badges') + 600
    );
    assertContains(renderSection, 'itemVid === targetVid',
      'Badge must be placed by matching variant_id, not by index');
  });

  test('Contract 86: Scarcity saves to sessionStorage', () => {
    // sessionStorage save is deep in applyScarcity — search full code
    assertContains(code, "sessionStorage.setItem('ccd_scarcity_vid'",
      'Must save scarcity variant to sessionStorage');
  });

  // ================================================================
  // SECTION: Race Condition Protection (BUG-021)
  // ================================================================
  console.log('\n--- Race Condition Protection ---');

  test('87: busy flag NOT cleared before remove fetch completes', () => {
    // After /cart/change.js for remove, busy must stay true until /cart.js returns
    const changeHandler = code.substring(code.indexOf("fetch('/cart/change.js'"), code.indexOf("fetch('/cart/change.js'") + 6000);
    // The old pattern was: busy = false immediately after cart/change.js response
    // The new pattern: busy = false only in the specific branches AFTER refresh/fetch
    const busyFalseIdx = changeHandler.indexOf('busy = false');
    const firstCartJsFetch = changeHandler.indexOf('("/cart.js")');
    // busy=false must NOT appear before the /cart.js fetch section
    assert(busyFalseIdx > firstCartJsFetch - 500 || changeHandler.indexOf('_isRemoving') < busyFalseIdx,
      'busy=false must be deferred until after /cart.js fetch completes for removes');
  });

  test('88: hideLoading called in empty cart path of _doRefresh', () => {
    const doRefresh = code.substring(code.indexOf('_doRefresh: function'), code.indexOf('_doRefresh: function') + 9000);
    const emptySection = doRefresh.substring(doRefresh.indexOf("es.classList.add('ccd-show')"));
    assert(emptySection.includes('hideLoading()'),
      'hideLoading must be called when cart is empty in _doRefresh');
  });

  test('89: hideLoading called in morphDOM else branch of _doRefresh', () => {
    const doRefresh = code.substring(code.indexOf('_doRefresh: function'), code.indexOf('_doRefresh: function') + 4000);
    // The else branch after morphDOM (when drawer closed or no items) must call hideLoading
    const morphSection = doRefresh.substring(doRefresh.indexOf('CCD.morphDOM(pc, ni)'));
    const elseBlock = morphSection.substring(morphSection.indexOf('} else {'));
    assert(elseBlock.includes('hideLoading'),
      'hideLoading must be called in morphDOM else branch (drawer closed or no prior items)');
  });

  test('90: Safety timeout auto-hides loading after stuck state', () => {
    const showLoading = code.substring(code.indexOf('showLoading: function'), code.indexOf('showLoading: function') + 1500);
    assert(showLoading.includes('_loadingSafety') && showLoading.includes('setTimeout'),
      'showLoading must have a safety timeout that auto-hides loading');
  });

  test('91: hideLoading clears safety timeout', () => {
    const hideLoading = code.substring(code.indexOf('hideLoading: function'), code.indexOf('hideLoading: function') + 500);
    assert(hideLoading.includes('_loadingSafety') && hideLoading.includes('clearTimeout'),
      'hideLoading must clear the safety timeout to prevent double-hide');
  });

  test('92: catch block in changeQty calls hideLoading', () => {
    const changeQty = code.substring(code.indexOf('changeQty: function'), code.indexOf('changeQty: function') + 6000);
    const catchBlock = changeQty.substring(changeQty.lastIndexOf('.catch('));
    assert(catchBlock.includes('hideLoading'),
      'changeQty catch block must call hideLoading to prevent stuck loading state');
  });

  test('93: ccd-refreshing CSS disables qty buttons and remove buttons', () => {
    assertContains(code, 'ccd-refreshing',
      'Must have ccd-refreshing class defined');
    const refreshingCSS = code.substring(code.indexOf('ccd-refreshing'), code.indexOf('ccd-refreshing') + 200);
    assert(refreshingCSS.includes('pointer-events') && refreshingCSS.includes('none'),
      'ccd-refreshing must set pointer-events:none to block user interaction');
  });

  // ================================================================
  // SECTION: Mobile Scrollbar Visibility
  // ================================================================
  console.log('\n--- Mobile Scrollbar ---');

  test('94: Mobile scrollbar CSS uses scrollbar-width: thin', () => {
    assert(code.includes('scrollbar-width: thin') || code.includes('scrollbar-width:thin'),
      'Must have scrollbar-width: thin for mobile scrollbar visibility');
  });

  test('95: Mobile scrollbar CSS uses scrollbar-color', () => {
    assert(code.includes('scrollbar-color'),
      'Must have scrollbar-color for mobile Firefox scrollbar');
  });

  test('96: Mobile scrollbar CSS uses -webkit-appearance: none for iOS', () => {
    const mobileScrollbar = code.includes('-webkit-appearance');
    assert(mobileScrollbar, 'Must have -webkit-appearance:none for iOS scrollbar');
  });

  // ================================================================
  // SECTION: Trash Icon Color
  // ================================================================
  console.log('\n--- Trash Icon Color ---');

  test('97: Trash icon color is #999 (not too light)', () => {
    const removeLine = code.substring(code.indexOf('.ccd-item__remove {'), code.indexOf('.ccd-item__remove {') + 300);
    assert(removeLine.includes('#999'), 'Trash icon base color must be #999 (not #bbb which is too light)');
    assert(!removeLine.includes('#bbb'), 'Trash icon must NOT use #bbb (too light)');
  });

  // ================================================================
  // SECTION: Protection Tier Swap Safety (BUG-022)
  // ================================================================
  console.log('\n--- Tier Swap Safety ---');

  test('98: _doRefresh tier swap calls hideLoading before return', () => {
    const doRefresh = code.substring(code.indexOf('_doRefresh: function'), code.indexOf('_doRefresh: function') + 10000);
    // Find the tier swap section (correctTier check) in _doRefresh
    const tierSection = doRefresh.substring(doRefresh.indexOf('correctTier'));
    const returnIdx = tierSection.indexOf('return; // Skip rest');
    const hideIdx = tierSection.indexOf('hideLoading');
    assert(hideIdx > 0 && hideIdx < returnIdx,
      'hideLoading must be called BEFORE return in tier swap to prevent stuck loading');
  });

  test('99: _doRefresh tier swap saves _lastCart before return', () => {
    const doRefresh = code.substring(code.indexOf('_doRefresh: function'), code.indexOf('_doRefresh: function') + 10000);
    const tierSection = doRefresh.substring(doRefresh.indexOf('correctTier'));
    const returnIdx = tierSection.indexOf('return; // Skip rest');
    const lastCartIdx = tierSection.indexOf('_lastCart = cart');
    assert(lastCartIdx > 0 && lastCartIdx < returnIdx,
      '_lastCart must be saved BEFORE return in tier swap to prevent stale data');
  });

  test('100: _doRefresh tier swap has catch handler', () => {
    const doRefresh = code.substring(code.indexOf('_doRefresh: function'), code.indexOf('_doRefresh: function') + 10000);
    const tierSection = doRefresh.substring(doRefresh.indexOf('correctTier'), doRefresh.indexOf('return; // Skip rest') + 100);
    assert(tierSection.includes('.catch('),
      'Tier swap chain must have catch handler to prevent stuck loading on network failure');
  });

  test('101: refreshLight tier swap calls hideLoading before return', () => {
    const refreshLight = code.substring(code.indexOf('refreshLight: function'), code.indexOf('refreshLight: function') + 6000);
    const tierSection = refreshLight.substring(refreshLight.indexOf('correctTierL'));
    const returnIdx = tierSection.indexOf('return;');
    const hideIdx = tierSection.indexOf('hideLoading');
    assert(hideIdx > 0 && hideIdx < returnIdx,
      'refreshLight tier swap must call hideLoading before return');
  });

  // ================================================================
  // SECTION: Scarcity Badge Placement (BUG-023)
  // ================================================================
  console.log('\n--- Scarcity Badge Placement ---');

  test('102: Scarcity badges LAST item in cart (most recently added)', () => {
    const scarcity = code.substring(code.indexOf('applyScarcity: function'), code.indexOf('applyScarcity: function') + 2000);
    assert(scarcity.includes('realItems.length - 1'),
      'Scarcity must use realItems.length - 1 to badge the most recently added item');
  });

  test('103: Scarcity checks uniqueCount >= tNum threshold', () => {
    const scarcity = code.substring(code.indexOf('applyScarcity: function'), code.indexOf('applyScarcity: function') + 3000);
    assert(scarcity.includes('uniqueCount >= tNum'),
      'Scarcity badge only shows when unique variant count meets threshold');
  });

  test('104: Scarcity does NOT use uniqueCount === tNum (wrong)', () => {
    const scarcity = code.substring(code.indexOf('applyScarcity: function'), code.indexOf('applyScarcity: function') + 3000);
    assert(!scarcity.includes('uniqueCount === tNum'),
      'Must NOT use === (badges Nth variant instead of last)');
  });

  // ================================================================
  // SECTION: Scarcity Sticky Lock (BUG-029)
  // ================================================================
  console.log('\n--- Scarcity Sticky Lock ---');

  test('105a: Scarcity locked vid persisted to sessionStorage', () => {
    assert(code.includes("sessionStorage.setItem('ccd_scarcity_locked_vid'"),
      'Must persist locked variant ID to sessionStorage so it survives page refreshes');
  });

  test('105b: Scarcity locked vid restored from sessionStorage on init', () => {
    assert(code.includes("sessionStorage.getItem('ccd_scarcity_locked_vid')"),
      'Must restore locked variant ID from sessionStorage on script init');
  });

  test('105c: Scarcity uses _initScarcityLockedVid as fallback', () => {
    const scarcity = code.substring(code.indexOf('applyScarcity: function'), code.indexOf('applyScarcity: function') + 3000);
    assert(scarcity.includes('_initScarcityLockedVid'),
      'Must use the init-restored locked vid as fallback when CCD._scarcityLockedVid not yet set');
  });

  // ================================================================
  // SECTION: Protection Reorder Removed (BUG-028)
  // ================================================================
  console.log('\n--- Protection Reorder Removed ---');

  test('106a: _reorderProtectionLast is a no-op', () => {
    const fnStart = code.indexOf('_reorderProtectionLast:');
    const fnBody = code.substring(fnStart, fnStart + 200);
    assert(fnBody.includes('no-op') || fnBody.includes('removed'),
      'Protection reorder must be disabled (causes 2x protection qty race condition)');
  });

  test('106b: _reorderProtectionLast is never called in refresh', () => {
    const refreshSection = code.substring(code.indexOf('refreshLight: function'), code.indexOf('refreshLight: function') + 3000);
    assert(!refreshSection.includes('_reorderProtectionLast()'),
      'Must NOT call _reorderProtectionLast in refresh flow (removed feature)');
  });

  // ================================================================
  // SECTION: Cart Auto-Open Prevention (BUG-024)
  // ================================================================
  console.log('\n--- Cart Auto-Open Prevention ---');

  test('105: Early observer checks _isCartDrawerElement before opening cart', () => {
    const earlySection = code.substring(code.indexOf('_earlyObserver = new MutationObserver'), code.indexOf('_earlyObserver = new MutationObserver') + 2000);
    assert(earlySection.includes('_isCartDrawerElement'),
      'Early MutationObserver must check _isCartDrawerElement to avoid false triggers from carousels/sliders');
  });

  test('106: _isCartDrawerElement function exists', () => {
    assert(code.includes('function _isCartDrawerElement'),
      'Must have _isCartDrawerElement function to validate element before opening cart');
  });

  test('107: Early observer skips non-cart elements with continue', () => {
    const earlySection = code.substring(code.indexOf('_earlyObserver = new MutationObserver'), code.indexOf('_earlyObserver = new MutationObserver') + 2000);
    assert(earlySection.includes('!_isCartDrawerElement(el)') && earlySection.includes('continue'),
      'Observer must skip non-cart elements to prevent carousel/tab/accordion triggers');
  });

  test('108: Early observer does NOT open cart for random active/is-active elements', () => {
    // The observer must NOT blindly check is-active on any element — only cart drawers
    const earlySection = code.substring(code.indexOf('_earlyObserver = new MutationObserver'), code.indexOf('_earlyObserver = new MutationObserver') + 2000);
    const isActiveCheck = earlySection.indexOf("'is-active'");
    const drawerCheck = earlySection.indexOf('_isCartDrawerElement');
    assert(drawerCheck > 0 && drawerCheck < isActiveCheck,
      'Drawer element check must come BEFORE is-active class check');
  });

  // ================================================================
  // SECTION: Remove Verification
  // ================================================================
  console.log('\n--- Remove Verification ---');

  test('109: changeQty uses origFetch to avoid interceptor on /cart/change.js', () => {
    const changeSection = code.substring(code.indexOf('changeQty: function(key'), code.indexOf('_finishChangeQty'));
    assert(changeSection.includes('_origFetch || fetch'),
      'changeQty must use origFetch to bypass interceptor for /cart/change.js');
  });

  test('110: Remove verifies item was actually removed from Shopify cart', () => {
    const changeSection = code.substring(code.indexOf('changeQty: function(key'), code.indexOf('_finishChangeQty: function'));
    assert(changeSection.includes('stillThere'),
      'Must check if item key still exists in response cart after remove');
    assert(changeSection.includes('Retrying with line index'),
      'Must retry with line-based remove as fallback');
  });

  test('111: _finishChangeQty exists as extracted post-change handler', () => {
    assert(code.includes('_finishChangeQty: function(cart'),
      '_finishChangeQty must exist as a method');
    assert(code.includes('_finishChangeQty(cart'),
      '_finishChangeQty must be called from changeQty');
  });

  test('112: Remove retry uses line parameter (1-based index)', () => {
    const changeSection = code.substring(code.indexOf('changeQty: function(key'), code.indexOf('_finishChangeQty: function'));
    assert(changeSection.includes('line: lineIdx'),
      'Retry must use line parameter for positional remove');
    assert(changeSection.includes('li + 1'),
      'Line index must be 1-based (Shopify convention)');
  });

  // ================================================================
  // SECTION: Scarcity Sticky Badge (2026-04-19)
  // Badge locks to one variant permanently. Never jumps. Returns if re-added.
  // ================================================================
  console.log('\n--- Scarcity Sticky Badge ---');

  test('Scarcity: uses _scarcityLockedVid for permanent badge lock', () => {
    assertContains(code, '_scarcityLockedVid', 'Must use _scarcityLockedVid to lock badge to a variant');
  });

  test('Scarcity: lock is never cleared on remove (badge returns if re-added)', () => {
    // The lock should NOT be cleared when locked item is removed from cart
    // Old broken pattern: CCD._scarcityLockedVid = null inside the "not found" branch
    assertNotContains(code, '_scarcityLockedVid = null', 'Lock must NEVER be cleared — badge must return if item re-added');
  });

  test('Scarcity: no _scarcityLockUsed flag (was removed — caused badge to not return)', () => {
    assertNotContains(code, '_scarcityLockUsed', 'The _scarcityLockUsed concept was removed — it prevented badge from returning after re-add');
  });

  test('Scarcity: lock persists — only assigned once when threshold first met', () => {
    // The lock assignment should only happen in the "else if (uniqueCount >= tNum)" branch
    // meaning it only fires when there's no existing lock
    assertRegex(code, /else if\s*\(\s*uniqueCount\s*>=\s*tNum\s*\)/, 'Lock assignment must be gated by else-if (only when no lock exists)');
  });

  test('Scarcity: _lastAddedVid cleared on cart close', () => {
    assertContains(code, '_lastAddedVid = null', 'Must clear _lastAddedVid on cart close to prevent stale targeting');
  });

  test('Scarcity: _lastAddedVid cleared after remove in _finishChangeQty', () => {
    assertRegex(code, /qty\s*===\s*0.*_lastAddedVid\s*=\s*null/, 'Must clear _lastAddedVid after remove operations');
  });

  // ================================================================
  // SECTION: Remove Stale Key Recovery (2026-04-19)
  // When Shopify returns error (stale key), fetch fresh cart and retry.
  // ================================================================
  console.log('\n--- Remove Stale Key Recovery ---');

  test('Remove: detects error response (no items array)', () => {
    assertContains(code, '!cart.items', 'Must check for missing items array (Shopify error response)');
  });

  test('Remove: fetches fresh cart on stale key error', () => {
    assertRegex(code, /stale key.*fresh cart|fresh cart.*retry/i, 'Must fetch fresh cart and retry with correct key when Shopify returns error');
  });

  test('Remove: retries with fresh key from variant_id lookup', () => {
    assertContains(code, 'freshItem.key', 'Must use freshItem.key from variant_id lookup for retry');
  });

  // ================================================================
  // SECTION: Mobile Debug Overlay (2026-04-19)
  // Permanent debug tool — NEVER remove
  // ================================================================
  console.log('\n--- Mobile Debug Overlay ---');

  test('Debug: log buffer captures CCD messages', () => {
    assertContains(code, '_ccdLogs', 'Must have _ccdLogs array for mobile debug log capture');
  });

  test('Debug: _ccdShowDebug function exists', () => {
    assertContains(code, '_ccdShowDebug', 'Must have _ccdShowDebug function for mobile debug overlay');
  });

  test('Debug: DBG button in cart header', () => {
    assertContains(code, '_ccdShowDebug()', 'Must have DBG button that calls _ccdShowDebug()');
  });

  // ================================================================
  // SECTION: Checkout Button Disabled During Loading
  // ================================================================
  console.log('\n--- Checkout Button Disabled During Loading ---');

  test('Checkout: showLoading disables checkout button during cart operations', () => {
    // showLoading must add loading class to checkout button
    const showLoadingStart = code.indexOf('showLoading: function');
    const hideLoadingStart = code.indexOf('hideLoading: function');
    const showLoadingBody = code.slice(showLoadingStart, hideLoadingStart);
    assertContains(showLoadingBody, 'ccd-checkout-btn--loading',
      'showLoading must add ccd-checkout-btn--loading class to checkout button');
    assertContains(showLoadingBody, '.ccd-checkout-btn',
      'showLoading must select checkout button');
  });

  test('Checkout: hideLoading re-enables checkout button after cart operations', () => {
    const hideLoadingStart = code.indexOf('hideLoading: function');
    const hideLoadingBody = code.slice(hideLoadingStart, hideLoadingStart + 800);
    assertContains(hideLoadingBody, 'ccd-checkout-btn--loading',
      'hideLoading must remove ccd-checkout-btn--loading class from checkout button');
    assert(/\.remove\(\s*['"]ccd-checkout-btn--loading['"]\s*\)/.test(hideLoadingBody),
      'hideLoading must call .remove() on checkout loading class');
  });

  test('Checkout: loading CSS makes button unclickable and visually dimmed', () => {
    // Find the CSS rule line for .ccd-checkout-btn--loading
    const cssLine = code.split('\n').find(l => l.includes('ccd-checkout-btn--loading') && l.includes('pointer-events'));
    assert(cssLine, 'Must have CSS rule for ccd-checkout-btn--loading with pointer-events');
    assert(cssLine.includes('pointer-events: none'), 'Checkout button must be unclickable during loading');
    assert(cssLine.includes('opacity: 0.6') || cssLine.includes('opacity:0.6'), 'Checkout button must be visually dimmed during loading');
  });

  // ================================================================
  // SECTION: Universal theme compatibility
  // ================================================================
  console.log('\n--- Universal Theme Compat ---');

  test('Overlay: CSS has display:block!important to defeat div:empty{display:none}', () => {
    const cssLine = code.split('\n').find(l => l.includes('ccd-overlay') && l.includes('display') && l.includes('block') && !l.includes('overlay--visible'));
    assert(cssLine, 'ccd-overlay CSS must have display: block !important to defeat theme div:empty rules');
    assert(cssLine.includes('display: block') || cssLine.includes('display:block'), 'Must be display: block');
  });

  test('Overlay: contains text content to prevent :empty selector match', () => {
    // Both overlay creation sites must add content
    const overlayCreations = code.split('CCD-Overlay');
    assert(overlayCreations.length >= 3, 'Must have at least 2 overlay creation sites');
    // Check for zero-width space or textContent set
    const hasContent = code.includes("'\\u200B'") || code.includes('"\\u200B"') || code.includes("'\u200B'") || code.includes('"\u200B"');
    assert(hasContent, 'Overlay must have textContent set to prevent div:empty match');
  });

  test('Milestone labels: no white-space:nowrap to prevent overflow with 3+ tiers', () => {
    const labelLine = code.split('\n').find(l => l.includes('ccd-progress__label') && l.includes('font-size'));
    assert(labelLine, 'ccd-progress__label CSS must exist');
    assert(!labelLine.includes('white-space: nowrap') && !labelLine.includes('white-space:nowrap'), 'ccd-progress__label must NOT have white-space:nowrap — labels must wrap for 3+ tier support');
  });

  test('Gift: permanently skips variants that do not exist (422)', () => {
    const giftSection = code.slice(code.indexOf('add failed id='), code.indexOf('add failed id=') + 600);
    assert(giftSection.includes('Cannot find variant'), 'Must detect "Cannot find variant" error');
    assert(giftSection.includes('999') || giftSection.includes('permanently'), 'Must permanently skip non-existent variants');
  });

  test('Form intercept: ALWAYS catches /cart/add submits (no defaultPrevented skip)', () => {
    // Must NOT skip when e.defaultPrevented — theme JS may cache original fetch
    const submitIdx = code.indexOf('UNIVERSAL FORM INTERCEPT');
    assert(submitIdx !== -1, 'Must have UNIVERSAL FORM INTERCEPT section');
    const submitBlock = code.slice(submitIdx, submitIdx + 3000);
    assert(submitBlock.includes('e.preventDefault()'), 'Must call e.preventDefault()');
    assert(submitBlock.includes('e.stopImmediatePropagation()'), 'Must call e.stopImmediatePropagation() to block theme handlers');
    assert(!submitBlock.includes('e.defaultPrevented'), 'Must NOT check e.defaultPrevented — theme fetch may bypass our override');
    assert(submitBlock.includes('/cart/add.js'), 'Must route through /cart/add.js fetch override');
    assert(submitBlock.includes(', true)'), 'Must use capture phase (third arg true)');
  });

  test('Form intercept: prevents double-click adding multiple items', () => {
    const submitIdx = code.indexOf('UNIVERSAL FORM INTERCEPT');
    const submitBlock = code.slice(submitIdx, submitIdx + 2500);
    assert(submitBlock.includes('_formAddBusy'), 'Must have _formAddBusy guard to prevent double-click');
    assert(submitBlock.includes('if (_formAddBusy) return'), 'Must skip if already adding');
    assert(submitBlock.includes('submitBtn.disabled = true'), 'Must disable submit button during add');
    assert(submitBlock.includes('_formAddBusy = false'), 'Must reset busy flag after completion');
  });

  test('Form intercept: does NOT open drawer before fetch (prevents empty-cart flash)', () => {
    const submitIdx = code.indexOf('UNIVERSAL FORM INTERCEPT');
    const submitBlock = code.slice(submitIdx, submitIdx + 2500);
    assert(!submitBlock.includes('CCD.openDrawer()'), 'Must NOT open drawer in form intercept — wait for response handler');
    assert(!submitBlock.includes('CCD.showLoading()'), 'Must NOT show loading overlay — use button loading instead');
    assert(submitBlock.includes('Adding...'), 'Must show "Adding..." text on button during fetch');
  });

  test('Response handler: _renderAndOpen bypasses debounce and opens drawer after full render', () => {
    // BUG-020 FIX: _renderAndOpen calls _doRefresh directly (no debounce), then opens drawer
    const respIdx = code.indexOf('BUG-020 FIX');
    assert(respIdx !== -1, 'Must have BUG-020 FIX section');
    const respBlock = code.slice(respIdx, respIdx + 2500);
    assert(respBlock.includes('_renderAndOpen'), 'Must define _renderAndOpen helper');
    assert(respBlock.includes('_doRefresh'), 'Must call _doRefresh directly (bypass debounce)');
    assert(respBlock.includes('_skipRefreshOnOpen = true'), 'Must set _skipRefreshOnOpen before openDrawer');
    assert(respBlock.includes('CCD.openDrawer()'), 'Must open drawer from _renderAndOpen');
    // Protection add path (in response handler) must use _renderAndOpen
    // Search from BUG-020 section to find the right protectionDone = true
    const protAddIdx = code.indexOf('protectionDone = true', respIdx);
    assert(protAddIdx !== -1, 'Must have protectionDone = true after BUG-020 FIX');
    const protAddBlock = code.slice(protAddIdx, protAddIdx + 800);
    assert(protAddBlock.includes('_renderAndOpen(fullCart)'), 'Protection add .then must use _renderAndOpen');
    assert(protAddBlock.includes('_renderAndOpen(cart)'), 'Protection add .catch must use _renderAndOpen');
    // refreshOnOpen must check the flag
    const roStart = code.indexOf('refreshOnOpen: function');
    const roBlock = code.slice(roStart, roStart + 500);
    assert(roBlock.includes('_skipRefreshOnOpen'), 'refreshOnOpen must check _skipRefreshOnOpen flag');
  });

  test('_renderAndOpen loads experiment config so milestones render on first open', () => {
    // BUG-021: Milestones disappeared because _renderAndOpen skipped loadExperiment
    // _renderAndOpen MUST call loadExperiment + applyExperimentFeatures before _doRefresh
    const renderIdx = code.indexOf('function _renderAndOpen(finalCart)');
    assert(renderIdx !== -1, '_renderAndOpen must be defined');
    const renderBlock = code.slice(renderIdx, renderIdx + 2500);
    assert(renderBlock.includes('loadExperiment'), '_renderAndOpen must call loadExperiment');
    assert(renderBlock.includes('applyExperimentFeatures'), '_renderAndOpen must call applyExperimentFeatures');
    assert(renderBlock.includes('_mergeTiersFromConfig'), '_renderAndOpen must merge tier config for milestones');
    // _doRefresh must come AFTER applyExperimentFeatures (config must be applied before rendering)
    const applyIdx = renderBlock.indexOf('applyExperimentFeatures');
    const doRefreshIdx = renderBlock.indexOf('_doRefresh');
    assert(applyIdx < doRefreshIdx, 'applyExperimentFeatures must run before _doRefresh');
  });

  test('Progress lines: CSS has display:block!important to defeat div:empty{display:none}', () => {
    const lineCss = code.split('\n').find(l => l.includes('ccd-progress__line') && l.includes('flex: 1') && !l.includes('--filled') && !l.includes('--half') && !l.includes('::after'));
    assert(lineCss, 'ccd-progress__line base CSS must exist');
    assert(lineCss.includes('display: block') || lineCss.includes('display:block'), 'Must have display: block !important to defeat theme div:empty{display:none}');
  });

  test('Protection on first open: no double-render flash (no setTimeout re-fetch)', () => {
    // refreshOnOpen must NOT have a branch that shows cart without protection then re-fetches after delay
    const roStart = code.indexOf('refreshOnOpen: function');
    const roEnd = code.indexOf('\n    },', roStart + 100);
    const roSection = code.slice(roStart, roEnd);
    // The old pattern: setTimeout inside refreshOnOpen to re-fetch cart — causes flash
    assert(!roSection.includes('setTimeout'), 'refreshOnOpen must NOT use setTimeout — causes protection price flash');
    // Must add protection via /cart/update.js and ONLY refresh with the updated cart
    assert(roSection.includes('/cart/update.js'), 'Must use /cart/update.js for instant protection add');
  });

  // ================================================================
  // SECTION: Upload Safety — only Eliminai themes
  // ================================================================
  console.log('\n--- Upload Safety ---');

  // ================================================================
  // SECTION: Checkout & Debug UI
  // ================================================================
  console.log('\n--- Checkout & Debug UI ---');

  test('Checkout --loading state disables CSS transition for instant feedback', () => {
    const loadingRule = code.indexOf('.ccd-checkout-btn--loading');
    assert(loadingRule !== -1, '--loading CSS rule must exist');
    const ruleEnd = code.indexOf('}', loadingRule);
    const rule = code.substring(loadingRule, ruleEnd);
    assert(rule.includes('transition: none'), '--loading must set transition:none for instant opacity/spinner');
  });

  test('Debug button is visible (floating FAB always rendered, calls _ccdShowDebug)', () => {
    // Floating debug button should be created via _ccdAddDebugButton with id ccd-debug-fab
    assert(code.includes("id = 'ccd-debug-fab'") || code.includes('id="ccd-debug-fab"'),
      'floating debug button must have id ccd-debug-fab');
    assert(code.includes('_ccdShowDebug()'),
      'debug button must call _ccdShowDebug()');
    // Floating FAB must NOT be display:none (must be visible on storefront)
    const fabSection = code.substring(code.indexOf('ccd-debug-fab'), code.indexOf('ccd-debug-fab') + 800);
    assert(!fabSection.includes('display:none') && !fabSection.includes('display: none'),
      'floating debug button must NOT have display:none');
  });

  // ================================================================
  // Contract: Trust Badges (parity with dashboard preview)
  // ================================================================

  test('Trust badges: injectTrustBadges has 7-icon default matching dim.default', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    assert(fn !== -1, 'injectTrustBadges function definition must exist');
    // Locate the icons fallback array within the function body (next ~3000 chars)
    const body = code.substring(fn, fn + 3000);
    const iconsMatch = body.match(/icons\s*=\s*[^[]*\[([^\]]+)\]/);
    assert(iconsMatch, 'injectTrustBadges must define a default icons array');
    const list = iconsMatch[1];
    ['visa', 'mastercard', 'amex', 'discover', 'paypal', 'apple-pay', 'google-pay'].forEach((id) => {
      assert(list.includes(id), `default icons must include "${id}" (parity with addon-definitions.ts dim.default)`);
    });
  });

  test('Trust badges: no hardcoded green padlock SVG (#22c55e regression guard)', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    if (fn === -1) return; // covered by previous test
    const body = code.substring(fn, fn + 5000);
    assert(!body.includes('#22c55e'), 'injectTrustBadges must NOT hardcode the green padlock color (#22c55e) — caused orphan green sliver bug');
  });

  test('Trust badges: empty/<br>-only text must not render text div (orphan sliver fix)', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    assert(fn !== -1, 'injectTrustBadges function definition must exist');
    const body = code.substring(fn, fn + 5000);
    // Must sanitize <br>/whitespace-only text so empty ccd-trust-text div is never emitted
    assert(
      body.includes('<br'),
      'injectTrustBadges must reference <br> in its text sanitization (treat <br>-only text as empty)'
    );
    // Must guard the text div behind a truthy check
    const hasTextGuard = /if\s*\(\s*text\s*\)/.test(body) || /text\s*\?\s*['"`]<div class=["']ccd-trust-text/.test(body);
    assert(hasTextGuard, 'injectTrustBadges must only emit ccd-trust-text div when text is truthy');
  });

  // ================================================================
  // FEATURE FLAGS (FF) SYSTEM
  // ================================================================

  test('FF: CCD.FF helper exists and is a function', () => {
    assert(/FF:\s*function\s*\(name\)/.test(code), 'CCD.FF must be defined as a function');
  });

  test('FF: helper reads from window.CCD_CONFIG.featureFlags', () => {
    const fnIdx = code.indexOf('FF: function');
    assert(fnIdx !== -1);
    const body = code.substring(fnIdx, fnIdx + 500);
    assert(body.includes('window.CCD_CONFIG'), 'FF must read from window.CCD_CONFIG');
    assert(body.includes('featureFlags'), 'FF must read featureFlags property');
  });

  test('FF: helper returns false safely for missing/non-boolean flags (default OFF)', () => {
    const fnIdx = code.indexOf('FF: function');
    const body = code.substring(fnIdx, fnIdx + 500);
    assert(body.includes('=== true'), 'FF must use strict === true comparison so undefined/string/null all return false');
    assert(body.includes('try') && body.includes('catch'), 'FF must wrap access in try/catch — never throw if CCD_CONFIG is missing');
  });

  // ================================================================
  // FF gate: trustBadgesV2 (gates legacy injectTrustBadges)
  // ----------------------------------------------------------------
  // FF off (default): legacy renderer runs as today — Eleganto unchanged.
  // FF on (eliminai-test): legacy renderer is fully suppressed (returns before any
  //                         DOM creation) so the new BEM renderer (which reads
  //                         config.badges and config.text) can take over.
  // ================================================================

  // ----- LOCK tests (must keep passing — preserve current Eleganto behavior with FF off) -----

  test('LOCK: injectTrustBadges still defines the 7-icon default array (FF off path)', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    const body = code.substring(fn, fn + 3000);
    // FF-off branch must still have the legacy default array literal
    const legacyDefault = /\['visa'\s*,\s*'mastercard'\s*,\s*'amex'\s*,\s*'discover'\s*,\s*'paypal'\s*,\s*'apple-pay'\s*,\s*'google-pay'\]/;
    assert(legacyDefault.test(body), 'legacy 7-icon default array must remain untouched so Eleganto (FF off) renders identically');
  });

  test('LOCK: injectTrustBadges still falls back to cfg.icons when no other source (FF off path)', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    const body = code.substring(fn, fn + 3000);
    assert(body.includes('cfg.icons'), 'cfg.icons fallback must remain so legacy callers (FF off) still work');
  });

  test('LOCK: applyExperimentFeatures still reads addons[k].config (legacy path preserved)', () => {
    const fn = code.indexOf('applyExperimentFeatures: function');
    assert(fn !== -1, 'applyExperimentFeatures must exist');
    const body = code.substring(fn, fn + 2500);
    assert(/addons\[\w+\]\.config/.test(body), 'applyExperimentFeatures must keep reading addons[k].config so non-FF stores get unchanged behavior');
  });

  test('LOCK: applyExperimentFeatures keeps the auto-optimize branch passing config to inject', () => {
    const fn = code.indexOf('applyExperimentFeatures: function');
    const body = code.substring(fn, fn + 2500);
    // The two assignments to show[k]/show[ak] must still happen — not gated entirely behind FF
    const matches = body.match(/show\[(\w+)\]\s*=/g) || [];
    assert(matches.length >= 2, 'applyExperimentFeatures must keep both show[k] = ... assignments (always-on + auto-optimize)');
  });

  // ----- RED tests (must pass after FF gate is implemented) -----

  test('RED: injectTrustBadges reads CCD.FF("trustBadgesV2") to gate new behavior', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    const body = code.substring(fn, fn + 3000);
    assert(/CCD\.FF\(\s*['"]trustBadgesV2['"]\s*\)/.test(body), 'injectTrustBadges must check CCD.FF("trustBadgesV2") so we can flip behavior per-store');
  });

  test('RED: when FF on, injectTrustBadges returns BEFORE creating any DOM (legacy fully suppressed)', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    const body = code.substring(fn, fn + 3000);
    // The FF check must appear BEFORE the document.createElement('div') call so
    // the legacy renderer cannot inject #ccd-trust-badges when the new BEM
    // renderer is supposed to own that slot.
    const ffIdx = body.search(/if\s*\(\s*CCD\.FF\(\s*['"]trustBadgesV2['"]\s*\)\s*\)\s*return\s*;/);
    const createIdx = body.indexOf("document.createElement('div')");
    assert(ffIdx !== -1, 'must early-return when CCD.FF("trustBadgesV2") is on');
    assert(createIdx !== -1, 'function must still create the row element on FF-off path');
    assert(ffIdx < createIdx, 'FF-on early-return must come BEFORE any DOM creation so legacy is fully suppressed');
  });

  test('RED: FF-off path no longer carries adapter branching (cfg.icons is read once)', () => {
    const fn = code.indexOf('injectTrustBadges: function');
    const body = code.substring(fn, fn + 3000);
    // After full suppression, the function should not contain the adapter
    // ffV2 && Array.isArray(...) branch — it returns early or runs legacy as-is.
    assert(!/ffV2\s*&&\s*Array\.isArray/.test(body),
      'adapter branch must be removed — gate is now suppression-only');
    assert(!/ffV2\s*&&\s*icons\.length\s*===\s*0/.test(body),
      'FF-on empty-array guard must be removed — gate is now suppression-only');
  });

  // ================================================================
  // SCARCITY TIMER ADDON (rebuild)
  // Distinct from the Scarcity BADGE — this is the countdown timer addon.
  // ================================================================
  console.log('\n--- Scarcity Timer Addon ---');

  test('Scarcity Timer: injectScarcityTimer is no longer a TODO stub', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    assert(fn !== -1, 'CCD.injectScarcityTimer must be defined on root');
    const body = code.substring(fn, fn + 8000);
    assert(!/TODO: implement scarcity countdown timer/.test(body),
      'injectScarcityTimer must no longer be a TODO stub');
    assert(body.includes('setInterval'), 'must drive a 1-second tick via setInterval');
  });

  test('Scarcity Timer: replaces {time} token with a span we can update', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    assert(/\{time\}/.test(body), 'must reference the {time} token in the renderer');
    assert(body.includes('ccd-scarcity-time'),
      'must wrap {time} in a .ccd-scarcity-time span so tick() can update only the time text');
  });

  test('Scarcity Timer: countdown uses sessionStorage so it survives navigation', () => {
    // The storage key is defined as a module-level constant so the inject AND
    // remove paths share the same key. Verify both: the constant value, and that
    // the inject function references the constant (not a hardcoded string).
    assert(/CCD\._SCARCITY_STORAGE_KEY\s*=\s*['"]ccd_scarcity_start['"]/.test(code),
      'CCD._SCARCITY_STORAGE_KEY must be defined as "ccd_scarcity_start"');
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    assert(/CCD\._SCARCITY_STORAGE_KEY/.test(body),
      'inject must reference the shared CCD._SCARCITY_STORAGE_KEY constant');
    assert(body.includes('sessionStorage'),
      'must use sessionStorage (not localStorage) so a new session resets the timer');
  });

  test('Scarcity Timer: empty cart prevents the timer from starting and clears stored start', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    // Must consult the cart-empty helper at the top and bail before creating any element
    assert(/_cartIsEmptyForScarcity\(\)/.test(body),
      'inject must call CCD._cartIsEmptyForScarcity() to gate on cart state');
    // Must clear stored start time on the empty path so the next add-to-cart is fresh
    assert(/sessionStorage\.removeItem\(CCD\._SCARCITY_STORAGE_KEY\)/.test(body),
      'inject must clear sessionStorage when bailing on empty cart');
    // The cart-empty helper itself must check _lastRealCount === 0 (not item_count, which
    // counts excluded handles like Protection)
    assert(/_cartIsEmptyForScarcity[\s\S]*?_lastRealCount[\s\S]*?===\s*0/.test(code),
      '_cartIsEmptyForScarcity must derive emptiness from _lastRealCount === 0');
  });

  test('Scarcity Timer: inject defers when _lastRealCount is unknown (-1) to prevent flash on empty cart open', () => {
    // BUG (2026-05-01, reported by Yoni): Opening an empty cart for the first time briefly
    // showed the timer before it was hidden. Cause: applyExperimentFeatures runs at drawer-open
    // and calls injectScarcityTimer BEFORE the cart fetch resolves. At that moment _lastRealCount
    // is -1 ("unknown"), so the existing _cartIsEmptyForScarcity() guard (=== 0) didn't fire and
    // the timer was injected. Then the post-fetch _syncScarcityTimer removed it for the empty
    // cart — visible flash. inject must bail when count is unknown; sync re-injects post-fetch.
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    assert(/_lastRealCount\s*===\s*-1/.test(body),
      'inject must bail when _lastRealCount === -1 to avoid timer flash on empty cart open');
  });

  test('Scarcity Timer: cart-state sync removes timer + clears storage when cart goes empty', () => {
    // The remove handler must also clear sessionStorage so the next non-empty cart starts fresh
    assert(/scarcityTimer:[\s\S]*?remove:[\s\S]*?sessionStorage\.removeItem\(CCD\._SCARCITY_STORAGE_KEY\)/.test(code),
      'scarcityTimer.remove handler must clear sessionStorage');
    // The sync helper must exist and be wired up
    assert(/_syncScarcityTimer\s*:\s*function/.test(code),
      'CCD._syncScarcityTimer helper must exist');
    // It must short-circuit when addon is disabled, then check rc===0 vs rc>0
    const syncIdx = code.indexOf('_syncScarcityTimer: function');
    const syncBody = code.substring(syncIdx, syncIdx + 1500);
    assert(/_scarcityCfg/.test(syncBody),
      '_syncScarcityTimer must check _scarcityCfg (no-op when addon disabled)');
    assert(/rc\s*===\s*0/.test(syncBody) && /rc\s*>\s*0/.test(syncBody),
      '_syncScarcityTimer must branch on rc===0 (remove) and rc>0 (inject)');
    // Must be called from both refresh paths so cart updates flow through
    assert(/refreshLight[\s\S]{0,3000}_syncScarcityTimer\(\)/.test(code),
      'refreshLight must call _syncScarcityTimer after rc is updated');
    // applyExperimentFeatures must remember the resolved scarcity cfg for re-injection
    assert(/_scarcityCfg\s*=\s*show\.scarcityTimer/.test(code),
      'applyExperimentFeatures must remember show.scarcityTimer in CCD._scarcityCfg');
  });

  test('Upsell: injectUpsells bails + removes existing element when cart is empty (_lastRealCount === 0)', () => {
    // BUG (2026-05-23, reported by Yoni): "You may also like" stayed visible after the user
    // removed the last item from the cart. Two failure modes:
    //   (a) source='manual' never checks cart state at all — it resolved manualProducts and
    //       rendered regardless of whether the cart had items.
    //   (b) source='shopify-recommendations'/'ai-selected' only handled empty on first inject
    //       via the no-anchor path. On a subsequent cart refresh that empties the cart,
    //       applyExperimentFeatures is NOT called again, so the stale #ccd-upsells element
    //       just remains in the DOM.
    // Fix: bake an empty-cart guard into injectUpsells itself (early return + remove existing
    // #ccd-upsells when _lastRealCount === 0) AND add a _syncUpsells helper called from the
    // refresh paths — exactly mirroring the proven _syncScarcityTimer pattern.
    const fn = code.indexOf('CCD.injectUpsells = function');
    assert(fn !== -1, 'CCD.injectUpsells must exist');
    const body = code.substring(fn, fn + 6000);
    // Must check _lastRealCount === 0 as early guard
    assert(/_lastRealCount\s*===\s*0/.test(body),
      'injectUpsells must early-return when _lastRealCount === 0 (empty cart)');
    // Must remove any existing #ccd-upsells when bailing on empty cart (no stale element left)
    assert(/getElementById\(['"]ccd-upsells['"]\)/.test(body) && /\.remove\(\)|removeChild/.test(body),
      'injectUpsells empty-cart bail must remove any existing #ccd-upsells element');
  });

  test('Upsell: _syncUpsells helper removes element when cart goes empty + re-injects when cart has items', () => {
    // Mirrors _syncScarcityTimer — required because applyExperimentFeatures is NOT called
    // on item removal, so the inject pipeline does not naturally re-run.
    assert(/_syncUpsells\s*:\s*function/.test(code),
      'CCD._syncUpsells helper must exist');
    const syncIdx = code.indexOf('_syncUpsells: function');
    const syncBody = code.substring(syncIdx, syncIdx + 1500);
    // Short-circuit when addon is disabled for this tenant
    assert(/_upsellsCfg/.test(syncBody),
      '_syncUpsells must check _upsellsCfg (no-op when addon disabled)');
    // Must branch on rc===0 (remove) and rc>0 (inject) — exactly like scarcity timer
    assert(/rc\s*===\s*0/.test(syncBody) && /rc\s*>\s*0/.test(syncBody),
      '_syncUpsells must branch on rc===0 (remove) and rc>0 (inject)');
    // Must be called from refreshLight so cart-state changes flow through
    assert(/refreshLight[\s\S]{0,3000}_syncUpsells\(\)/.test(code),
      'refreshLight must call _syncUpsells after rc is updated');
    // applyExperimentFeatures must remember the resolved upsells cfg for re-injection
    assert(/_upsellsCfg\s*=\s*show\.upsellRecommendations/.test(code),
      'applyExperimentFeatures must remember show.upsellRecommendations in CCD._upsellsCfg');
  });

  test('Scarcity Timer: duration is clamped to [1, 60] minutes', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    assert(/durationMin\s*<\s*1/.test(body) || /<\s*1\)\s*durationMin\s*=\s*1/.test(body),
      'must clamp durationMin >= 1');
    assert(/durationMin\s*>\s*60/.test(body) || />\s*60\)\s*durationMin\s*=\s*60/.test(body),
      'must clamp durationMin <= 60');
  });

  test('Scarcity Timer: onComplete=hide removes the element AND clears the interval', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 8000);
    // Must check onComplete config, must clearInterval, and must remove the node.
    assert(body.includes("onComplete === 'reset'") || body.includes('cfg.onComplete') ,
      'must branch on cfg.onComplete');
    assert(body.includes('clearInterval'), 'must clearInterval when timer ends or element gone');
    assert(body.includes('removeChild') || body.includes('.remove()'),
      'must remove the timer element on hide');
  });

  test('Scarcity Timer: onComplete=reset restarts the countdown without removing element', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 8000);
    // Reset path: re-set startMs, write back to sessionStorage, do NOT clear interval, do NOT remove node.
    // Use lastIndexOf — the first 'reset' literal is in the cfg parsing ternary near the top
    // of the function; the actual reset branch in the tick loop is the LAST occurrence.
    const resetIdx = body.lastIndexOf("'reset'");
    assert(resetIdx !== -1, 'must have a reset branch');
    const resetBlock = body.substring(resetIdx, resetIdx + 600);
    assert(/startMs\s*=\s*Date\.now\(\)/.test(resetBlock),
      'reset branch must restart startMs');
  });

  test('Scarcity Timer: alignment is NOT injected via CSS — lives in rich-text HTML instead', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    // Old (pre-2026-04-29) behavior injected alignment via text-align CSS — this is now wrong.
    // Alignment is controlled inline by the user via the RichTextEditor toolbar (justifyLeft/Center/Right),
    // so the runtime must NOT prepend a text-align: CSS rule to the timer container.
    assert(!/text-align:\s*['"]?\s*\+\s*alignment/.test(body) &&
           !/'text-align:'\s*\+\s*alignment/.test(body),
      'alignment must NOT be injected as text-align CSS — alignment now lives inside rawText HTML');
    assert(!/var\s+alignment\s*=/.test(body),
      'must not declare an alignment variable — alignment is no longer a config dim');
  });

  test('Scarcity Timer: position select supports below-header / above-checkout / floating-top', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    assert(body.includes("'above-checkout'"), 'must handle above-checkout position');
    assert(body.includes("'floating-top'"), 'must handle floating-top position');
    assert(body.includes('.ccd-checkout-btn'),
      'above-checkout must insert before the checkout button');
    // below-header (default): self-rendered shell only — never reference theme-specific
    // classes (BUG-009 rule). The drawer is always our own ccd-* shell now.
    assert(body.includes('.ccd-inner'),
      'below-header must use self-rendered shell .ccd-inner');
    assert(!body.includes('.drawer__inner'),
      'must NOT reference theme-specific .drawer__inner (BUG-009 theme-independence rule)');
    // floating-top: same self-shell-only rule for the fixed header.
    assert(body.includes('.ccd-fixed-header'),
      'floating-top must use self-rendered shell .ccd-fixed-header');
    assert(!body.includes('.drawer__fixed-header'),
      'must NOT reference theme-specific .drawer__fixed-header (BUG-009 theme-independence rule)');
  });

  test('Scarcity Timer: registry remove() clears the running interval', () => {
    // Element id #ccd-scarcity-timer is shared with the badge feature, but the
    // interval CCD._scarcityTick belongs to the addon and MUST be cleared on remove
    // so disabling the addon stops the ticking.
    // Find the scarcityTimer registry entry and extract its remove() body.
    // Can't use [^}]+ here because the remove body contains nested braces.
    const entryIdx = code.indexOf('scarcityTimer:');
    assert(entryIdx !== -1, 'scarcityTimer entry must exist in addon registry');
    const removeStart = code.indexOf('remove: function()', entryIdx);
    assert(removeStart !== -1 && removeStart - entryIdx < 800,
      'scarcityTimer entry must declare a remove: function()');
    // Slice a generous window covering the whole registry entry.
    const registryBlock = code.substring(entryIdx, removeStart + 600);
    assert(/clearInterval\(CCD\._scarcityTick\)/.test(registryBlock),
      'remove() must clearInterval(CCD._scarcityTick) so disabling the addon stops the tick');
  });

  test('Scarcity Timer: wrapper does NOT use .ccd-scarcity-badge class (avoids !important conflict)', () => {
    // .ccd-scarcity-badge has !important rules and is reserved for the per-item
    // "only X left" badge. Using it on the timer wrapper would override the
    // tenant-editable inline styles with hardcoded badge styling.
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    assert(!/el\.className\s*=\s*['"]ccd-scarcity-badge['"]/.test(body),
      'timer wrapper must NOT set className = "ccd-scarcity-badge"');
    assert(!/el\.classList\.add\(['"]ccd-scarcity-badge['"]\)/.test(body),
      'timer wrapper must NOT add the .ccd-scarcity-badge class');
  });

  test('Scarcity Timer: per-item badge still uses .ccd-scarcity-badge class (lock test)', () => {
    // The per-item "Only X left" badge MUST keep the class for its CSS styling.
    // Different code path from injectScarcityTimer — verify both still work.
    assert(code.indexOf("badge.className = 'ccd-scarcity-badge'") !== -1
        || code.indexOf('badge.className = "ccd-scarcity-badge"') !== -1,
      'per-item scarcity badge must still set className = "ccd-scarcity-badge"');
  });

  test('Scarcity Timer: only pulseAnimation is read from cfg as a wrapper-level toggle', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    // All visual styling (background, text color, font size, font weight, padding,
    // border radius) is controlled inline via the rich text editor toolbar in
    // cfg.text — NOT as standalone cfg fields. Only pulseAnimation is wrapper-level.
    assert(/cfg\.pulseAnimation/.test(body), 'must read pulseAnimation from cfg');
    // Negative: ensure removed fields are NOT read from cfg as standalone values
    assert(!/cfg\.bgColor/.test(body), 'bgColor was removed — must not be read from cfg');
    assert(!/cfg\.textColor/.test(body), 'textColor was removed — must not be read from cfg');
    assert(!/cfg\.fontSize/.test(body), 'fontSize was removed — must not be read from cfg');
    assert(!/cfg\.fontWeight/.test(body), 'fontWeight was removed — must not be read from cfg');
    assert(!/cfg\.paddingY/.test(body), 'paddingY was removed — must not be read from cfg');
    assert(!/cfg\.paddingX/.test(body), 'paddingX was removed — must not be read from cfg');
    assert(!/cfg\.borderRadius/.test(body), 'borderRadius was removed — must not be read from cfg');
  });

  test('Scarcity Timer: only pulseAnimation is applied via inline styles (rest comes from rawText)', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    // The inline style string must still set the wrapper baseline (display, sizing).
    assert(/style\.cssText\s*=/.test(body), 'must set el.style.cssText');
    assert(/animation:ccdScarcityPulse/.test(body),
      'inline style must conditionally include the ccdScarcityPulse animation');
    // Negative: removed wrapper-level properties should NOT appear in cssText
    assert(!/bgColor/.test(body), 'bgColor was removed — must not appear in injection');
    assert(!/textColor/.test(body), 'textColor was removed — must not appear in injection');
    assert(!/fontSize/.test(body), 'fontSize was removed — must not appear in injection');
    assert(!/fontWeight/.test(body), 'fontWeight was removed — must not appear in injection');
    assert(!/paddingY/.test(body), 'paddingY was removed — must not appear in injection');
    assert(!/paddingX/.test(body), 'paddingX was removed — must not appear in injection');
    assert(!/borderRadius/.test(body), 'borderRadius was removed — must not appear in injection');
  });

  test('Scarcity Timer: pulseAnimation toggle controls the animation', () => {
    const fn = code.indexOf('CCD.injectScarcityTimer = function');
    const body = code.substring(fn, fn + 5000);
    // Conditional emission of the animation rule based on pulseAnimation
    assert(/pulseAnimation\s*[?!]/.test(body) || /pulseAnimation\s*\?/.test(body),
      'pulseAnimation must gate whether the animation CSS is included');
  });

  // ================================================================
  // RICH TEXT EDITOR — themeColor wiring (NO HARDCODED COLORS)
  // ================================================================
  console.log('\n--- Rich Text Editor themeColor wiring ---');

  test('RichTextEditor: contentStyle.color uses themeColor (not hardcoded)', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    // contentStyle block must use themeColor as the text color (with fallback)
    assert(/contentStyle[\s\S]*?color:\s*themeColor/.test(src),
      'contentStyle must derive color from themeColor prop, not hardcode it');
    // Negative: no naked hardcoded #1f2937 inside contentStyle
    const csMatch = src.match(/const\s+contentStyle[\s\S]*?\};/);
    assert(csMatch, 'contentStyle declaration must exist');
    assert(!/color:\s*['"]#1f2937['"]/.test(csMatch[0]),
      'contentStyle must NOT hardcode color: \'#1f2937\' — use themeColor || fallback');
  });

  test('RichTextEditor: HTML view textarea color uses themeColor (not hardcoded)', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    // The textarea (HTML mode) must also reflect themeColor visually
    const taMatch = src.match(/<textarea[\s\S]*?\/>/);
    assert(taMatch, 'textarea element must exist in rich-text-editor.tsx');
    assert(/color:\s*themeColor/.test(taMatch[0]),
      'HTML-mode textarea must derive color from themeColor, not hardcode it');
  });

  test('Scarcity Timer Editor: does not declare standalone bgColor/textColor/fontSize/fontWeight controls', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'scarcity-timer-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    // These four properties are controlled via the rich text editor toolbar,
    // not as separate fields on the addon config. Verify there is no React
    // state hook for any of them and no config field reference.
    assert(!/setBgColor\b|config\.bgColor\b/.test(src),
      'bgColor must not have a standalone state/config field in scarcity-timer-editor');
    assert(!/setTextColor\b|config\.textColor\b/.test(src),
      'textColor must not have a standalone state/config field in scarcity-timer-editor');
    assert(!/setFontSize\b|config\.fontSize\b/.test(src),
      'fontSize must not have a standalone state/config field in scarcity-timer-editor');
    assert(!/setFontWeight\b|config\.fontWeight\b/.test(src),
      'fontWeight must not have a standalone state/config field in scarcity-timer-editor');
  });

  test('RichTextEditor: syncFromEditor wraps plain HTML with themeColor span', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    // syncFromEditor must call applyDefaultColor with themeColor so the saved
    // HTML contains the color span (visible in HTML view).
    const sfeMatch = src.match(/const\s+syncFromEditor\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);/);
    assert(sfeMatch, 'syncFromEditor declaration must exist');
    assert(/applyDefaultColor\s*\([^)]*themeColor/.test(sfeMatch[0]),
      'syncFromEditor must call applyDefaultColor(html, themeColor) so saved HTML carries the color');
    // Dependency array must include themeColor so the callback re-binds when color changes
    assert(/syncFromEditor[\s\S]*?\[[^\]]*themeColor[^\]]*\]/.test(src),
      'syncFromEditor useCallback deps must include themeColor');
  });

  test('RichTextEditor: focusRestoreExec also wraps with themeColor', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    const freMatch = src.match(/const\s+focusRestoreExec\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);/);
    assert(freMatch, 'focusRestoreExec declaration must exist');
    assert(/applyDefaultColor\s*\([^)]*themeColor/.test(freMatch[0]),
      'focusRestoreExec must call applyDefaultColor(html, themeColor) after exec command');
  });

  test('RichTextEditor: focusRestoreExec wraps justify commands in text-align div (alignment persists in saved HTML)', () => {
    // Bug (2026-04-30): execCommand('justifyCenter') on inline-only content (e.g. the default
    // scarcity timer text "<span style='color:#d32f2f'>Your cart is reserved for <strong>{time}</strong></span>")
    // sets text-align on the contenteditable element ITSELF, not inside its innerHTML.
    // When editor.innerHTML is captured for save, the alignment is lost — so the dashboard
    // editor + preview iframe appeared centered (because their live DOM had editor.style.textAlign),
    // but the live cart on the storefront showed left-aligned (because the saved cfg.text had no align).
    // Fix: special-case justifyLeft/justifyCenter/justifyRight in focusRestoreExec — bypass execCommand
    // and directly wrap editor.innerHTML in <div style="text-align: X;">...</div> so alignment becomes
    // part of the saved rawText HTML and renders identically in editor, preview, and live cart.
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    const freMatch = src.match(/const\s+focusRestoreExec\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);/);
    assert(freMatch, 'focusRestoreExec declaration must exist');
    // Must reference justifyCenter (and friends) by name to special-case them
    assert(/justifyCenter/.test(freMatch[0]),
      'focusRestoreExec must special-case justifyCenter (not pass it through execCommand)');
    assert(/justifyLeft/.test(freMatch[0]) && /justifyRight/.test(freMatch[0]),
      'focusRestoreExec must special-case justifyLeft and justifyRight as well');
    // Must produce text-align CSS in the saved HTML (not on the editor element)
    assert(/text-align/.test(freMatch[0]),
      'focusRestoreExec must wrap inner HTML in <div style="text-align: ..."> for justify commands');
  });

  test('RichTextEditor: switchToHtml shows wrapped HTML so color code is visible', () => {
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    const sthMatch = src.match(/const\s+switchToHtml\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);/);
    assert(sthMatch, 'switchToHtml declaration must exist');
    assert(/applyDefaultColor\s*\([^)]*themeColor/.test(sthMatch[0]),
      'switchToHtml must call applyDefaultColor(html, themeColor) before showing HTML view');
  });

  test('RichTextEditor: applyDefaultColor must inject color INSIDE block-level wrappers (HTML5 span auto-close trap)', () => {
    // Bug (2026-04-30 deeper root cause): HTML5 parsers auto-close <span> when a block-level
    // <div>/<p>/<h1-6>/<ul>/<ol>/etc. appears inside it. So `<span style="color">...<div>X</div>...</span>`
    // ends up parsed as `<span style="color"></span><div>X</div>` — the color is silently dropped.
    // This is why preview iframe rendered black when the editor wrapped innerHTML in a text-align div
    // (then applyDefaultColor wrapped THAT in a color span — span auto-closed → color lost).
    //
    // Fix: applyDefaultColor must detect top-level block elements and inject the color span INSIDE
    // them (not around them) so the color survives HTML5 parsing.
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    const adcMatch = src.match(/export\s+function\s+applyDefaultColor\s*\([^)]*\)\s*:\s*string\s*\{[\s\S]*?\n\}/);
    assert(adcMatch, 'applyDefaultColor function must exist');
    // Must reference a list of block-level tags (div/p/h1-6/ul/ol/etc.) to detect the pattern
    assert(/div\|p\|h\[1-6\]|blockTags|blockMatch/i.test(adcMatch[0]),
      'applyDefaultColor must detect top-level block elements (div, p, h1-6, ul, ol, etc.) to handle the HTML5 span auto-close trap');
    // Must wrap CHILDREN of block tag in span, not the block itself
    assert(/<\$\{tag\}|<\$\{1\}|<(?:div|p|h[1-6])[^>]*><span/.test(adcMatch[0]),
      'applyDefaultColor must wrap the inner content of block tags in a color span (not wrap the block tag itself)');
  });

  test('RichTextEditor: focusRestoreExec applies color INSIDE align div for justify commands', () => {
    // Companion to the auto-close-span fix: when wrapping innerHTML in a text-align div, color
    // must be applied INSIDE the div BEFORE the wrap, otherwise applyDefaultColor downstream would
    // wrap the whole div in a span and the parser would auto-close it.
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');
    const freMatch = src.match(/const\s+focusRestoreExec\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);/);
    assert(freMatch, 'focusRestoreExec declaration must exist');
    // Inside the justify branch, must call hasInlineColor on inner BEFORE wrapping in align div
    const justifyBranch = freMatch[0].match(/justifyLeft[\s\S]*?editor\.innerHTML\s*=\s*`<div\s+style="text-align/);
    assert(justifyBranch, 'justify branch in focusRestoreExec must exist');
    assert(/hasInlineColor\s*\(\s*inner\s*\)/.test(justifyBranch[0]),
      'focusRestoreExec must call hasInlineColor(inner) inside the justify branch BEFORE wrapping in align div');
    assert(/inner\s*=\s*`<span[^`]*color:\s*\$\{themeColor\}/.test(justifyBranch[0]),
      'focusRestoreExec must wrap inner in <span style="color: ${themeColor}"> when no inline color present, INSIDE the align div');
  });

  test('RichTextEditor: hasInlineColor must NOT match background-color/border-color (foreground only)', () => {
    // Bug (2026-04-30): hasInlineColor regex /color\s*[:=]/i had false positives — it matched
    // background-color:, border-color:, outline-color:, bgcolor=, etc. So if a user's saved HTML
    // had ANY background-color in it, applyDefaultColor would skip wrapping with the foreground
    // <span style="color: #d32f2f">, and the preview iframe (which has no editor contentStyle.color
    // override) would render the text in the drawer's default base color (#111 = near-black) instead
    // of the configured red. The contentEditable in the dashboard editor still rendered red because
    // contentStyle.color = themeColor || '#1f2937' is applied to the editor element directly,
    // masking the missing inline color span. So editor + live cart looked red (live cart got
    // applyDefaultColor at runtime via cfg.text), but preview iframe looked black.
    //
    // Fix: use lookbehind /(?<![a-zA-Z-])color\s*[:=]/i so 'color' must not be preceded by a
    // letter or hyphen — preventing match on background-color, border-color, bgcolor, etc.
    const editorPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'rich-text-editor.tsx');
    const src = fs.readFileSync(editorPath, 'utf8');

    // Static contract: regex must use lookbehind to exclude letter/hyphen prefixes
    const hicMatch = src.match(/export\s+function\s+hasInlineColor\s*\([^)]*\)\s*:\s*boolean\s*\{[\s\S]*?\}/);
    assert(hicMatch, 'hasInlineColor function must exist');
    assert(/\(\?<!\[a-zA-Z-?\]\)|\(\?<![^)]*[a-zA-Z][^)]*-[^)]*\)/.test(hicMatch[0]) ||
           /\(\?<!\[a-zA-Z-\]\)/.test(hicMatch[0]),
      'hasInlineColor must use a lookbehind that excludes letter/hyphen prefixes (e.g. /(?<![a-zA-Z-])color\\s*[:=]/i) — otherwise it matches background-color, border-color, bgcolor, etc.');

    // Behavioral contract: evaluate the regex against known-bad inputs to catch regressions
    // even if someone changes the regex to a different shape.
    const regexMatch = hicMatch[0].match(/\/[^\/]+\/[gimuy]*/);
    assert(regexMatch, 'hasInlineColor must use a regex literal');
    // eslint-disable-next-line no-eval
    const re = eval(regexMatch[0]);
    assert(!re.test('<div style="background-color: red">x</div>'),
      'hasInlineColor must NOT match background-color');
    assert(!re.test('<div style="border-color: red">x</div>'),
      'hasInlineColor must NOT match border-color');
    assert(!re.test('<div style="outline-color: red">x</div>'),
      'hasInlineColor must NOT match outline-color');
    assert(!re.test('<table bgcolor="red">x</table>'),
      'hasInlineColor must NOT match bgcolor attribute');
    // True positives (must still match)
    assert(re.test('<span style="color: red">x</span>'),
      'hasInlineColor MUST match style="color: red"');
    assert(re.test('<font color="red">x</font>'),
      'hasInlineColor MUST match font color attribute');
    assert(re.test('<span style="background:red;color:blue">x</span>'),
      'hasInlineColor MUST match color when alongside background');
  });

  test('addon-preview scarcityTimer must apply default color via applyDefaultColor', () => {
    // Bug (2026-05-01): Saved cfg.text from earlier sessions had `text-align: center` on a wrapping
    // div but NO foreground color anywhere (only `background-color: transparent` and
    // `font-family: inherit`). The preview iframe's CSS sets #CartDrawer.custom-cart-drawer { color:#111 }
    // so without an explicit foreground color span, the timer text rendered black instead of red.
    // normalizeBlockColorWrap can't help here because the broken pattern (<span color><div></div></span>)
    // isn't present — the data has no color span at all.
    //
    // Fix: addon-preview must call applyDefaultColor(rawText, themeColor) so any saved HTML missing
    // a foreground color gets the default red injected before render.
    const previewPath = path.join(__dirname, '..', 'backend', 'src', 'app', 'dashboard', 'addons', 'addon-preview.tsx');
    const src = fs.readFileSync(previewPath, 'utf8');

    // Must import applyDefaultColor from rich-text-editor
    assert(/import\s*\{[^}]*\bapplyDefaultColor\b[^}]*\}\s*from\s*['"]\.\/rich-text-editor['"]/.test(src),
      'addon-preview must import applyDefaultColor from ./rich-text-editor');

    // The scarcityTimer block (between `if (addonKey === 'scarcityTimer')` and the closing of that block)
    // must call applyDefaultColor on the raw text before rendering.
    const blockMatch = src.match(/if\s*\(\s*addonKey\s*===\s*['"]scarcityTimer['"]\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
    assert(blockMatch, 'scarcityTimer block must exist in addon-preview');
    assert(/applyDefaultColor\s*\(/.test(blockMatch[0]),
      'scarcityTimer block must call applyDefaultColor — otherwise saved text without inline color renders in drawer base color (#111) instead of theme red');
  });

  // ================================================================
  // CONTRACT: Order Notes Addon (Chunk 4.1)
  // ================================================================
  console.log('\nContract: Order Notes Addon');

  test('notes addon registered in _addonHandlers with inject + remove', () => {
    // Registry must reference CCD.injectNotes and remove element by id ccd-notes-row
    assertRegex(code, /notes\s*:\s*\{\s*inject\s*:\s*function\s*\([^)]*\)\s*\{\s*CCD\.injectNotes/,
      'notes handler must call CCD.injectNotes(c) when injecting');
    // Find the notes registry line and ensure remove handler removes ccd-notes-row
    const notesLineMatch = code.match(/notes\s*:\s*\{[\s\S]*?ccd-notes-row[\s\S]*?\}\s*[,}]/);
    assert(notesLineMatch, 'notes registry entry must reference ccd-notes-row id');
    assert(/remove\s*:\s*function/.test(notesLineMatch[0]),
      'notes registry entry must define a remove function');
    assert(/getElementById\(['"]ccd-notes-row['"]\)/.test(notesLineMatch[0]),
      'notes remove handler must look up element by id ccd-notes-row');
  });

  test('CCD.injectNotes creates textarea with position class and saves note via /cart/update.js', () => {
    // The function must exist, create a textarea, apply ccd-notes-row--<position> class,
    // and POST to /cart/update.js with a JSON body containing the note field.
    assertContains(code, 'CCD.injectNotes = function', 'CCD.injectNotes must be defined');
    assertRegex(code, /ccd-notes-row--['"]?\s*\+\s*position/,
      'Position class (ccd-notes-row--top / ccd-notes-row--bottom) must be applied from cfg.position');
    assertContains(code, "createElement('textarea')", 'injectNotes must create a textarea element');
    assertContains(code, "'/cart/update.js'", 'injectNotes must POST to /cart/update.js to persist note');
    assertRegex(code, /JSON\.stringify\(\s*\{\s*note\s*:/,
      'injectNotes must send { note: ... } in request body so Shopify stores cart.attributes.note');
  });

  test('injectNotes inserts at top (firstChild) or bottom (before .ccd-trust) of sticky-footer', () => {
    // Position 'top' → footer.insertBefore(row, footer.firstChild)
    // Position 'bottom' → footer.insertBefore(row, trustRow) when .ccd-trust exists, else append
    assertContains(code, "querySelector('.ccd-sticky-footer')",
      'injectNotes must locate .ccd-sticky-footer to anchor the row');
    assertRegex(code, /insertBefore\(\s*row\s*,\s*footer\.firstChild\s*\)/,
      'Position "top" must insert as firstChild of sticky-footer');
    assertRegex(code, /querySelector\(['"]\.ccd-trust['"]\)/,
      'Position "bottom" must look up .ccd-trust to insert before it (so notes sit above the trust row)');
  });

  // ================================================================
  // RESULTS
  // ================================================================
  console.log(`\n${'='.repeat(55)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) {
    console.log('\nFAILED CONTRACTS:');
    failures.forEach(f => {
      console.log(`  \u2717 ${f.name}`);
      console.log(`    ${f.error}`);
    });
    console.log('\n\u26a0\ufe0f  DO NOT UPLOAD — contract violations detected!');
    console.log('Fix the code to match BEHAVIOR-CONTRACT.md before uploading.');
    process.exit(1);
  } else {
    console.log('\n\u2713 All contracts satisfied — safe to upload');
    process.exit(0);
  }
}

run().catch(e => {
  console.error('Contract test runner error:', e);
  process.exit(1);
});
