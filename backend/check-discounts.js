const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const s = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true },
  });

  const res = await fetch(`https://${s.shopDomain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': s.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{ discountAutomaticNodes(first: 50, query: "title:Eliminai Gift*") { nodes { id automaticDiscount { ... on DiscountAutomaticBasic { title status } } } } }`
    })
  });

  const data = await res.json();
  const nodes = data?.data?.discountAutomaticNodes?.nodes ?? [];
  console.log('Existing Eliminai Gift discounts:', nodes.length);
  nodes.forEach(n => console.log(' -', n.automaticDiscount?.title, '|', n.automaticDiscount?.status));

  if (nodes.length === 0) {
    console.log('\nNo gift discounts exist yet. Safe to test.');
  }

  await p.$disconnect();
})();
