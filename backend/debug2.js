const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function gql(domain, token, query) {
  const res = await fetch('https://'+domain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return res.json();
}
async function main() {
  const test = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  const eleganto = await p.store.findUnique({ where: { id: 'cmnriegez0000jc70ro9nltw2' }, select: { shopDomain: true, accessToken: true } });
  const query = '{ automaticDiscountNodes(first: 20) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status usesPerOrderLimit startsAt endsAt combinesWith { productDiscounts orderDiscounts shippingDiscounts } customerBuys { items { ... on DiscountProducts { products(first: 5) { nodes { id title status } } } ... on AllDiscountItems { allItems } } value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first: 5) { nodes { id title status } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } ... on DiscountAutomaticBasic { title status } } } } }';

  function printDiscount(n) {
    var d = n.automaticDiscount;
    if (!d.customerBuys) { console.log('  ' + d.title + ' [' + d.status + '] (Basic)'); return; }
    console.log('\n  TITLE: ' + d.title + ' [' + d.status + ']');
    console.log('  ID: ' + n.id);
    console.log('  usesPerOrderLimit: ' + d.usesPerOrderLimit);
    console.log('  startsAt: ' + d.startsAt + ' | endsAt: ' + d.endsAt);
    console.log('  combinesWith: product=' + d.combinesWith.productDiscounts + ' order=' + d.combinesWith.orderDiscounts + ' shipping=' + d.combinesWith.shippingDiscounts);
    console.log('  customerBuys:');
    console.log('    quantity: ' + d.customerBuys.value.quantity);
    var buyItems = d.customerBuys.items;
    if (buyItems.allItems !== undefined) {
      console.log('    items: ALL ITEMS');
    } else if (buyItems.products) {
      console.log('    products: ' + buyItems.products.nodes.map(function(p) { return p.title + ' [' + p.status + ']'; }).join(', '));
    }
    console.log('  customerGets:');
    if (d.customerGets.items.products) {
      console.log('    products: ' + d.customerGets.items.products.nodes.map(function(p) { return p.title + ' [' + p.status + ']'; }).join(', '));
    }
    var val = d.customerGets.value;
    if (val && val.quantity) {
      console.log('    qty: ' + val.quantity.quantity + ' at ' + (val.effect ? val.effect.percentage * 100 : '?') + '% off');
    }
  }

  console.log('=== TEST STORE ===');
  var td = await gql(test.shopDomain, test.accessToken, query);
  if (td.errors) console.log('ERRORS:', JSON.stringify(td.errors));
  for (var n of (td.data?.automaticDiscountNodes?.nodes || [])) printDiscount(n);

  console.log('\n\n=== ELEGANTO ===');
  var ed = await gql(eleganto.shopDomain, eleganto.accessToken, query);
  if (ed.errors) console.log('ERRORS:', JSON.stringify(ed.errors));
  for (var n of (ed.data?.automaticDiscountNodes?.nodes || [])) printDiscount(n);
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
