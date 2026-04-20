const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });

  // First, get ALL qualifying product IDs to remove them
  const checkRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            customerBuys {
              items {
                ... on DiscountProducts { products(first: 100) { nodes { id } } }
              }
            }
          }
        }
      }
    }` })
  });
  const checkData = await checkRes.json();
  const existingProducts = checkData?.data?.automaticDiscountNode?.automaticDiscount?.customerBuys?.items?.products?.nodes?.map(n => n.id) || [];
  console.log('Removing', existingProducts.length, 'individual products, replacing with "All Watch" collection');

  // Now update: remove all products, add collection
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation discountAutomaticBxgyUpdate($id: ID!, $automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
        discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $automaticBxgyDiscount) {
          automaticDiscountNode {
            id
          }
          userErrors { field code message }
        }
      }`,
      variables: {
        id: "gid://shopify/DiscountAutomaticNode/1787604369659",
        automaticBxgyDiscount: {
          customerBuys: {
            items: {
              products: {
                remove: existingProducts
              },
              collections: {
                add: ["gid://shopify/Collection/432470327547"]
              }
            },
            value: { quantity: "3" }
          }
        }
      }
    })
  });
  const data = await res.json();
  const errors = data?.data?.discountAutomaticBxgyUpdate?.userErrors;
  if (errors && errors.length > 0) {
    console.error('User errors:', JSON.stringify(errors, null, 2));
  } else if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
  } else {
    console.log('Success! Verifying...');
  }

  // Verify
  const verifyRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            title status
            customerBuys {
              items {
                ... on DiscountCollections { collections(first: 5) { nodes { id title } } }
                ... on DiscountProducts { products(first: 5) { nodes { id title } } }
              }
              value { ... on DiscountQuantity { quantity } }
            }
            customerGets {
              items { ... on DiscountProducts { products(first: 5) { nodes { id title } } } }
              value { ... on DiscountOnQuantity { quantity { quantity } effect { ... on DiscountPercentage { percentage } } } }
            }
          }
        }
      }
    }` })
  });
  const vData = await verifyRes.json();
  const d = vData?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('\n--- Gift #2 Updated ---');
  console.log('Status:', d?.status);
  console.log('Buys:', JSON.stringify(d?.customerBuys, null, 2));
  console.log('Gets:', JSON.stringify(d?.customerGets, null, 2));

  await p.$disconnect();
})();
