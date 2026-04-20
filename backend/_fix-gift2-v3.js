const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });

  // Get ALL qualifying product IDs
  const checkRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{
      automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787604369659") {
        automaticDiscount {
          ... on DiscountAutomaticBxgy {
            customerBuys { items { ... on DiscountProducts { products(first: 100) { nodes { id } } } } }
          }
        }
      }
    }` })
  });
  const checkData = await checkRes.json();
  const productIds = checkData?.data?.automaticDiscountNode?.automaticDiscount?.customerBuys?.items?.products?.nodes?.map(n => n.id) || [];
  console.log('Removing', productIds.length, 'products, adding "All Watch" collection');

  // Update: productsToRemove (not "remove"), collections.add
  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation discountAutomaticBxgyUpdate($id: ID!, $automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
        discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $automaticBxgyDiscount) {
          automaticDiscountNode { id }
          userErrors { field code message }
        }
      }`,
      variables: {
        id: "gid://shopify/DiscountAutomaticNode/1787604369659",
        automaticBxgyDiscount: {
          customerBuys: {
            items: {
              products: {
                productsToRemove: productIds
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
  if (data?.data?.discountAutomaticBxgyUpdate?.userErrors?.length > 0) {
    console.error('Errors:', JSON.stringify(data.data.discountAutomaticBxgyUpdate.userErrors, null, 2));
  } else if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
  } else {
    console.log('Success!');
  }

  // Verify
  const vRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
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
          }
        }
      }
    }` })
  });
  const vData = await vRes.json();
  const d = vData?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('\nVerified "Gift #2":');
  console.log('Status:', d?.status);
  console.log('Buys:', JSON.stringify(d?.customerBuys, null, 2));

  await p.$disconnect();
})();
