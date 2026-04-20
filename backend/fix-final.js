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

  // Delete current discounts
  var existing = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title } } } } }'
  );
  for (var n of (existing.data?.automaticDiscountNodes?.nodes || [])) {
    if (n.automaticDiscount.title && n.automaticDiscount.title.startsWith('Gift')) {
      console.log('Deleting: ' + n.automaticDiscount.title + ' (' + n.id + ')');
      await gql(store.shopDomain, store.accessToken,
        'mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }',
        { id: n.id }
      );
    }
  }

  // Get all product GIDs
  var prodRes = await gql(store.shopDomain, store.accessToken,
    '{ products(first: 50, query: "status:active") { nodes { id } } }'
  );
  var allGids = prodRes.data.products.nodes.map(function(n) { return n.id; });

  // Recreate with quantity "1" (like Eleganto)
  // The cart drawer controls when gifts appear. Shopify just needs to discount them.
  var gifts = [
    { title: 'Gift #2', productGid: 'gid://shopify/Product/10168411947321' },  // Compare Snowboard
    { title: 'Gift #3', productGid: 'gid://shopify/Product/10168412045625' },  // Videographer Snowboard
  ];

  for (var g of gifts) {
    console.log('\nCreating ' + g.title + ' (buy 1 any item -> get product free)');
    var r = await gql(store.shopDomain, store.accessToken,
      'mutation($d: DiscountAutomaticBxgyInput!) { discountAutomaticBxgyCreate(automaticBxgyDiscount: $d) { automaticDiscountNode { id automaticDiscount { ... on DiscountAutomaticBxgy { title status } } } userErrors { field message } } }',
      {
        d: {
          title: g.title,
          startsAt: new Date().toISOString(),
          customerBuys: {
            items: { products: { productsToAdd: allGids } },
            value: { quantity: "1" }
          },
          customerGets: {
            items: { products: { productsToAdd: [g.productGid] } },
            value: { discountOnQuantity: { quantity: "1", effect: { percentage: 1.0 } } }
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
  }

  // Verify
  console.log('\n=== FINAL VERIFICATION ===');
  var v = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status usesPerOrderLimit customerBuys { value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first:3) { nodes { title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } combinesWith { productDiscounts orderDiscounts shippingDiscounts } } } } } }'
  );
  for (var n of (v.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerBuys) continue;
    console.log('\n' + d.title + ' [' + d.status + ']');
    console.log('  usesPerOrderLimit: ' + d.usesPerOrderLimit);
    console.log('  Buy qty: ' + d.customerBuys.value.quantity + ' (same as Eleganto!)');
    console.log('  Get: ' + d.customerGets.items.products.nodes.map(function(p){return p.title}).join(', '));
    console.log('  Discount: ' + (d.customerGets.value.effect.percentage * 100) + '% off');
    console.log('  Combines: product=' + d.combinesWith.productDiscounts + ' order=' + d.combinesWith.orderDiscounts + ' shipping=' + d.combinesWith.shippingDiscounts);
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
