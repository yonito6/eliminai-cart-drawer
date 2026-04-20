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

  // First, let's check the buy condition more thoroughly with collections
  const checkRes = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1632976961787") {
      id
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title
          customerBuys {
            value {
              ... on DiscountQuantity { quantity }
              ... on DiscountPurchaseAmount { amount }
            }
            items {
              ... on DiscountProducts {
                products(first: 10) { nodes { id title } }
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
  }`);
  console.log('Current customerBuys:', JSON.stringify(checkRes?.data?.automaticDiscountNode?.automaticDiscount?.customerBuys, null, 2));

  // Update the discount with correct buy condition
  // Buy any 3 items from ALL products, get 1 storage box free
  const result = await gql(`
    mutation discountAutomaticBxgyUpdate($id: ID!, $discount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $discount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
              title
              status
              customerBuys {
                value {
                  ... on DiscountQuantity { quantity }
                }
                items {
                  ... on AllDiscountItems { allItems }
                }
              }
              customerGets {
                value {
                  ... on DiscountOnQuantity {
                    quantity { quantity }
                    effect { ... on DiscountPercentage { percentage } }
                  }
                }
                items {
                  ... on DiscountProducts {
                    products(first: 5) { nodes { id title } }
                  }
                }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `, {
    id: "gid://shopify/DiscountAutomaticNode/1632976961787",
    discount: {
      customerBuys: {
        value: {
          quantity: "3"
        },
        items: {
          all: true
        }
      },
      customerGets: {
        value: {
          discountOnQuantity: {
            quantity: "1",
            effect: {
              percentage: 1.0
            }
          }
        },
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8909894648059"]
          }
        }
      },
      usesPerOrderLimit: 1
    }
  });

  console.log('\nUpdate result:', JSON.stringify(result, null, 2));

  await p.$disconnect();
}
fix().catch(e => { console.error(e); p.$disconnect(); });
