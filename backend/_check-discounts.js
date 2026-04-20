const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ automaticDiscountNodes(first: 20) { nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status startsAt endsAt combinesWith { productDiscounts orderDiscounts shippingDiscounts } customerBuys { value { ... on DiscountQuantity { quantity } } } customerGets { value { ... on DiscountPercentage { percentage } } } } ... on DiscountAutomaticBasic { title status startsAt endsAt } } } } }' })
  });
  const data = await res.json();
  const nodes = data?.data?.automaticDiscountNodes?.nodes || [];
  if (nodes.length === 0) console.log('NO automatic discounts found!');
  nodes.forEach(n => {
    const d = n.automaticDiscount;
    console.log('---');
    console.log('ID:', n.id);
    console.log('Title:', d.title);
    console.log('Status:', d.status);
    console.log('Ends:', d.endsAt || 'never');
    if (d.combinesWith) console.log('Combines:', JSON.stringify(d.combinesWith));
    if (d.customerBuys) console.log('Buys:', JSON.stringify(d.customerBuys));
    if (d.customerGets) console.log('Gets:', JSON.stringify(d.customerGets));
  });
  await p.$disconnect();
})();
