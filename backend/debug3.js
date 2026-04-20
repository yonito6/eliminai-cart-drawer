const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function gql(domain, token, query, variables) {
  const res = await fetch('https://'+domain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
async function main() {
  var s = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });

  var handles = ['the-compare-at-price-snowboard', 'the-videographer-snowboard', 'the-inventory-not-tracked-snowboard'];
  for (var h of handles) {
    var r = await gql(s.shopDomain, s.accessToken, 'query p($id: ProductIdentifierInput!) { productByIdentifier(identifier: $id) { id title status } }', { id: { handle: h } });
    var prod = r.data && r.data.productByIdentifier;
    console.log(h, '->', prod ? prod.title + ' [' + prod.status + '] ' + prod.id : 'NOT FOUND');
  }

  var dq = await gql(s.shopDomain, s.accessToken, '{ automaticDiscountNodes(first: 20) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerGets { items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } customerBuys { value { ... on DiscountQuantity { quantity } } } } ... on DiscountAutomaticBasic { title status } } } } }');
  console.log('\nCurrent discounts:');
  var nodes = dq.data && dq.data.automaticDiscountNodes && dq.data.automaticDiscountNodes.nodes || [];
  for (var n of nodes) {
    var d = n.automaticDiscount;
    if (!d.customerBuys) { console.log('  ' + d.title + ' [' + d.status + '] (Basic)'); continue; }
    console.log('  ' + d.title + ' [' + d.status + ']');
    console.log('    buys qty:', d.customerBuys.value.quantity);
    var prods = d.customerGets && d.customerGets.items && d.customerGets.items.products && d.customerGets.items.products.nodes || [];
    console.log('    gets products:', prods.map(function(x) { return x.title; }).join(', '));
    var val = d.customerGets && d.customerGets.value;
    if (val && val.quantity) {
      console.log('    gets qty:', val.quantity.quantity, 'at', (val.effect ? val.effect.percentage * 100 : '?') + '% off');
    }
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
