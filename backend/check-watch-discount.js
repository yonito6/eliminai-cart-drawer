const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Get full details of Watch Oganizer discount
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1632976961787") {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
            startsAt
            endsAt
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            minimumRequirement {
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
              ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
            }
            customerGets {
              items {
                ... on DiscountProducts {
                  products(first: 5) { nodes { id title handle } }
                }
              }
              value {
                ... on DiscountPercentage { percentage }
                ... on DiscountAmount { amount { amount currencyCode } }
              }
            }
          }
          ... on DiscountAutomaticBxgy {
            title
            status
            customerBuys { items { ... on AllDiscountItems { allItems } } }
            customerGets { items { ... on AllDiscountItems { allItems } } }
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
