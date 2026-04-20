const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  var res = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerGets { items { ... on DiscountProducts { products(first:10) { nodes { title handle } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } } } } } } } } }' })
  });
  var data = await res.json();
  for (var n of (data.data?.automaticDiscountNodes?.nodes || [])) {
    var d = n.automaticDiscount;
    if (!d.customerGets) continue;
    var prods = d.customerGets.items.products?.nodes || [];
    console.log(d.title + ' [' + d.status + '] — qty=' + (d.customerGets.value?.quantity?.quantity || '?'));
    console.log('  Products (' + prods.length + '): ' + prods.map(function(p){return p.title + ' (' + p.handle + ')'}).join(', '));
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
