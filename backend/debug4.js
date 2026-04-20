const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function gql(domain, token, query, variables) {
  var res = await fetch('https://'+domain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
async function main() {
  var s = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  var r = await gql(s.shopDomain, s.accessToken, '{ automaticDiscountNodes(first: 10, query: "title:Free Gifts") { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status startsAt endsAt usesPerOrderLimit combinesWith { productDiscounts orderDiscounts shippingDiscounts } customerBuys { items { ... on DiscountProducts { products(first: 20) { nodes { id title status } } } ... on AllDiscountItems { allItems } } value { ... on DiscountQuantity { quantity } } } customerGets { items { ... on DiscountProducts { products(first: 10) { nodes { id title status } } } } value { ... on DiscountOnQuantity { quantity { ... on DiscountQuantity { quantity } } effect { ... on DiscountPercentage { percentage } } } } } } } } } }');
  var nodes = r.data.automaticDiscountNodes.nodes;
  for (var n of nodes) {
    var d = n.automaticDiscount;
    console.log('=== ' + d.title + ' [' + d.status + '] ===');
    console.log('ID:', n.id);
    console.log('startsAt:', d.startsAt);
    console.log('endsAt:', d.endsAt);
    console.log('usesPerOrderLimit:', d.usesPerOrderLimit);
    console.log('combinesWith:', JSON.stringify(d.combinesWith));
    console.log('\ncustomerBuys:');
    console.log('  quantity:', d.customerBuys.value.quantity);
    var buyItems = d.customerBuys.items;
    if (buyItems.allItems !== undefined) {
      console.log('  items: ALL');
    } else if (buyItems.products) {
      console.log('  products (' + buyItems.products.nodes.length + '):');
      for (var bp of buyItems.products.nodes) {
        console.log('    ' + bp.title + ' [' + bp.status + '] ' + bp.id);
      }
    }
    console.log('\ncustomerGets:');
    var getProds = d.customerGets.items.products.nodes;
    console.log('  products (' + getProds.length + '):');
    for (var gp of getProds) {
      console.log('    ' + gp.title + ' [' + gp.status + '] ' + gp.id);
    }
    console.log('  qty:', d.customerGets.value.quantity.quantity);
    console.log('  effect:', d.customerGets.value.effect.percentage * 100 + '% off');
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
