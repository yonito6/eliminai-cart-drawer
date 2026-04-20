const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const query = `{
    automaticDiscountNodes(first: 5) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title
            status
            startsAt
            endsAt
            usesPerOrderLimit
            customerBuys {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title status } }
                }
                ... on DiscountCollections {
                  collections(first: 10) { nodes { id title } }
                }
              }
              value {
                ... on DiscountQuantity { quantity }
                ... on DiscountPurchaseAmount { amount }
              }
            }
            customerGets {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title status } }
                }
                ... on DiscountCollections {
                  collections(first: 10) { nodes { id title } }
                }
              }
              value {
                ... on DiscountPercentage { percentage }
                ... on DiscountOnQuantity {
                  quantity { quantity }
                  effect { ... on DiscountPercentage { percentage } }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  await p.$disconnect();
})();
