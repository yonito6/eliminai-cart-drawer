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

  // Delete existing broken automatic discounts
  var ids = [
    'gid://shopify/DiscountAutomaticNode/1892467114297',
    'gid://shopify/DiscountAutomaticNode/1892467147065'
  ];
  for (var id of ids) {
    console.log('Deleting ' + id);
    var r = await gql(store.shopDomain, store.accessToken,
      'mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }',
      { id: id }
    );
    console.log(JSON.stringify(r.data));
  }

  // Now recreate with correct config (all items, no usesPerOrderLimit)
  var gifts = [
    { title: 'Gift #2', tierGoal: 3, productGid: 'gid://shopify/Product/9831556989241' }, // Compare at Price Snowboard
    { title: 'Gift #3', tierGoal: 4, productGid: 'gid://shopify/Product/9831557054777' }, // Videographer Snowboard
  ];

  for (var g of gifts) {
    console.log('\nCreating ' + g.title + ' (buy ' + g.tierGoal + ' any items -> get product free)');
    var r = await gql(store.shopDomain, store.accessToken,
      'mutation($d: DiscountAutomaticBxgyInput!) { discountAutomaticBxgyCreate(automaticBxgyDiscount: $d) { automaticDiscountNode { id automaticDiscount { ... on DiscountAutomaticBxgy { title status } } } userErrors { field message } } }',
      {
        d: {
          title: g.title,
          startsAt: new Date().toISOString(),
          customerBuys: {
            items: { all: true },
            value: { quantity: String(g.tierGoal) }
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
  console.log('\n=== VERIFICATION ===');
  var v = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerBuys { items { ... on AllDiscountItems { allItems } } value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first:3) { nodes { title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } } } } }'
  );
  for (var n of (v.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerBuys) continue;
    console.log(d.title + ' [' + d.status + ']');
    console.log('  Buy: ' + d.customerBuys.value.quantity + ' of ' + (d.customerBuys.items.allItems ? 'ALL ITEMS' : 'specific'));
    console.log('  Get: ' + (d.customerGets.items.products?.nodes?.map(function(p){return p.title}).join(', ') || '?'));
    console.log('  Discount: ' + (d.customerGets.value?.effect?.percentage * 100) + '% off');
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
