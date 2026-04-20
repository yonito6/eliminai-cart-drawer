const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function shopifyGraphQL(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true },
  });

  // 1. Find existing gift discounts
  const existing = await shopifyGraphQL(store.shopDomain, store.accessToken, `{
    automaticDiscountNodes(first: 50, query: "title:Gift -* OR title:Free Gift* OR title:Eliminai Gift*") {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic { title status }
        }
      }
    }
  }`);

  const nodes = existing?.data?.automaticDiscountNodes?.nodes || [];
  console.log('Found', nodes.length, 'existing gift discounts:');
  for (const n of nodes) {
    const title = n.automaticDiscount?.title || '(unknown)';
    console.log('  -', title, '→ deleting', n.id);
    await shopifyGraphQL(store.shopDomain, store.accessToken, `
      mutation discountAutomaticDelete($id: ID!) {
        discountAutomaticDelete(id: $id) { userErrors { field message } }
      }
    `, { id: n.id });
  }

  // 2. Trigger the gift-discounts API to recreate them with new names
  console.log('\nTriggering gift discount re-creation via API...');
  const apiUrl = `https://eliminai-cart-drawer-production.up.railway.app/api/stores/${store.id}/gift-discounts`;
  const res = await fetch(apiUrl, { method: 'POST' });
  const result = await res.json();
  console.log('Result:', JSON.stringify(result, null, 2));

  await p.$disconnect();
})();
