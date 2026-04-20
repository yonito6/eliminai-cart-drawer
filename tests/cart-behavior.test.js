/**
 * Cart Behavior Tests — Run BEFORE and AFTER every cart feature change
 *
 * These tests hit the real Shopify storefront AJAX API to verify cart behavior.
 * They catch regressions that local code review cannot — discount conflicts,
 * variant add failures, price calculation errors.
 *
 * Usage:
 *   cd C:/Projects/eliminai-cart-drawer/backend && node ../tests/cart-behavior.test.js
 *
 * When to run:
 *   - BEFORE uploading ANY JS to live or demo theme
 *   - AFTER uploading JS or changing Shopify discounts
 *   - BEFORE deploying backend changes that affect config proxy
 *   - After ANY discount creation/deletion/modification
 *
 * If ANY test fails after a change → ROLLBACK immediately using:
 *   node ../tests/rollback.js <snapshot-timestamp>
 */

const { PrismaClient } = require('@prisma/client');

const STORE_DOMAIN = 'eleganto-3011.myshopify.com';

// Known working variant IDs
const VARIANTS = {
  LUXE_WHITE: 45167742681339,
  PEGASUS_BLUE: 45175479304443,
  BARREL_ROSE: 46581778972923,
  DIVER_SILVER: 45167879848187,
  ELEGANTO_CASE: 46941745742075,
  // Add more as needed
};

const GIFT_HANDLE = 'eleganto-premium-watch-organizer';

let storefront = null; // Will be set to the store's public URL

class CartTester {
  constructor(token, domain) {
    this.token = token;
    this.domain = domain;
    this.baseUrl = `https://${domain}`;
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async clearCart() {
    await fetch(`${this.baseUrl}/cart/clear.js`, { method: 'POST' });
    await this._wait(300);
  }

  async addItem(variantId, quantity = 1, properties = null) {
    let body = `id=${variantId}&quantity=${quantity}`;
    if (properties) {
      Object.entries(properties).forEach(([k, v]) => {
        body += `&properties%5B${encodeURIComponent(k)}%5D=${encodeURIComponent(v)}`;
      });
    }
    const res = await fetch(`${this.baseUrl}/cart/add.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    await this._wait(300);
    return res;
  }

  async getCart() {
    const res = await fetch(`${this.baseUrl}/cart.js`);
    return res.json();
  }

  async addItems(variantIds) {
    for (const id of variantIds) {
      await this.addItem(id);
    }
  }

  _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async test(name, fn) {
    try {
      await this.clearCart();
      await fn();
      this.passed++;
      this.results.push({ name, status: 'PASS' });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      this.failed++;
      this.results.push({ name, status: 'FAIL', error: err.message });
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${err.message}`);
    }
  }

  assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  summary() {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${this.passed} passed, ${this.failed} failed, ${this.passed + this.failed} total`);
    if (this.failed > 0) {
      console.log('\nFAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  ✗ ${r.name}: ${r.error}`);
      });
      console.log('\n⚠️  DO NOT UPLOAD TO LIVE THEME — tests failed!');
    } else {
      console.log('\n✓ All tests passed — safe to upload');
    }
    return this.failed === 0;
  }
}

async function runTests() {
  const p = new PrismaClient();
  const store = await p.store.findFirst({
    where: { shopDomain: STORE_DOMAIN },
    select: { accessToken: true, shopDomain: true }
  });

  // Use the public storefront URL (elegantoshop.com resolves to the store)
  const t = new CartTester(store.accessToken, 'elegantoshop.com');

  console.log('Cart Behavior Tests');
  console.log('='.repeat(50));
  console.log(`Store: ${STORE_DOMAIN}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // ===== GROUP 1: Basic cart operations =====
  console.log('Group 1: Basic Cart Operations');

  await t.test('Can add a single watch to cart', async () => {
    await t.addItem(VARIANTS.LUXE_WHITE);
    const cart = await t.getCart();
    t.assertEqual(cart.item_count, 1, 'Item count');
    t.assert(cart.items[0].variant_id === VARIANTS.LUXE_WHITE, 'Correct variant');
  });

  await t.test('Can add 3 watches to cart', async () => {
    await t.addItems([VARIANTS.LUXE_WHITE, VARIANTS.PEGASUS_BLUE, VARIANTS.BARREL_ROSE]);
    const cart = await t.getCart();
    t.assert(cart.item_count >= 3, `Expected 3+ items, got ${cart.item_count}`);
  });

  await t.test('Eleganto Case can be added via form-encoded', async () => {
    await t.addItem(VARIANTS.ELEGANTO_CASE, 1, { _eliminai_gift: 'true' });
    const cart = await t.getCart();
    const caseItem = cart.items.find(i => i.handle === GIFT_HANDLE);
    t.assert(caseItem, 'Case should be in cart');
    t.assertEqual(caseItem.variant_id, VARIANTS.ELEGANTO_CASE, 'Correct case variant');
  });

  // ===== GROUP 2: Discount behavior =====
  console.log('\nGroup 2: Discount Behavior');

  await t.test('1+2 FREE discount applies to 3 watches', async () => {
    await t.addItems([VARIANTS.LUXE_WHITE, VARIANTS.PEGASUS_BLUE, VARIANTS.BARREL_ROSE]);
    const cart = await t.getCart();
    // At least one item should be free (discounted to 0)
    const freeItems = cart.items.filter(i => i.final_price === 0);
    t.assert(freeItems.length >= 1, `Expected at least 1 free watch, got ${freeItems.length}`);
    // Total discount should be > 0
    t.assert(cart.total_discount > 0, `Expected discount > 0, got ${cart.total_discount}`);
  });

  await t.test('Eleganto Case is FREE when in cart (discount applies)', async () => {
    await t.addItems([VARIANTS.LUXE_WHITE, VARIANTS.PEGASUS_BLUE, VARIANTS.BARREL_ROSE]);
    await t.addItem(VARIANTS.ELEGANTO_CASE, 1, { _eliminai_gift: 'true' });
    const cart = await t.getCart();
    const caseItem = cart.items.find(i => i.handle === GIFT_HANDLE);
    t.assert(caseItem, 'Case should be in cart');
    t.assertEqual(caseItem.final_price, 0, 'Case final_price should be 0');
    t.assert(caseItem.discounts.length > 0, 'Case should have discount applied');
    t.assert(
      caseItem.discounts.some(d => d.title.includes('Eliminai Gift')),
      'Discount title should contain "Eliminai Gift"'
    );
  });

  await t.test('Case discount + 1+2 FREE combine correctly', async () => {
    await t.addItems([VARIANTS.LUXE_WHITE, VARIANTS.PEGASUS_BLUE, VARIANTS.BARREL_ROSE]);
    await t.addItem(VARIANTS.ELEGANTO_CASE, 1, { _eliminai_gift: 'true' });
    const cart = await t.getCart();

    const caseItem = cart.items.find(i => i.handle === GIFT_HANDLE);
    const watchItems = cart.items.filter(i => i.handle !== GIFT_HANDLE && !i.handle?.includes('shipping-protection'));

    // Case should be free
    t.assert(caseItem && caseItem.final_price === 0, 'Case should be $0');

    // At least 1 watch should be free (from 1+2 FREE)
    const freeWatches = watchItems.filter(i => i.final_price === 0);
    t.assert(freeWatches.length >= 1, `Expected 1+ free watches, got ${freeWatches.length}`);

    // Total should be roughly = price of 1 watch (most expensive paid)
    // Allow for shipping protection being auto-added
    const watchPrices = watchItems.map(i => i.price).sort((a, b) => b - a);
    const expectedMin = watchPrices[0]; // Most expensive watch
    const nonGiftTotal = cart.items
      .filter(i => i.handle !== GIFT_HANDLE)
      .reduce((sum, i) => sum + i.final_line_price, 0);
    t.assert(
      nonGiftTotal >= expectedMin && nonGiftTotal <= expectedMin + 1000,
      `Total (excl case) should be ~$${expectedMin/100}, got $${nonGiftTotal/100}`
    );
  });

  await t.test('Case alone is also free (no min requirement)', async () => {
    await t.addItem(VARIANTS.ELEGANTO_CASE);
    const cart = await t.getCart();
    const caseItem = cart.items.find(i => i.handle === GIFT_HANDLE);
    t.assert(caseItem, 'Case should be in cart');
    // Note: This is intentional — product is hidden, JS controls when to add
    t.assertEqual(caseItem.final_price, 0, 'Case should be free even alone');
  });

  // ===== GROUP 3: Gift add reliability =====
  console.log('\nGroup 3: Gift Add Reliability');

  await t.test('JSON items array FAILS for Eleganto Case (known Shopify bug)', async () => {
    // This test documents the known bug — if it starts passing, JSON is fixed
    const res = await fetch('https://elegantoshop.com/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: VARIANTS.ELEGANTO_CASE, quantity: 1 }] })
    });
    const data = await res.json();
    // If this starts passing (items.length > 0), the Shopify bug is fixed
    // Either way the test passes — it just documents current behavior
    if (data.items && data.items.length > 0) {
      console.log('    NOTE: JSON items array NOW works for this variant');
    } else {
      console.log('    NOTE: JSON items array still fails — form-encoded required');
    }
    t.assert(true, 'Documentation test');
  });

  await t.test('Form-encoded add always works for Eleganto Case', async () => {
    const res = await fetch('https://elegantoshop.com/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'id=' + VARIANTS.ELEGANTO_CASE + '&quantity=1'
    });
    const data = await res.json();
    t.assert(data.handle === GIFT_HANDLE, `Expected handle ${GIFT_HANDLE}, got ${data.handle}`);
  });

  // ===== GROUP 4: Cart total accuracy =====
  console.log('\nGroup 4: Cart Total Accuracy');

  await t.test('3 watches + free case = 1 watch price', async () => {
    await t.addItems([VARIANTS.LUXE_WHITE, VARIANTS.PEGASUS_BLUE, VARIANTS.BARREL_ROSE]);
    await t.addItem(VARIANTS.ELEGANTO_CASE, 1, { _eliminai_gift: 'true' });
    const cart = await t.getCart();

    // Find the most expensive watch (the one that's paid)
    const watches = cart.items.filter(i => i.handle !== GIFT_HANDLE && !i.handle?.includes('shipping-protection'));
    const paidWatches = watches.filter(i => i.final_price > 0);

    // The customer should pay for exactly 1 watch
    t.assert(paidWatches.length === 1, `Expected 1 paid watch, got ${paidWatches.length}`);

    // Case must be free in the total_price calculation
    const caseItem = cart.items.find(i => i.handle === GIFT_HANDLE);
    if (caseItem) {
      t.assertEqual(caseItem.final_line_price, 0, 'Case should contribute $0 to total');
    }
  });

  // ===== Cleanup and results =====
  await t.clearCart();
  const allPassed = t.summary();

  await p.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
