const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function gql(domain, token, query, variables) {
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
    select: { shopDomain: true, accessToken: true, id: true },
  });

  // Just call the gift-discounts API which will recreate it properly
  console.log('Triggering gift discount re-creation via deployed API...');
  const apiUrl = `https://eliminai-cart-drawer-production.up.railway.app/api/stores/${store.id}/gift-discounts`;
  const res = await fetch(apiUrl, { method: 'POST' });
  const result = await res.json();
  console.log('Result:', JSON.stringify(result, null, 2));

  // Verify the discount was created
  console.log('\nVerifying...');
  const check = await gql(store.shopDomain, store.accessToken, `{
    automaticDiscountNodes(first: 10, query: "title:Gift*") {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
            minimumRequirement {
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
            customerGets {
              value {
                ... on DiscountPercentage { percentage }
              }
            }
          }
        }
      }
    }
  }`);
  const nodes = check?.data?.automaticDiscountNodes?.nodes || [];
  for (const n of nodes) {
    const d = n.automaticDiscount;
    if (d?.title) {
      console.log(d.title, '| status:', d.status, '| min qty:', d.minimumRequirement?.greaterThanOrEqualToQuantity, '| discount:', d.customerGets?.value?.percentage ? (d.customerGets.value.percentage * 100) + '%' : '?');
    }
  }

  await p.$disconnect();
})();
