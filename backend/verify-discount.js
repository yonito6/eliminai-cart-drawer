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
  const store = await p.store.findFirst({ where: { shopDomain: { contains: 'eleganto-3011' } }, select: { shopDomain: true, accessToken: true } });
  // Query specific discount by ID
  const r = await gql(store.shopDomain, store.accessToken, `{
    node(id: "gid://shopify/DiscountAutomaticNode/1788630728955") {
      ... on DiscountAutomaticNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            customerGets {
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
              items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } }
            }
            combinesWith { productDiscounts }
          }
        }
      }
    }
  }`);
  console.log(JSON.stringify(r?.data?.node, null, 2));
  await p.$disconnect();
})();
