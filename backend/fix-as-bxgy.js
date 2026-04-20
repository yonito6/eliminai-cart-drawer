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

  // Delete the old Basic discount that isn't working
  console.log('Deleting old Basic discount...');
  await gql(`mutation { discountAutomaticDelete(id: "gid://shopify/DiscountAutomaticNode/1787496464635") { deletedAutomaticDiscountId userErrors { message } } }`);

  // Create a BxGy discount: buy 3 from "All Watch" collection → get 1 Eleganto Case free
  console.log('Creating BxGy discount...');
  const result = await gql(`
    mutation discountAutomaticBxgyCreate($discount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $discount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
              title
              status
              customerBuys {
                value { ... on DiscountQuantity { quantity } }
                items { ... on DiscountCollections { collections(first: 5) { nodes { id title } } } }
              }
              customerGets {
                value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
                items { ... on DiscountProducts { products(first: 5) { nodes { id title } } } }
              }
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
      usesPerOrderLimit: "1",
      customerBuys: {
        value: { quantity: "3" },
        items: {
          collections: {
            add: ["gid://shopify/Collection/432470327547"]
          }
        }
      },
      customerGets: {
        value: {
          discountOnQuantity: {
            quantity: "1",
            effect: { percentage: 1.0 }
          }
        },
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8959501435131"]
          }
        }
      },
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      }
    }
  });

  const errors = result?.data?.discountAutomaticBxgyCreate?.userErrors;
  if (errors?.length > 0) {
    console.error('Errors:', JSON.stringify(errors, null, 2));
  } else {
    console.log('Created:', JSON.stringify(result?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode, null, 2));
  }

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
