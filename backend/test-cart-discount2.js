const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function test() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // First find a watch variant to use
  const watchRes = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      collection(id: "gid://shopify/Collection/432470327547") {
        products(first: 3) {
          nodes {
            title
            handle
            variants(first: 1) { nodes { id title price } }
          }
        }
      }
    }` })
  });
  const watchData = await watchRes.json();
  const watches = watchData?.data?.collection?.products?.nodes || [];
  console.log('Watches from "All Watch" collection:');
  watches.forEach(w => {
    const v = w.variants.nodes[0];
    console.log(`  ${w.title} - variant ${v.id} @ $${v.price}`);
  });

  const watchVariantId = watches[0]?.variants?.nodes?.[0]?.id;
  if (!watchVariantId) { console.error('No watch found!'); return; }

  // Now simulate a cart with draftOrderCalculate
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      mutation draftOrderCalculate($input: DraftOrderInput!) {
        draftOrderCalculate(input: $input) {
          calculatedDraftOrder {
            totalPrice { amount currencyCode }
            subtotalPrice { amount currencyCode }
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
          { variantId: watchVariantId, quantity: 3 },
          { variantId: "gid://shopify/ProductVariant/46941745742075", quantity: 1 }
        ]
      }
    } })
  });
  const data = await res.json();
  
  const order = data?.data?.draftOrderCalculate?.calculatedDraftOrder;
  if (order) {
    console.log('\n=== SIMULATED CART ===');
    console.log('Total:', order.totalPrice.amount, order.totalPrice.currencyCode);
    console.log('Subtotal:', order.subtotalPrice.amount, order.subtotalPrice.currencyCode);
    order.lineItems.forEach(li => {
      console.log(`\n  ${li.title} x${li.quantity}`);
      console.log(`    Original: $${li.originalUnitPrice.amount}`);
      console.log(`    Discounted: $${li.discountedUnitPrice.amount}`);
      console.log(`    Discount: $${li.totalDiscount.amount}`);
      if (li.appliedDiscount) {
        console.log(`    Applied: "${li.appliedDiscount.title}" ${li.appliedDiscount.value}${li.appliedDiscount.valueType === 'PERCENTAGE' ? '%' : ''}`);
      }
    });
  } else {
    console.log('Errors:', JSON.stringify(data?.data?.draftOrderCalculate?.userErrors || data?.errors, null, 2));
  }

  await p.$disconnect();
}
test().catch(e => { console.error(e); p.$disconnect(); });
