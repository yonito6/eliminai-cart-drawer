const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  var res = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ automaticDiscountNodes(first: 10) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status usesPerOrderLimit customerBuys { items { ... on AllDiscountItems { allItems } ... on DiscountProducts { products(first:3) { nodes { title status } } } } value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first:3) { nodes { title status } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } combinesWith { productDiscounts orderDiscounts shippingDiscounts } } } } } }' })
  });
  var data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
