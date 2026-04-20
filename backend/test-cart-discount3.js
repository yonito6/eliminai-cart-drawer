const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function test() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

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
              originalUnitPrice { amount }
              discountedUnitPrice { amount }
              totalDiscount { amount }
              appliedDiscount {
                title
                value
                valueType
              }
            }
          }
          userErrors { field message }
        }
      }
    `, variables: {
      input: {
        lineItems: [
          { variantId: "gid://shopify/ProductVariant/45167742681339", quantity: 3 },
          { variantId: "gid://shopify/ProductVariant/46941745742075", quantity: 1 }
        ]
      }
    } })
  });
  const data = await res.json();
  
  const order = data?.data?.draftOrderCalculate?.calculatedDraftOrder;
  if (order) {
    console.log('Total:', order.totalPrice);
    console.log('Subtotal:', order.subtotalPrice);
    order.lineItems.forEach(li => {
      console.log(`\n  ${li.title} x${li.quantity}`);
      console.log(`    Original: $${li.originalUnitPrice.amount}`);
      console.log(`    Discounted: $${li.discountedUnitPrice.amount}`);
      console.log(`    Discount: $${li.totalDiscount.amount}`);
      if (li.appliedDiscount) console.log(`    Applied: "${li.appliedDiscount.title}" ${li.appliedDiscount.value} ${li.appliedDiscount.valueType}`);
      else console.log('    Applied: NONE');
    });
  } else {
    console.log(JSON.stringify(data, null, 2));
  }

  await p.$disconnect();
}
test().catch(e => { console.error(e); p.$disconnect(); });
