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

  // Find the Eleganto Case product GID
  const productRes = await gql(`{
    productByIdentifier(identifier: { handle: "eleganto-premium-watch-organizer" }) {
      id
      title
      handle
      status
    }
  }`);
  const product = productRes?.data?.productByIdentifier;
  console.log('Eleganto Case product:', JSON.stringify(product));

  if (!product) {
    console.error('Product not found!');
    await p.$disconnect();
    return;
  }

  // Recreate the discount: buy 3+ items → Eleganto Case is 100% off
  const result = await gql(`
    mutation discountAutomaticBasicCreate($discount: DiscountAutomaticBasicInput!) {
      discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic {
              title
              status
            }
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
            productsToAdd: [product.id]
          }
        },
        value: {
          percentage: 1.0
        }
      },
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      }
    }
  });

  const errors = result?.data?.discountAutomaticBasicCreate?.userErrors;
  if (errors?.length > 0) {
    console.error('Errors:', JSON.stringify(errors, null, 2));
  } else {
    const node = result?.data?.discountAutomaticBasicCreate?.automaticDiscountNode;
    console.log('Created discount:', JSON.stringify(node, null, 2));
  }

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
