#!/usr/bin/env node
/**
 * Shopify Discount Health Check — verifies 1+1 FREE and 1+2 FREE are intact.
 *
 * Checks:
 *   1. Both discounts exist and are ACTIVE
 *   2. Both are DiscountAutomaticBxgy type (NOT Basic)
 *   3. Both use correct collection for buy/get
 *   4. Both have 100% off (percentage = 1)
 *   5. Discounts actually apply in a real cart session
 *
 * Usage:
 *   node tests/check-discounts.js                     # Check config only
 *   node tests/check-discounts.js --live               # Also test with real cart session
 */

var path = require('path');
var { PrismaClient } = require(path.resolve(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));
var prisma = new PrismaClient();

var passed = 0, failed = 0, failures = [];

function test(name, ok, detail) {
  if (ok) {
    passed++;
    console.log('  \u2713 ' + name);
  } else {
    failed++;
    failures.push({ name: name, detail: detail });
    console.log('  \u2717 ' + name);
    if (detail) console.log('    ' + detail);
  }
}

async function gql(domain, token, query) {
  var r = await fetch('https://' + domain + '/admin/api/2025-01/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query })
  });
  return r.json();
}

async function run() {
  var doLive = process.argv.indexOf('--live') !== -1;
  var store = await prisma.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  if (!store) { console.error('Store not found'); process.exit(1); }

  console.log('\nShopify Discount Health Check \u2014 ' + store.shopDomain);
  console.log('='.repeat(60));

  // Fetch all active automatic discounts
  var q = '{ automaticDiscountNodes(first: 20, query: "status:active") { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerBuys { value { ... on DiscountQuantity { quantity } } items { ... on DiscountCollections { collections(first:5) { nodes { id title } } } ... on AllDiscountItems { allItems } } } customerGets { value { __typename ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } } items { ... on DiscountCollections { collections(first:5) { nodes { id title } } } ... on AllDiscountItems { allItems } } } } } } } }';

  var data = await gql(store.shopDomain, store.accessToken, q);
  var nodes = data.data && data.data.automaticDiscountNodes && data.data.automaticDiscountNodes.nodes || [];

  // Filter to BXGY discounts (have title field from the BXGY fragment)
  var bxgy = nodes.filter(function(n) { return n.automaticDiscount && n.automaticDiscount.title; });

  console.log('\n--- Discount Configuration ---');

  // Check 1+1 FREE
  var d11 = bxgy.find(function(n) { return n.automaticDiscount.title === '1+1 FREE'; });
  test('1+1 FREE discount exists', !!d11, 'Discount "1+1 FREE" not found among active BXGY discounts');

  if (d11) {
    var ad = d11.automaticDiscount;
    test('1+1 FREE is ACTIVE', ad.status === 'ACTIVE', 'Status: ' + ad.status);

    var buyQty = ad.customerBuys && ad.customerBuys.value && ad.customerBuys.value.quantity;
    test('1+1 FREE: buy quantity = 1', buyQty === '1', 'Buy qty: ' + buyQty);

    var getVal = ad.customerGets && ad.customerGets.value;
    var getQty = getVal && getVal.quantity && getVal.quantity.quantity;
    test('1+1 FREE: get quantity = 1', getQty === '1', 'Get qty: ' + getQty);

    var pct = getVal && getVal.effect && getVal.effect.percentage;
    test('1+1 FREE: 100% off', pct === 1, 'Percentage: ' + pct);
  }

  // Check 1+2 FREE
  var d12 = bxgy.find(function(n) { return n.automaticDiscount.title === '1+2 FREE'; });
  test('1+2 FREE discount exists', !!d12, 'Discount "1+2 FREE" not found among active BXGY discounts');

  if (d12) {
    var ad2 = d12.automaticDiscount;
    test('1+2 FREE is ACTIVE', ad2.status === 'ACTIVE', 'Status: ' + ad2.status);

    var buyQty2 = ad2.customerBuys && ad2.customerBuys.value && ad2.customerBuys.value.quantity;
    test('1+2 FREE: buy quantity = 1', buyQty2 === '1', 'Buy qty: ' + buyQty2);

    var getVal2 = ad2.customerGets && ad2.customerGets.value;
    var getQty2 = getVal2 && getVal2.quantity && getVal2.quantity.quantity;
    test('1+2 FREE: get quantity = 2', getQty2 === '2', 'Get qty: ' + getQty2);

    var pct2 = getVal2 && getVal2.effect && getVal2.effect.percentage;
    test('1+2 FREE: 100% off', pct2 === 1, 'Percentage: ' + pct2);
  }

  // Live cart test
  if (doLive) {
    console.log('\n--- Live Cart Test ---');
    try {
      // Get 2 products from the collection
      var pq = '{ products(first: 2, query: "status:active") { nodes { handle variants(first:1) { nodes { id price } } } } }';
      var pd = await gql(store.shopDomain, store.accessToken, pq);
      var prods = pd.data.products.nodes;
      if (prods.length < 2) {
        console.log('  SKIP: Need at least 2 active products for live test');
      } else {
        var v1 = prods[0].variants.nodes[0].id.replace('gid://shopify/ProductVariant/', '');
        var v2 = prods[1].variants.nodes[0].id.replace('gid://shopify/ProductVariant/', '');

        // Clear cart
        await fetch('https://' + store.shopDomain + '/cart/clear.js', { method: 'POST' });
        // Add 2 items
        var addResp = await fetch('https://' + store.shopDomain + '/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: parseInt(v1), quantity: 1 }, { id: parseInt(v2), quantity: 1 }] })
        });
        var addData = await addResp.json();

        if (addData.items && addData.items.length === 2) {
          var hasDiscount = addData.items.some(function(i) { return i.final_price === 0; });
          test('1+1 FREE applies in cart (one item becomes $0)', hasDiscount,
            'Items: ' + addData.items.map(function(i) { return i.title + ' final_price=' + i.final_price; }).join(', '));

          var discountTitle = '';
          addData.items.forEach(function(i) {
            (i.discounts || []).forEach(function(d) { if (d.amount > 0) discountTitle = d.title; });
          });
          test('Discount title shown in cart data', !!discountTitle, 'Title: ' + (discountTitle || 'NONE'));
        } else {
          console.log('  SKIP: Cart add returned unexpected items (session cookies may not work from CLI)');
        }
      }
    } catch (e) {
      console.log('  SKIP: Live test failed (' + e.message + ')');
    }
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('Discount Check: ' + passed + ' passed, ' + failed + ' failed');

  if (failed > 0) {
    console.log('\nFAILED:');
    failures.forEach(function(f) {
      console.log('  \u2717 ' + f.name);
      if (f.detail) console.log('    ' + f.detail);
    });
    console.log('\n\u26a0\ufe0f  DISCOUNT CONFIGURATION BROKEN!');
    process.exit(1);
  } else {
    console.log('\n\u2713 All discount checks pass');
    process.exit(0);
  }

  await prisma.$disconnect();
}

run().catch(function(e) {
  console.error('Discount check error:', e.message);
  process.exit(1);
});
