const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function gql(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

(async () => {
  const store = await p.store.findUnique({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { shopDomain: true, accessToken: true },
  });
  const { shopDomain, accessToken: token } = store;

  // 1. Delete the broken DiscountAutomaticBasic "Gift #2"
  console.log('Deleting broken Gift #2...');
  const del = await gql(shopDomain, token, `mutation($id: ID!) { discountAutomaticDelete(id: $id) { userErrors { field message } } }`,
    { id: 'gid://shopify/DiscountAutomaticNode/1787604107515' });
  console.log('Delete result:', JSON.stringify(del?.data?.discountAutomaticDelete?.userErrors));

  // 2. Check the working "Watch Oganizer" to copy its exact structure
  const detail = await gql(shopDomain, token, `{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1632976961787") {
      automaticDiscount {
        ... on DiscountAutomaticBxgy {
          title
          customerBuys {
            items {
              ... on DiscountProducts {
                products(first: 10) { nodes { id title } }
                productVariants(first: 10) { nodes { id title } }
              }
              ... on DiscountCollections {
                collections(first: 10) { nodes { id title } }
              }
              ... on AllDiscountItems { allItems }
            }
            value { ... on DiscountQuantity { quantity } }
          }
          customerGets {
            items {
              ... on DiscountProducts { products(first: 10) { nodes { id title } } }
            }
            value {
              ... on DiscountOnQuantity {
                quantity { quantity }
                effect { ... on DiscountPercentage { percentage } }
              }
            }
          }
        }
      }
    }
  }`);
  const working = detail?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('\nWorking discount structure:');
  console.log(JSON.stringify(working, null, 2));

  // 3. Get all active products for the "customerBuys" section
  const products = await gql(shopDomain, token, `{
    products(first: 50, query: "status:active") {
      nodes { id title }
    }
  }`);
  const allProductIds = products?.data?.products?.nodes?.map(n => n.id) || [];
  console.log('\nActive products:', allProductIds.length);

  // 4. Create the BXGY discount matching the working pattern
  // customerBuys: any 3 products from the catalog
  // customerGets: 1x Eleganto Case (gid://shopify/Product/8959501435131) at 100% off
  console.log('\nCreating BXGY Gift #2...');
  const create = await gql(shopDomain, token, `
    mutation discountAutomaticBxgyCreate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
        automaticDiscountNode {
          id
          automaticDiscount { ... on DiscountAutomaticBxgy { title status } }
        }
        userErrors { field message code }
      }
    }
  `, {
    automaticBxgyDiscount: {
      title: "Gift #2",
      startsAt: new Date().toISOString(),
      usesPerOrderLimit: "1",
      customerBuys: {
        items: {
          products: {
            productsToAdd: allProductIds,
          },
        },
        value: {
          quantity: "3",
        },
      },
      customerGets: {
        items: {
          products: {
            productsToAdd: ["gid://shopify/Product/8959501435131"],
          },
        },
        value: {
          discountOnQuantity: {
            quantity: "1",
            effect: {
              percentage: 1.0,
            },
          },
        },
      },
      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true,
      },
    },
  });
  console.log('Create result:', JSON.stringify(create?.data || create?.errors, null, 2));

  await p.$disconnect();
})();
