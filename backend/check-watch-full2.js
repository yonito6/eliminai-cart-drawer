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
                ... on DiscountPurchaseAmount { amount }
              }
              items {
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title handle } }
                }
                ... on AllDiscountItems { allItems }
              }
            }
            customerGets {
              value {
                ... on DiscountOnQuantity {
                  quantity { quantity }
                  effect {
                    ... on DiscountPercentage { percentage }
                  }
                }
              }
              items {
                ... on DiscountProducts {
                  products(first: 10) { nodes { id title handle } }
                }
                ... on AllDiscountItems { allItems }
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
