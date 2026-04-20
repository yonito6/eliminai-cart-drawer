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

  // Correct product GIDs
  var compareSnowboard = 'gid://shopify/Product/10168411947321';
  var videographerSnowboard = 'gid://shopify/Product/10168412045625';

  // Get ALL product GIDs for customerBuys
  var allRes = await gql(store.shopDomain, store.accessToken,
    '{ products(first: 50, query: "status:active") { nodes { id } } }'
  );
  var allGids = allRes.data.products.nodes.map(function(n) { return n.id; });
  console.log('All product GIDs:', allGids.length);

  var gifts = [
    { title: 'Gift #2', tierGoal: 3, productGid: compareSnowboard },
    { title: 'Gift #3', tierGoal: 4, productGid: videographerSnowboard },
  ];

  for (var g of gifts) {
    console.log('\nCreating ' + g.title + ' (buy ' + g.tierGoal + ' -> get product free)');
    
    // Try with products list first (matching what worked before, but with correct GIDs)
    // Also remove usesPerOrderLimit
    var r = await gql(store.shopDomain, store.accessToken,
      'mutation($d: DiscountAutomaticBxgyInput!) { discountAutomaticBxgyCreate(automaticBxgyDiscount: $d) { automaticDiscountNode { id automaticDiscount { ... on DiscountAutomaticBxgy { title status } } } userErrors { field message } } }',
      {
        d: {
          title: g.title,
          startsAt: new Date().toISOString(),
          customerBuys: {
            items: { products: { productsToAdd: allGids } },
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
    if (r.errors) console.log('GQL errors:', JSON.stringify(r.errors));
  }

  // Verify
  console.log('\n=== VERIFICATION ===');
  var v = await gql(store.shopDomain, store.accessToken,
    '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerBuys { items { ... on AllDiscountItems { allItems } ... on DiscountProducts { products(first:3) { nodes { title } } } } value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first:3) { nodes { title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } } } } }'
  );
  for (var n of (v.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerBuys) continue;
    console.log(d.title + ' [' + d.status + ']');
    console.log('  Buy qty: ' + d.customerBuys.value.quantity);
    var bi = d.customerBuys.items;
    if (bi.allItems) console.log('  Buy items: ALL');
    else if (bi.products) console.log('  Buy items: ' + bi.products.nodes.map(function(p){return p.title}).join(', '));
    else console.log('  Buy items: (empty?)');
    console.log('  Get: ' + (d.customerGets.items.products?.nodes?.map(function(p){return p.title}).join(', ') || '?'));
    console.log('  Discount: ' + (d.customerGets.value?.effect?.percentage * 100) + '% off');
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
