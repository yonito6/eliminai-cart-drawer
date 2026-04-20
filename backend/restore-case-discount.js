const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function fix() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  async function gql(query, variables) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  }

  // Create discount: buy 3+ items → Eleganto Case 100% off
  const result = await gql(`
    mutation discountAutomaticBasicCreate($discount: DiscountAutomaticBasicInput!) {
      discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic { title status }
          }
        }
        userErrors { field message }
      }
    }
  `, {
    discount: {
      title: "Eliminai Gift — Eleganto Case",
      startsAt: new Date().toISOString(),
      minimumRequirement: {
        quantity: {
          greaterThanOrEqualToQuantity: "3"
        }
      },
      customerGets: {
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8959501435131"]
          }
        },
        value: {
          percentage: 1.0
        }
      },
      combinesWith: {
        productDiscounts: false,
        orderDiscounts: false,
        shippingDiscounts: false
      }
    }
  });

  const errors = result?.data?.discountAutomaticBasicCreate?.userErrors;
  if (errors?.length > 0) {
    console.error('Errors:', JSON.stringify(errors, null, 2));
  } else {
    console.log('Created:', JSON.stringify(result?.data?.discountAutomaticBasicCreate?.automaticDiscountNode, null, 2));
  }

  // Verify final state
  const finalRes = await gql(`{
    automaticDiscountNodes(first: 50) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
          ... on DiscountAutomaticBxgy { title status combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
        }
      }
    }
  }`);
  console.log('\n=== ALL DISCOUNTS ===');
  (finalRes?.data?.automaticDiscountNodes?.nodes || []).forEach(n => {
    const d = n.automaticDiscount;
    console.log(`${d.title} (${d.status}) combines=${JSON.stringify(d.combinesWith)}`);
  });

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
