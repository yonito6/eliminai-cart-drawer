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
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787496464635") {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
            startsAt
            combinesWith { productDiscounts orderDiscounts shippingDiscounts }
            minimumRequirement {
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
            customerGets {
              value { ... on DiscountPercentage { percentage } }
              items {
                ... on DiscountProducts {
                  products(first: 5) { nodes { id title handle } }
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
