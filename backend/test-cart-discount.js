const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function test() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Use Admin API to create a draft order with 3 watches + the case
  // This simulates what happens when a customer adds items
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      mutation draftOrderCalculate($input: DraftOrderInput!) {
        draftOrderCalculate(input: $input) {
          calculatedDraftOrder {
            totalPrice
            subtotalPrice
            lineItems {
              title
              quantity
              originalUnitPrice
              discountedUnitPrice
              totalDiscount
              appliedDiscount {
                title
                value
                valueType
              }
            }
            appliedDiscount {
              title
              value
              valueType
            }
          }
          userErrors { field message }
        }
      }
    `, variables: {
      input: {
        lineItems: [
          // 3x a watch (let's find a real watch variant)
          { variantId: "gid://shopify/ProductVariant/43471587999995", quantity: 3 },
          // 1x Eleganto Case
          { variantId: "gid://shopify/ProductVariant/46941745742075", quantity: 1 }
        ]
      }
    } })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  await p.$disconnect();
}
test().catch(e => { console.error(e); p.$disconnect(); });
