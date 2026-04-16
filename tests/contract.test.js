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
    assertRegex(code, /id:\s*PROT_VID/, 'Must use PROT_VID constant');
  });

  test('Interceptor converts form-encoded to JSON with protection inline', () => {
    // The catch block must convert form-encoded body to JSON with protection injected
    assertContains(code, 'new URLSearchParams(opts.body)', 'Catch must parse form-encoded body via URLSearchParams');
    assertContains(code, 'formParams.get(\'id\')', 'Must extract product ID from form params');
    // Must still have origFetch fallback if conversion fails
    assertContains(code, 'origFetch(\'/cart/add.js\'', 'Must have origFetch fallback for unparseable forms');
    // Verify it checks protectionDone before firing
    assertRegex(code, /catch\(ex\)\s*\{[^}]*protectionDone/, 'Catch block must check protectionDone');
  });

  test('protectionDone is set in both JSON and form-encoded paths', () => {
    // Count how many times protectionDone = true appears
    const setCount = countOccurrences(code, 'protectionDone = true');
    assert(setCount >= 3, `protectionDone = true should appear 3+ times (interceptor JSON, catch fallback, cart-open), found ${setCount}`);
  });

  test('Cart-open handler adds protection inline', () => {
    // refreshOnOpen should have inline protection add
    assertContains(code, 'JSON.stringify({ items: [{ id: PROT_VID, quantity: 1 }] })', 'Must add protection via PROT_VID');
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
    // The old pattern was: JSON.stringify({ items: toAdd })
    // This should NOT exist (it was the bug)
    assertNotContains(code, 'JSON.stringify({ items: toAdd })', 'Must NOT use JSON items array for gifts (causes silent Shopify failure)');
    assertNotContains(code, "JSON.stringify({items: toAdd})", 'Must NOT use JSON items array for gifts (no spaces variant)');
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

  test('Cart-open handles in-flight protection (interceptor already added)', () => {
    // When interceptor set protectionDone but /cart.js returned stale data (no protection yet),
    // refreshOnOpen must detect and wait for it to land — NOT fire a second add
    // Pattern: protectionDone && !hasProt → setTimeout + refetch /cart.js
    assertRegex(code, /protectionDone\s*&&\s*!hasProt\s*&&\s*!_userToggledOff/, 'Must detect interceptor-already-added state via protectionDone && !hasProt');
    assertContains(code, 'Interceptor already injected protection', 'Must document the wait-only branch');
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
    const closeSection = code.indexOf('drawer--is-open');
    assert(closeSection > -1, 'Must observe drawer--is-open class');
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
    const protVidUses = countOccurrences(code, 'id: PROT_VID');
    assert(protVidUses >= 3, `PROT_VID should be used in 3+ places (interceptor, cart-open, toggle, ensureProtection), found ${protVidUses}`);
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
    // The in-flight branch uses setTimeout + _oF2 (CCD._origFetch) to refetch /cart.js
    assertRegex(code, /setTimeout\(function\(\)\s*\{[\s\S]{0,200}_oF2\('\/cart\.js'\)/, 'In-flight path must use setTimeout + _oF2 (origFetch) refetch');
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

  test('refreshOnOpen wait branch uses _origFetch for /cart.js refetch', () => {
    // The "interceptor already added" branch must use _oF2 (CCD._origFetch) to bypass interceptor
    const refreshSection = code.substring(code.indexOf('refreshOnOpen'));
    assertRegex(refreshSection, /var\s+_oF2\s*=\s*CCD\._origFetch\s*\|\|\s*fetch/, 'Wait branch must alias CCD._origFetch as _oF2');
    assertRegex(refreshSection, /_oF2\('\/cart\.js'\)/, 'Wait branch must use _oF2 for cart refetch');
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
    assertRegex(lightBody, /protItem\s*&&\s*protItem\.quantity\s*>\s*1/, 'refreshLight must check protItem.quantity > 1');
  });

  test('refreshOnOpen "already added" branch does NOT fire second add', () => {
    // When protectionDone && !hasProt, refreshOnOpen must only wait and refetch
    // It must NOT call /cart/add.js again (was the duplicate protection bug)
    const refreshSection = code.substring(code.indexOf('refreshOnOpen'));
    const waitBranch = refreshSection.substring(refreshSection.indexOf('protectionDone && !hasProt'));
    const waitBranchEnd = waitBranch.substring(0, waitBranch.indexOf('} else {'));
    // The wait branch should have /cart.js (refetch) but NOT /cart/add.js
    assert(waitBranchEnd.includes('/cart.js'), 'Wait branch must refetch /cart.js');
    assert(!waitBranchEnd.includes('/cart/add.js'), 'Wait branch must NOT call /cart/add.js (single add only)');
  });

  test('Empty-state element hidden in interceptor before fetch fires', () => {
    // Prevents "Your cart is empty" flash when theme opens drawer before add completes
    assertContains(code, "document.querySelector('#CartDrawer .drawer__cart-empty')", 'Must select empty-state element');
    // The hide must happen in the interceptor (before origFetch.call)
    const interceptorSection = code.substring(code.indexOf('window.fetch = function'), code.indexOf('return origFetch.apply'));
    assert(interceptorSection.includes('.drawer__cart-empty'), 'Empty-state hide must be in the interceptor');
    assert(interceptorSection.includes("_es.style.display = 'none'") || interceptorSection.includes('display = "none"'), 'Must set display:none on empty-state element');
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
    // The MutationObserver close handler resets protectionDone but must NOT touch _userToggledOff
    const closeIdx = code.indexOf('!m.target.classList.contains(\'drawer--is-open\')');
    assert(closeIdx > -1, 'Must have drawer close handler in MutationObserver');
    const closeSection = code.substring(closeIdx, closeIdx + 300);
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
    assertRegex(code, /items\.push\(\{\s*id:\s*PROT_VID/, 'Must push protection into converted items array');
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
    var handlerBody = code.substring(handlerStart, handlerStart + 2000);
    // Must NOT use /cart/add.js for protection in response handler
    var addJsAfterHandler = handlerBody.indexOf("/cart/add.js");
    assert(addJsAfterHandler === -1, 'Response handler must NOT use /cart/add.js for protection — it is accumulative and causes qty=2 when adding second variant');
    // Must use /cart/update.js instead (idempotent)
    assertContains(handlerBody, '/cart/update.js', 'Response handler must use /cart/update.js (idempotent, sets qty to exactly 1)');
  });

  test('Response handler protection update uses updates object (not items array)', () => {
    var handlerStart = code.indexOf('origFetch.call(this, url, opts).then');
    var handlerBody = code.substring(handlerStart, handlerStart + 2000);
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
    var handlerBody = code.substring(handlerStart, handlerStart + 3000);
    assertRegex(handlerBody, /quantity\s*>\s*1/, 'Response handler must check if protection quantity > 1');
  });

  test('Response handler fixes qty>1 with /cart/update.js before refresh', () => {
    var handlerStart = code.indexOf('origFetch.call(this, url, opts).then');
    var handlerBody = code.substring(handlerStart, handlerStart + 3000);
    // The qty>1 fix must use /cart/update.js (idempotent) and refresh with the fixed cart
    var qtyCheckIdx = handlerBody.indexOf('quantity > 1');
    var afterQtyCheck = handlerBody.substring(qtyCheckIdx, qtyCheckIdx + 500);
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

  test('Checkout redirects through /discount/FREECASE when gift present', () => {
    assertContains(code, '/discount/FREECASE?redirect=/checkout', 'Must redirect through discount code URL to apply free case code');
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

  test('gift-discounts route.ts sets customerGets quantity to "1"', () => {
    const routePath = path.join(__dirname, '..', 'backend', 'src', 'app', 'api', 'stores', '[id]', 'gift-discounts', 'route.ts');
    let routeCode;
    try { routeCode = fs.readFileSync(routePath, 'utf8'); } catch(e) { throw new Error('Cannot read gift-discounts route.ts: ' + e.message); }
    // Must have quantity: "1" in the customerGets section
    assertRegex(routeCode, /quantity:\s*"1"/, 'customerGets.quantity must be "1" (not total gift count)');
    // Must NOT have quantity derived from gift count
    assertNotContains(routeCode, 'String(giftProductGids.length)', 'Must NOT use String(giftProductGids.length) as quantity — breaks partial cart discounts');
    assertNotContains(routeCode, 'quantity: String(giftCount)', 'Must NOT use quantity: String(giftCount)'); assertNotContains(routeCode, 'quantity: giftCount', 'Must NOT use quantity: giftCount');
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
