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

  // Delete ALL existing gift discounts
  var existing = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title } } } } }'
  );
  for (var n of (existing.data?.automaticDiscountNodes?.nodes || [])) {
    if (n.automaticDiscount.title && n.automaticDiscount.title.startsWith('Gift')) {
      console.log('Deleting: ' + n.automaticDiscount.title);
      await gql(store.shopDomain, store.accessToken,
        'mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }',
        { id: n.id }
      );
    }
  }

  // Get all product GIDs for customerBuys
  var prodRes = await gql(store.shopDomain, store.accessToken,
    '{ products(first: 50, query: "status:active") { nodes { id } } }'
  );
  var allGids = prodRes.data.products.nodes.map(function(n) { return n.id; });

  // Create ONE discount: buy 1 item -> get up to 2 gift products free
  // Both gift products in customerGets, quantity 2
  var compareGid = 'gid://shopify/Product/10168411947321';
  var videographerGid = 'gid://shopify/Product/10168412045625';

  console.log('\nCreating SINGLE discount: buy 1 -> get up to 2 gifts free');
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
          items: { products: { productsToAdd: [compareGid, videographerGid] } },
          value: { discountOnQuantity: { quantity: "2", effect: { percentage: 1.0 } } }
        },
        combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true }
      }
    }
  );
  if (r.data?.discountAutomaticBxgyCreate?.userErrors?.length > 0) {
    console.log('ERROR:', JSON.stringify(r.data.discountAutomaticBxgyCreate.userErrors));
  } else {
    console.log('Created:', JSON.stringify(r.data?.discountAutomaticBxgyCreate?.automaticDiscountNode));
  }

  // Verify
  console.log('\n=== VERIFICATION ===');
  var v = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status usesPerOrderLimit customerBuys { value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first:5) { nodes { title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } } } } }'
  );
  for (var n of (v.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerBuys) continue;
    console.log(d.title + ' [' + d.status + ']');
    console.log('  Buy: ' + d.customerBuys.value.quantity + ' item(s)');
    console.log('  Get: ' + d.customerGets.items.products.nodes.map(function(p){return p.title}).join(' + '));
    console.log('  Qty: ' + d.customerGets.value.quantity.quantity + ' at ' + (d.customerGets.value.effect.percentage * 100) + '% off');
    console.log('  usesPerOrderLimit: ' + d.usesPerOrderLimit);
  }

  // Compare with Eleganto
  console.log('\n=== ELEGANTO (reference) ===');
  var el = await p.store.findUnique({ where: { id: 'cmnriegez0000jc70ro9nltw2' }, select: { shopDomain: true, accessToken: true } });
  var ev = await gql(el.shopDomain, el.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { automaticDiscount { ... on DiscountAutomaticBxgy { title status usesPerOrderLimit customerBuys { value { ... on DiscountQuantity { quantity } } } customerGets { value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } } } } }'
  );
  for (var n of (ev.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerBuys) continue;
    console.log(d.title + ': buy ' + d.customerBuys.value.quantity + ' get ' + d.customerGets.value.quantity.quantity + ' at ' + (d.customerGets.value.effect.percentage*100) + '% off, limit=' + d.usesPerOrderLimit);
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
