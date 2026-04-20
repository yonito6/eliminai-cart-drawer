const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            customerBuys {
              items {
                ... on DiscountCollections { collections(first: 5) { nodes { id title } } }
                ... on DiscountProducts { products(first: 10) { nodes { id title } } }
                ... on AllDiscountItems { allItems }
              }
              value { ... on DiscountQuantity { quantity } }
            }
            customerGets {
              items {
                ... on DiscountProducts { products(first: 5) { nodes { id title } } }
              }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  const d = data?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('Title:', d?.title);
  console.log('Status:', d?.status);
  console.log('Buys:', JSON.stringify(d?.customerBuys, null, 2));
  console.log('Gets:', JSON.stringify(d?.customerGets, null, 2));
  await p.$disconnect();
})();
