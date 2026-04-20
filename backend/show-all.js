const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  
  // Show all products
  var res = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ products(first: 20, query: "status:active") { nodes { id title handle } } }' })
  });
  var data = await res.json();
  console.log('Active products:');
  for (var pr of data.data.products.nodes) {
    console.log('  ' + pr.handle + ' — ' + pr.title + ' (' + pr.id + ')');
  }

  // Show current discounts
  var dRes = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerGets { items { ... on DiscountProducts { products(first:5) { nodes { title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } } } } } } } } }' })
  });
  var dData = await dRes.json();
  console.log('\nCurrent discounts:');
  for (var n of (dData.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerGets) continue;
    var prods = d.customerGets.items.products?.nodes?.map(function(p){return pr.title}).join(' + ') || '?';
    console.log('  ' + d.title + ' [' + d.status + '] — get: ' + prods + ' qty=' + (d.customerGets.value?.quantity?.quantity || '?'));
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
