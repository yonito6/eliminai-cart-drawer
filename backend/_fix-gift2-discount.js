const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });

  // Update "Gift #2" to use "All Watch" collection instead of 5 specific products
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation discountAutomaticBxgyUpdate($id: ID!, $automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
        discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $automaticBxgyDiscount) {
          automaticDiscountNode {
            id
            automaticDiscount {
              ... on DiscountAutomaticBxgy {
                title
                status
                customerBuys {
                  items {
                    ... on DiscountCollections {
                      collections(first: 5) { nodes { id title } }
                    }
                  }
                  value { ... on DiscountQuantity { quantity } }
                }
                customerGets {
                  items {
                    ... on DiscountProducts {
                      products(first: 5) { nodes { id title } }
                    }
                  }
                  value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
                }
              }
            }
          }
          userErrors { field message }
        }
      }`,
      variables: {
        id: "gid://shopify/DiscountAutomaticNode/1787604369659",
        automaticBxgyDiscount: {
          customerBuys: {
            items: {
              collections: {
                add: ["gid://shopify/Collection/432470327547"],
                remove: []
              },
              products: {
                remove: [
                  "gid://shopify/Product/7802333692155",
                  "gid://shopify/Product/7804087402747",
                  "gid://shopify/Product/7810426437883",
                  "gid://shopify/Product/7810428961019",
                  "gid://shopify/Product/7810434531579"
                ]
              }
            },
            value: { quantity: "3" }
          }
        }
      }
    })
  });
  const data = await res.json();
  if (data.data?.discountAutomaticBxgyUpdate?.userErrors?.length > 0) {
    console.error('Errors:', JSON.stringify(data.data.discountAutomaticBxgyUpdate.userErrors, null, 2));
  } else {
    const d = data.data?.discountAutomaticBxgyUpdate?.automaticDiscountNode?.automaticDiscount;
    console.log('Updated "Gift #2":');
    console.log('  Buys:', JSON.stringify(d?.customerBuys));
    console.log('  Gets:', JSON.stringify(d?.customerGets));
    console.log('  Status:', d?.status);
  }
  await p.$disconnect();
})();
