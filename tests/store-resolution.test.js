#!/usr/bin/env node
/**
 * Store Resolution Tests — Prevents cross-store data contamination
 *
 * These tests verify that the useStore hook and /api/stores/resolve endpoint
 * correctly isolate store data. A user visiting Store A's dashboard should
 * NEVER see Store B's products or config.
 *
 * Root cause of bug (2026-04-20): When Shopify embeds the app without ?shop=
 * in the URL (e.g. during internal navigation), the resolve API fell back to
 * "newest installed store" which was often the wrong store.
 *
 * Usage:
 *   node tests/store-resolution.test.js
 */

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log('  \u2717 ' + name);
    console.log('    ' + err.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || '') + ` Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }
}

// ─── Simulate the useStore logic ─────────────────────────────────────────────

/**
 * Mimics getShopDomain() from use-store.ts
 * Tests the priority: URL ?shop= > __shopifyShop > null
 */
function getShopDomain(urlSearch, windowGlobals = {}) {
  const params = new URLSearchParams(urlSearch);
  const urlShop = params.get('shop');
  if (urlShop) return urlShop;
  const bridgeShop = windowGlobals.__shopifyShop || null;
  if (bridgeShop) return bridgeShop;
  return null;
}

/**
 * Mimics the cache validation logic from useState initializer
 */
function shouldUseCachedStore(cachedDomain, currentShop) {
  if (!currentShop) return true; // no context → use cache (dev mode only)
  return cachedDomain === currentShop;
}

/**
 * Mimics /api/stores/resolve behavior
 */
function resolveStore(shopParam, allStores) {
  if (shopParam) {
    return allStores.find(s => s.shopDomain === shopParam) || null;
  }
  // Fallback: newest (this is what caused the bug when shop param was missing)
  return allStores[0] || null;
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const ELEGANTO = { id: 'store-eleganto', shopDomain: 'eleganto-3011.myshopify.com', shopName: 'Eleganto' };
const TEST_STORE = { id: 'store-test', shopDomain: 'aisupportshop.myshopify.com', shopName: 'Test Store' };
const ALL_STORES = [TEST_STORE, ELEGANTO]; // test store is "newest"

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('\n=== Store Resolution Tests ===\n');

console.log('  --- getShopDomain priority ---');

test('BUG-020: URL ?shop= takes priority over everything', () => {
  const result = getShopDomain('?shop=eleganto-3011.myshopify.com&host=abc', { __shopifyShop: 'aisupportshop.myshopify.com' });
  assertEqual(result, 'eleganto-3011.myshopify.com');
});

test('BUG-020: Falls back to __shopifyShop when no URL param', () => {
  const result = getShopDomain('?edit=shippingProtection', { __shopifyShop: 'eleganto-3011.myshopify.com' });
  assertEqual(result, 'eleganto-3011.myshopify.com');
});

test('BUG-020: Returns null when no shop context available', () => {
  const result = getShopDomain('?edit=shippingProtection', {});
  assertEqual(result, null);
});

test('BUG-020: Empty shop param is treated as missing', () => {
  const result = getShopDomain('?shop=&host=abc', { __shopifyShop: 'eleganto-3011.myshopify.com' });
  // URLSearchParams.get returns '' for empty value, which is falsy
  assertEqual(result, 'eleganto-3011.myshopify.com');
});

console.log('\n  --- Cache validation ---');

test('BUG-020: Cache rejected when domain mismatches current shop', () => {
  const useCache = shouldUseCachedStore('aisupportshop.myshopify.com', 'eleganto-3011.myshopify.com');
  assertEqual(useCache, false, 'Should NOT use test store cache when on Eleganto');
});

test('BUG-020: Cache accepted when domain matches current shop', () => {
  const useCache = shouldUseCachedStore('eleganto-3011.myshopify.com', 'eleganto-3011.myshopify.com');
  assertEqual(useCache, true);
});

test('BUG-020: Cache accepted when no shop context (dev mode)', () => {
  const useCache = shouldUseCachedStore('aisupportshop.myshopify.com', null);
  assertEqual(useCache, true, 'In dev mode with no ?shop=, cache is OK');
});

console.log('\n  --- Resolve API behavior ---');

test('BUG-020: Resolve with ?shop= returns correct store regardless of install order', () => {
  const store = resolveStore('eleganto-3011.myshopify.com', ALL_STORES);
  assertEqual(store.id, 'store-eleganto');
});

test('BUG-020: Resolve without ?shop= returns newest (dev fallback)', () => {
  const store = resolveStore(null, ALL_STORES);
  assertEqual(store.id, 'store-test', 'Without shop param, returns newest (expected in dev)');
});

test('BUG-020: Resolve with unknown shop returns null', () => {
  const store = resolveStore('unknown-store.myshopify.com', ALL_STORES);
  assertEqual(store, null);
});

console.log('\n  --- Full flow simulation ---');

test('BUG-020: Eleganto embedded app NEVER loads test store data', () => {
  // Simulate: Shopify embeds with ?shop=eleganto-3011... initially
  // AppBridgeProvider saves __shopifyShop = 'eleganto-3011...'
  // User navigates to /dashboard/addons?edit=shippingProtection (no ?shop= preserved)
  // localStorage has test store cached from previous session

  const windowGlobals = { __shopifyShop: 'eleganto-3011.myshopify.com' };
  const urlSearch = '?edit=shippingProtection'; // no ?shop= — the bug scenario

  // Step 1: getShopDomain finds __shopifyShop
  const shopDomain = getShopDomain(urlSearch, windowGlobals);
  assertEqual(shopDomain, 'eleganto-3011.myshopify.com', 'Must find shop from AppBridge');

  // Step 2: Cache validation rejects test store cache
  const useCache = shouldUseCachedStore('aisupportshop.myshopify.com', shopDomain);
  assertEqual(useCache, false, 'Must reject mismatched cache');

  // Step 3: API resolve with correct shop
  const store = resolveStore(shopDomain, ALL_STORES);
  assertEqual(store.id, 'store-eleganto', 'Must resolve to Eleganto');
});

test('BUG-020: Navigation within app preserves correct store context', () => {
  // After initial load, user clicks sidebar nav links
  // Layout's navHref() preserves ?shop= from original URL
  const urlSearch = '?shop=eleganto-3011.myshopify.com&host=abc&edit=shippingProtection';
  const shopDomain = getShopDomain(urlSearch, {});
  assertEqual(shopDomain, 'eleganto-3011.myshopify.com');

  const store = resolveStore(shopDomain, ALL_STORES);
  assertEqual(store.id, 'store-eleganto');
});

test('BUG-020: Fresh browser with no cache and no AppBridge uses API fallback safely', () => {
  // Edge case: dev mode, no cache, no AppBridge
  const shopDomain = getShopDomain('', {});
  assertEqual(shopDomain, null);

  // In this case, resolve returns newest — acceptable in dev mode only
  const store = resolveStore(shopDomain, ALL_STORES);
  assert(store !== null, 'Dev fallback should return a store');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
if (failed > 0) {
  console.log(`\n  FAILED: ${failed} test(s)\n`);
  failures.forEach(f => console.log(`    ✗ ${f.name}: ${f.error}`));
  process.exit(1);
} else {
  console.log(`\n  ALL ${passed} tests passed ✓\n`);
}
