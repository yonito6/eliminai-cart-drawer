const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { shopDomain: true, accessToken: true },
  });

  // Check ALL discount types - automatic AND code-based
  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNodes(first: 50) {
        nodes {
          id
          automaticDiscount {
            __typename
            ... on DiscountAutomaticBxgy { title status }
            ... on DiscountAutomaticBasic { title status }
            ... on DiscountAutomaticApp { title status }
            ... on DiscountAutomaticFreeShipping { title status }
          }
        }
      }
      codeDiscountNodes(first: 50) {
        nodes {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeBxgy { title status }
            ... on DiscountCodeBasic { title status }
            ... on DiscountCodeFreeShipping { title status }
            ... on DiscountCodeApp { title status }
          }
        }
      }
    }` }),
  });
  const data = await res.json();

  console.log('=== AUTOMATIC DISCOUNTS ===');
  for (const n of data?.data?.automaticDiscountNodes?.nodes || []) {
    const d = n.automaticDiscount;
    console.log(`  ${d.title || '(no title)'} | ${d.__typename} | ${d.status} | ${n.id}`);
  }

  console.log('\n=== CODE DISCOUNTS ===');
  for (const n of data?.data?.codeDiscountNodes?.nodes || []) {
    const d = n.codeDiscount;
    console.log(`  ${d.title || '(no title)'} | ${d.__typename} | ${d.status} | ${n.id}`);
  }

  if (data.errors) console.log('\nErrors:', JSON.stringify(data.errors));
  await p.$disconnect();
})();
