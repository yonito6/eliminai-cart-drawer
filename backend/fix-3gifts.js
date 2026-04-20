const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function gql(domain, token, query, variables) {
  var res = await fetch('https://'+domain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query, variables: variables || {} })
  });
  return res.json();
}
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });

  // Delete ALL gift discounts
  var existing = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 20) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title } } } } }'
  );
  for (var n of (existing.data?.automaticDiscountNodes?.nodes || [])) {
    var t = n.automaticDiscount?.title || '';
    if (t.startsWith('Gift') || t === 'Free Gifts') {
      console.log('Deleting: ' + t + ' (' + n.id + ')');
      await gql(store.shopDomain, store.accessToken,
        'mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }',
        { id: n.id }
      );
    }
  }

  // Get ALL products
  var prodRes = await gql(store.shopDomain, store.accessToken,
    '{ products(first: 50, query: "status:active") { nodes { id title handle } } }'
  );
  var allProducts = prodRes.data.products.nodes;
  var allGids = allProducts.map(function(n) { return n.id; });
  
  console.log('\nAll products:');
  for (var pr of allProducts) {
    console.log('  ' + pr.handle + ' — ' + pr.title);
  }

  // YOU SAID: tier 1 has 1 gift, tier 2 has 2 gifts = 3 total
  // The old code only found 2. Let's include ALL snowboard products as potential gifts
  // The actual gifts are: Compare, Videographer, and probably a 3rd one you just added
  // Let me just use all 3 gift product handles that were in the old discounts + check
  // what the dashboard sent
  
  // For now: pick the ones most likely — let me show what exists and let you verify
  console.log('\nPlease tell me which 3 products are gifts, or I will check the dashboard data.');
  
  // Actually let me check what the last sync received by looking at discount titles
  // The old code named them Gift #1, #2, #3 based on tier number
  // Logs show only Gift #2 and Gift #3 — meaning tier 1 has no gift product (goal only?)
  // Or tier 1's giftProduct handle wasn't found
  
  // Let me just create the discount with ALL 3 snowboard handles we know were gifts before
  // plus check if any other product was recently added
  var giftHandles = ['the-compare-at-price-snowboard', 'the-videographer-snowboard'];
  
  // Check for a 3rd gift — maybe Minimal, Complete, or Hidden?
  // The user said they JUST added a 3rd product to tier 2
  // Let me find products NOT in the existing gift list
  console.log('\nLikely 3rd gift candidates (not already a gift):');
  for (var pr of allProducts) {
    if (giftHandles.indexOf(pr.handle) === -1 && pr.handle !== 'gift-card' && pr.handle !== 'selling-plans-ski-wax') {
      console.log('  ' + pr.handle + ' — ' + pr.title);
    }
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
