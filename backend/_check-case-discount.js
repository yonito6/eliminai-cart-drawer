const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1632976961787") {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title
            status
            usageCount
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            customerBuys {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title } }
                  productVariants(first: 10) { nodes { id title } }
                }
                ... on DiscountCollections {
                  collections(first: 10) { nodes { id title } }
                }
              }
              value { ... on DiscountQuantity { quantity } ... on DiscountPurchaseAmount { amount } }
            }
            customerGets {
              items {
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title } }
                  productVariants(first: 10) { nodes { id title } }
                }
                ... on DiscountCollections {
                  collections(first: 10) { nodes { id title } }
                }
              }
              value { ... on DiscountPercentage { percentage } ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  await p.$disconnect();
})();
