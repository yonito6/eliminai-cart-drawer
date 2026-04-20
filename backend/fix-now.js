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

  // Check what exists now
  var existing = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 20) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerGets { items { ... on DiscountProducts { products(first: 5) { nodes { id title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } } } } } } } } }'
  );
  
  console.log('=== CURRENT DISCOUNTS ===');
  var giftDiscountIds = [];
  var allGiftProductGids = [];
  for (var n of (existing.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.title) continue;
    console.log(d.title + ' [' + d.status + '] id=' + n.id);
    if (d.customerGets && d.customerGets.items && d.customerGets.items.products) {
      var prods = d.customerGets.items.products.nodes;
      console.log('  Get products: ' + prods.map(function(p) { return p.title + ' (' + p.id + ')'; }).join(', '));
      console.log('  Get qty: ' + (d.customerGets.value?.quantity?.quantity || '?'));
      
      if (d.title.startsWith('Gift') || d.title === 'Free Gifts') {
        giftDiscountIds.push(n.id);
        for (var prod of prods) {
          if (allGiftProductGids.indexOf(prod.id) === -1) {
            allGiftProductGids.push(prod.id);
          }
        }
      }
    }
  }

  console.log('\nGift product GIDs to combine:', allGiftProductGids.length);
  console.log(allGiftProductGids);

  if (allGiftProductGids.length === 0) {
    console.log('No gift products found!');
    return;
  }

  // Delete all existing gift discounts
  for (var id of giftDiscountIds) {
    console.log('\nDeleting: ' + id);
    await gql(store.shopDomain, store.accessToken,
      'mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }',
      { id: id }
    );
  }

  // Get all products for customerBuys
  var prodRes = await gql(store.shopDomain, store.accessToken,
    '{ products(first: 50, query: "status:active") { nodes { id } } }'
  );
  var allGids = prodRes.data.products.nodes.map(function(n) { return n.id; });

  // Create ONE discount with ALL gift products
  console.log('\nCreating single "Free Gifts" discount with ' + allGiftProductGids.length + ' gift products, qty=' + allGiftProductGids.length);
  var r = await gql(store.shopDomain, store.accessToken,
    'mutation($d: DiscountAutomaticBxgyInput!) { discountAutomaticBxgyCreate(automaticBxgyDiscount: $d) { automaticDiscountNode { id automaticDiscount { ... on DiscountAutomaticBxgy { title status } } } userErrors { field message } } }',
    {
      d: {
        title: 'Free Gifts',
        startsAt: new Date().toISOString(),
        customerBuys: {
          items: { products: { productsToAdd: allGids } },
          value: { quantity: "1" }
        },
        customerGets: {
          items: { products: { productsToAdd: allGiftProductGids } },
          value: { discountOnQuantity: { quantity: String(allGiftProductGids.length), effect: { percentage: 1.0 } } }
        },
        combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true }
      }
    }
  );
  if (r.data?.discountAutomaticBxgyCreate?.userErrors?.length > 0) {
    console.log('ERROR:', JSON.stringify(r.data.discountAutomaticBxgyCreate.userErrors));
  } else {
    console.log('Created: ' + JSON.stringify(r.data?.discountAutomaticBxgyCreate?.automaticDiscountNode));
  }

  // Verify
  console.log('\n=== FINAL STATE ===');
  var v = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { automaticDiscount { ... on DiscountAutomaticBxgy { title status customerGets { items { ... on DiscountProducts { products(first:5) { nodes { title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } } } } }'
  );
  for (var n of (v.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerGets) continue;
    console.log(d.title + ' [' + d.status + ']');
    console.log('  Products: ' + d.customerGets.items.products.nodes.map(function(p){return p.title}).join(' + '));
    console.log('  Qty: ' + d.customerGets.value.quantity.quantity + ' at ' + (d.customerGets.value.effect.percentage*100) + '% off');
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
