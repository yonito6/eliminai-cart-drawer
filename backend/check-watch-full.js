const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1632976961787") {
        id
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title
            status
            startsAt
            endsAt
            usesPerOrderLimit
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            customerBuys {
              value {
                ... on DiscountQuantity { quantity }
                ... on DiscountPurchaseAmount { amount }
              }
              items {
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title handle } }
                  productVariants(first: 10) { nodes { id title } }
                }
                ... on AllDiscountItems { allItems }
                ... on DiscountCollections {
                  collections(first: 10) { nodes { id title } }
                }
              }
            }
            customerGets {
              value {
                ... on DiscountQuantity { quantity }
                ... on DiscountPercentage { percentage }
                ... on DiscountAmount { amount { amount } }
                ... on DiscountOnQuantity { quantity effect { ... on DiscountPercentage { percentage } } }
              }
              items {
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title handle } }
                  productVariants(first: 10) { nodes { id title } }
                }
                ... on AllDiscountItems { allItems }
                ... on DiscountCollections {
                  collections(first: 10) { nodes { id title } }
                }
              }
            }
          }
        }
      }
    }` })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
